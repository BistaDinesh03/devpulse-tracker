"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
// ─── Constants ──────────────────────────
const IDLE_TIMEOUT_MS = 120000;
const FOCUS_SESSION_MIN_MS = 25 * 60000;
const ACTIVE_TICK_MS = 5000;
const SAVE_INTERVAL_MS = 30000;
const STATUS_UPDATE_MS = 10000;
const GIT_CACHE_MS = 60000;
// ─── State ──────────────────────────────
let storagePath = '';
let sessionMs = 0;
let sessionLines = 0;
let sessionFiles = 0;
let sessionSaves = 0;
let sessionLanguages = {};
let focusSessions = 0;
let focusStart = 0;
let savedData = {};
let projects = {};
let activeProject = null;
let lastActivity = Date.now();
let statusBar;
let panel = null;
let cachedGitStats = null;
let lastGitCheck = 0;
// ─── Disposables & Timers ──────────────
const disposables = [];
let focusTimer = null;
let activeTimer = null;
let saveTimer = null;
let statusTimer = null;
// ─── Logging ────────────────────────────
const outputChannel = vscode.window.createOutputChannel('DevPulse', { log: true });
function log(msg) { outputChannel.appendLine(`[${new Date().toISOString()}] ${msg}`); }
// ─── Utility functions ──────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const weekStartStr = (o = 0) => { const d = new Date(); d.setDate(d.getDate() - d.getDay() - o * 7); return d.toISOString().slice(0, 10); };
const monthStartStr = () => new Date().toISOString().slice(0, 7);
function formatDuration(ms) { const m = Math.floor(ms / 60000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; }
function formatNumber(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n); }
function pct(c, t) { return Math.min(Math.round((c / t) * 100), 100); }
function getProjectName(wp) { const f = vscode.workspace.workspaceFolders; if (f)
    for (const w of f)
        if (wp.startsWith(w.uri.fsPath))
            return w.name; return path.basename(wp) || 'Unknown Project'; }
function getActiveWorkspace() { const e = vscode.window.activeTextEditor; if (e) {
    const dp = e.document.uri.fsPath;
    const f = vscode.workspace.workspaceFolders;
    if (f)
        for (const w of f)
            if (dp.startsWith(w.uri.fsPath))
                return w.uri.fsPath;
} const f = vscode.workspace.workspaceFolders; return f?.[0]?.uri.fsPath ?? null; }
function getGoalsConfig() { const c = vscode.workspace.getConfiguration('devpulse.goals'); return { daily: { time: { target: c.get('dailyTime', 240), unit: 'min', label: 'Coding Time' }, lines: { target: c.get('dailyLines', 500), unit: 'lines', label: 'Lines' }, sessions: { target: c.get('dailySessions', 3), unit: 'sessions', label: 'Focus Sessions' } }, weekly: { time: { target: c.get('weeklyTime', 1200), unit: 'min', label: 'Weekly Time' }, days: { target: c.get('weeklyDays', 5), unit: 'days', label: 'Days Coded' } }, monthly: { time: { target: c.get('monthlyTime', 4800), unit: 'min', label: 'Monthly Time' }, days: { target: c.get('monthlyDays', 20), unit: 'days', label: 'Days Coded' } } }; }
function ensureProject(wp) { if (!projects[wp])
    projects[wp] = { name: getProjectName(wp), path: wp, totalMs: 0, totalLines: 0, totalFiles: 0, totalSaves: 0, sessions: 0, languages: {}, lastOpened: Date.now(), firstSeen: Date.now(), daysActive: new Set() }; return projects[wp]; }
// ─── Data persistence ───────────────────
function loadData() { try {
    const fp = path.join(storagePath, 'devpulse.json');
    if (fs.existsSync(fp)) {
        savedData = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        if (savedData._projects)
            for (const [k, v] of Object.entries(savedData._projects))
                projects[k] = { ...v, daysActive: new Set(v.daysActive || []) };
    }
}
catch {
    savedData = {};
} }
function saveData() { const k = todayStr(); if (!savedData[k])
    savedData[k] = { ms: 0, lines: 0, files: 0, saves: 0, langs: {}, sessions: 0 }; const cur = savedData[k]; cur.ms += sessionMs; cur.lines += sessionLines; cur.files += sessionFiles; cur.saves += sessionSaves; cur.sessions = (cur.sessions || 0) + focusSessions; for (const [l, n] of Object.entries(sessionLanguages))
    cur.langs[l] = (cur.langs[l] || 0) + n; if (activeProject) {
    const p = projects[activeProject];
    if (p) {
        p.totalLines += sessionLines;
        p.totalFiles += sessionFiles;
        p.totalSaves += sessionSaves;
        p.sessions += focusSessions;
        for (const [l, n] of Object.entries(sessionLanguages))
            p.languages[l] = (p.languages[l] || 0) + n;
        savedData._projects = savedData._projects || {};
        savedData._projects[activeProject] = { name: p.name, path: p.path, totalMs: p.totalMs, totalLines: p.totalLines, totalFiles: p.totalFiles, totalSaves: p.totalSaves, sessions: p.sessions, languages: p.languages, lastOpened: p.lastOpened, firstSeen: p.firstSeen, daysActive: Array.from(p.daysActive) };
    }
} sessionMs = 0; sessionLines = 0; sessionFiles = 0; sessionSaves = 0; focusSessions = 0; sessionLanguages = {}; fs.writeFileSync(path.join(storagePath, 'devpulse.json'), JSON.stringify(savedData)); loadData(); }
// ─── Computed stats ─────────────────────
const todayMs = () => (savedData[todayStr()]?.ms || 0) + sessionMs;
const todayLines = () => (savedData[todayStr()]?.lines || 0) + sessionLines;
const todaySessions = () => (savedData[todayStr()]?.sessions || 0) + focusSessions;
const todayLangs = () => { const m = { ...(savedData[todayStr()]?.langs || {}) }; for (const [l, n] of Object.entries(sessionLanguages))
    m[l] = (m[l] || 0) + n; return m; };
function getStreak() { let s = 0; const d = new Date(); if (todayMs() === 0 && (!savedData[todayStr()] || savedData[todayStr()]?.ms === 0))
    d.setDate(d.getDate() - 1); for (let i = 0; i < 400; i++) {
    const k = d.toISOString().slice(0, 10);
    if ((k === todayStr() ? todayMs() : (savedData[k]?.ms || 0)) > 0) {
        s++;
        d.setDate(d.getDate() - 1);
    }
    else
        break;
} return s || 0; }
function bestStreak() { let b = 0, c = 0, p = null; for (const k of Object.keys(savedData).filter(k => k !== '_projects').sort()) {
    const ms = k === todayStr() ? todayMs() : (savedData[k]?.ms || 0);
    if (ms > 0) {
        const d = new Date(k);
        if (p && (d.getTime() - p.getTime()) / 86400000 <= 1.5)
            c++;
        else
            c = 1;
        p = d;
        if (c > b)
            b = c;
    }
    else
        c = 0;
} return b || 0; }
const totalHours = () => { let ms = todayMs(); for (const [k, d] of Object.entries(savedData)) {
    if (k !== todayStr() && k !== '_projects')
        ms += d?.ms || 0;
} return Math.floor(ms / 3600000); };
const totalLines = () => { let n = todayLines(); for (const [k, d] of Object.entries(savedData)) {
    if (k !== todayStr() && k !== '_projects')
        n += d?.lines || 0;
} return n; };
const weekMs = () => { const w = weekStartStr(); let ms = 0; for (const [k, d] of Object.entries(savedData)) {
    if (k >= w && k !== '_projects')
        ms += d?.ms || 0;
} return ms + (todayStr() >= w ? sessionMs : 0); };
const weekDays = () => { const w = weekStartStr(); let d = 0; for (const [k, v] of Object.entries(savedData)) {
    if (k >= w && k !== '_projects' && v?.ms > 0)
        d++;
} if (todayStr() >= w && todayMs() > 0 && !savedData[todayStr()])
    d++; return d; };
const monthMs = () => { const m = monthStartStr(); let ms = 0; for (const [k, d] of Object.entries(savedData)) {
    if (k.startsWith(m) && k !== '_projects')
        ms += d?.ms || 0;
} return ms + sessionMs; };
const monthDays = () => { const m = monthStartStr(); let d = 0; for (const [k, v] of Object.entries(savedData)) {
    if (k.startsWith(m) && k !== '_projects' && v?.ms > 0)
        d++;
} if (todayMs() > 0 && !savedData[todayStr()])
    d++; return d; };
// ─── Cross-platform Git ────────────────
function git(args, cwd) { try {
    return (0, child_process_1.execFileSync)('git', args, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }).trim();
}
catch {
    return '';
} }
function isGitInstalled() { try {
    (0, child_process_1.execFileSync)('git', ['--version'], { stdio: 'pipe', windowsHide: true });
    return true;
}
catch {
    return false;
} }
function findGitRepo() { const f = vscode.workspace.workspaceFolders; if (!f?.length)
    return null; const r = f[0].uri.fsPath; try {
    (0, child_process_1.execFileSync)('git', ['rev-parse', '--git-dir'], { cwd: r, stdio: 'pipe', windowsHide: true });
    return r;
}
catch {
    return null;
} }
function countLines(text) { return text ? text.split('\n').filter(l => l.length > 0).length : 0; }
function getGitStats() {
    const now = Date.now();
    if (cachedGitStats && (now - lastGitCheck) < GIT_CACHE_MS)
        return cachedGitStats;
    const def = { available: false, branch: '', commitsToday: 0, commitsWeek: 0, commitsMonth: 0, commitsTotal: 0, filesChanged: 0, recentMessages: [], repoName: '' };
    if (!isGitInstalled())
        return def;
    const rp = findGitRepo();
    if (!rp)
        return def;
    try {
        const br = git(['rev-parse', '--abbrev-ref', 'HEAD'], rp);
        const rn = path.basename(rp);
        const au = git(['config', 'user.name'], rp);
        if (!au) {
            cachedGitStats = { ...def, available: true, branch: br, repoName: rn };
            lastGitCheck = now;
            return cachedGitStats;
        }
        const ts = todayStr();
        const ws = weekStartStr();
        const ms = monthStartStr() + '-01';
        cachedGitStats = { available: true, branch: br, commitsToday: countLines(git(['log', '--oneline', `--since=${ts}T00:00:00`, `--until=${ts}T23:59:59`, `--author=${au}`], rp)), commitsWeek: countLines(git(['log', '--oneline', `--since=${ws}T00:00:00`, `--author=${au}`], rp)), commitsMonth: countLines(git(['log', '--oneline', `--since=${ms}T00:00:00`, `--author=${au}`], rp)), commitsTotal: parseInt(git(['rev-list', '--count', 'HEAD', `--author=${au}`], rp), 10) || 0, filesChanged: countLines(git(['diff', '--name-only', 'HEAD'], rp)), recentMessages: git(['log', '-5', '--pretty=format:%s', `--author=${au}`], rp).split('\n').filter(m => m.length > 0).slice(0, 5), repoName: rn };
        lastGitCheck = now;
        return cachedGitStats;
    }
    catch {
        return def;
    }
}
// ─── Cleanup ────────────────────────────
function disposeAll() { if (focusTimer)
    clearInterval(focusTimer); if (activeTimer)
    clearInterval(activeTimer); if (saveTimer)
    clearInterval(saveTimer); if (statusTimer)
    clearInterval(statusTimer); for (const d of disposables)
    d.dispose(); if (statusBar)
    statusBar.dispose(); if (panel)
    panel.dispose(); outputChannel.dispose(); }
// ─── CSS Design System (No Emojis, Codicons) ──
const CSS = `
:root{--r:8px;--p:16px;--g:10px;--t:150ms}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--vscode-editor-background,#1e1e1e);color:var(--vscode-editor-foreground,#ccc);padding:20px;font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased}
.c{max-width:620px;margin:0 auto;display:flex;flex-direction:column;gap:var(--g)}
.card{background:var(--vscode-input-background,#3c3c3c);border:1px solid var(--vscode-panel-border,#474747);border-radius:var(--r);padding:var(--p);transition:border-color var(--t)}
.card:hover{border-color:var(--vscode-focusBorder,#007acc40)}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.card-title{font-size:12px;font-weight:600;letter-spacing:-0.01em}
.card-sub{font-size:10px;color:var(--vscode-descriptionForeground,#999)}
/* Hero */
.hero-row{display:grid;grid-template-columns:1fr 1fr;gap:var(--g)}
.hero{grid-row:span 2;background:var(--vscode-input-background,#3c3c3c);border:1px solid var(--vscode-panel-border,#474747);border-radius:var(--r);padding:24px var(--p);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:border-color var(--t)}
.hero:hover{border-color:var(--vscode-focusBorder,#007acc40)}
.hero-value{font-family:'Cascadia Code','JetBrains Mono',monospace;font-size:48px;font-weight:300;letter-spacing:-0.03em;line-height:1;font-feature-settings:"tnum"}
.hero-label{font-size:11px;color:var(--vscode-descriptionForeground,#999);margin-top:4px;text-transform:uppercase;letter-spacing:0.04em}
.hero-trend{font-size:11px;margin-top:8px;padding:2px 10px;border-radius:10px;font-weight:500}
.trend-up{background:#4ac76b18;color:#4ac76b}.trend-down{background:#e0555518;color:#e05555}.trend-neutral{background:var(--vscode-descriptionForeground,#999)10;color:var(--vscode-descriptionForeground,#999)}
/* Metric */
.metric{background:var(--vscode-input-background,#3c3c3c);border:1px solid var(--vscode-panel-border,#474747);border-radius:var(--r);padding:var(--p);display:flex;flex-direction:column;justify-content:center;transition:border-color var(--t)}
.metric:hover{border-color:var(--vscode-focusBorder,#007acc40)}
.metric-value{font-family:'Cascadia Code',monospace;font-size:20px;font-weight:500;font-feature-settings:"tnum"}
.metric-label{font-size:10px;color:var(--vscode-descriptionForeground,#999);margin-top:2px;text-transform:uppercase;letter-spacing:0.04em}
/* Goals */
.goal-row{padding:6px 0;border-bottom:1px solid var(--vscode-panel-border,#47474718)}.goal-row:last-child{border-bottom:none}
.goal-complete{opacity:0.5}
.goal-info{display:flex;align-items:baseline;gap:6px;margin-bottom:3px}
.goal-name{font-size:12px;font-weight:500;flex:1}
.goal-current{font-family:'Cascadia Code',monospace;font-size:13px;font-weight:600;font-feature-settings:"tnum"}
.goal-target{font-size:11px;color:var(--vscode-descriptionForeground,#999)}
.goal-track{height:4px;background:var(--vscode-editor-inactiveSelectionBackground,#3a3d41);border-radius:2px;overflow:hidden;margin-bottom:2px}
.goal-fill{height:100%;border-radius:2px;background:var(--vscode-button-background,#007acc);transition:width 0.4s ease}
.goal-complete .goal-fill{background:#4ac76b}
.goal-meta{display:flex;justify-content:space-between;font-size:10px;color:var(--vscode-descriptionForeground,#999)}
.goal-pct{font-weight:600}.goal-check{color:#4ac76b;font-weight:700}
/* Tabs */
.tabs{display:flex;gap:1px;background:var(--vscode-editor-inactiveSelectionBackground,#3a3d4140);border-radius:6px;padding:2px}
.tab{padding:4px 12px;border-radius:5px;font-size:11px;cursor:pointer;color:var(--vscode-descriptionForeground,#999);border:none;background:none;transition:all var(--t)}
.tab:hover{color:var(--vscode-editor-foreground,#ccc)}
.tab.active{background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-editor-foreground,#ccc);box-shadow:0 1px 2px #00000020}
.tab-content{display:none}.tab-content.active{display:block}
/* Heatmap */
.hmg{display:flex;flex-wrap:wrap;gap:3px}
.hmc{width:10px;height:10px;border-radius:2px;background:var(--vscode-editor-inactiveSelectionBackground,#3a3d41);cursor:pointer;transition:transform 0.12s;outline:1px solid transparent}
.hmc:focus-visible,.hmc:hover{transform:scale(1.4);z-index:5;outline-color:var(--vscode-focusBorder,#007acc);outline-offset:1px}
.hl1{background:var(--vscode-charts-green,#0e4429);opacity:0.35}.hl2{background:var(--vscode-charts-green,#006d32);opacity:0.55}
.hl3{background:var(--vscode-charts-green,#26a641);opacity:0.75}.hl4{background:var(--vscode-charts-green,#39d353)}
.leg{display:flex;gap:3px;align-items:center;justify-content:flex-end;margin-top:8px;font-size:9px;color:var(--vscode-descriptionForeground,#999)}
.legc{width:10px;height:10px;border-radius:2px}
/* Weekly bars */
.bars{display:flex;align-items:flex-end;gap:5px;height:48px}
.bw{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}
.b{width:100%;max-width:30px;border-radius:3px 3px 0 0;min-height:3px;transition:height 0.3s ease}
.bi{background:var(--vscode-editor-inactiveSelectionBackground,#3a3d41)}.ba{background:var(--vscode-button-background,#007acc);opacity:0.4}
.bt{background:var(--vscode-button-background,#007acc)}.bd{font-size:9px;color:var(--vscode-descriptionForeground,#999)}.bda{color:var(--vscode-button-background,#007acc);font-weight:600}
/* Languages */
.lr{display:flex;align-items:center;gap:8px;padding:4px 0;border-radius:4px;transition:background var(--t)}.lr:hover{background:var(--vscode-list-hoverBackground,#2a2d2e40)}
.ld{width:9px;height:9px;border-radius:50%;flex-shrink:0}.ln{flex:1;font-size:12px}
.lp{font-family:'Cascadia Code',monospace;font-size:11px;color:var(--vscode-descriptionForeground,#999);width:32px;text-align:right}
.lempty{font-size:12px;color:var(--vscode-descriptionForeground,#999);padding:20px;text-align:center;line-height:1.6}
.lempty strong{color:var(--vscode-editor-foreground,#ccc);font-weight:500}
/* Projects */
.proj-card{background:var(--vscode-input-background,#3c3c3c);border:1px solid var(--vscode-panel-border,#474747);border-radius:var(--r);padding:12px;margin-bottom:6px;transition:border-color var(--t)}
.proj-card:hover{border-color:var(--vscode-focusBorder,#007acc40)}
.proj-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.proj-name{font-weight:600;font-size:13px}.proj-ago{font-size:10px;color:var(--vscode-descriptionForeground,#999)}
.proj-stats{font-size:10px;color:var(--vscode-descriptionForeground,#999);display:flex;gap:8px;flex-wrap:wrap}
.proj-langs{font-size:10px;color:var(--vscode-descriptionForeground,#999);margin-top:3px}
.sort-row{display:flex;gap:4px;margin-bottom:8px}
.sort-btn{padding:3px 10px;border-radius:4px;font-size:10px;cursor:pointer;color:var(--vscode-descriptionForeground,#999);border:1px solid var(--vscode-panel-border,#474747);background:transparent;transition:all var(--t)}
.sort-btn:hover,.sort-btn:focus-visible{color:var(--vscode-editor-foreground,#ccc);border-color:var(--vscode-focusBorder,#007acc)}
.sort-btn.active{color:var(--vscode-button-foreground,#fff);background:var(--vscode-button-background,#007acc);border-color:var(--vscode-button-background,#007acc)}
/* Insights */
.insights-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.insight-card{background:var(--vscode-input-background,#3c3c3c);border:1px solid var(--vscode-panel-border,#474747);border-radius:var(--r);padding:12px;display:flex;gap:10px;align-items:flex-start;transition:border-color var(--t)}
.insight-card:hover{border-color:var(--vscode-focusBorder,#007acc40)}
.insight-icon{width:20px;height:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--vscode-button-background,#007acc)}
.insight-body{flex:1;min-width:0}
.insight-label{font-size:10px;color:var(--vscode-descriptionForeground,#999);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:1px}
.insight-value{font-family:'Cascadia Code',monospace;font-size:16px;font-weight:500;margin-bottom:1px;font-feature-settings:"tnum"}
.insight-change{font-size:10px;font-weight:500}.insight-up{color:#4ac76b}.insight-down{color:#e05555}.insight-neutral{color:var(--vscode-descriptionForeground,#999)}
/* Git */
.git-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.git-repo{font-size:13px;font-weight:600}.git-branch{font-size:10px;padding:2px 8px;border-radius:8px;background:var(--vscode-button-background,#007acc15);color:var(--vscode-button-background,#58a6ff);font-family:'Cascadia Code',monospace}
.git-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}
.git-stat{text-align:center;padding:8px 4px;background:var(--vscode-editor-inactiveSelectionBackground,#3a3d4120);border-radius:6px}
.git-stat-val{font-family:'Cascadia Code',monospace;font-size:20px;font-weight:600;font-feature-settings:"tnum"}
.git-stat-lbl{font-size:9px;color:var(--vscode-descriptionForeground,#999);margin-top:2px}
.git-files{font-size:10px;color:var(--vscode-descriptionForeground,#999);padding:4px 0}
.git-msgs{border-top:1px solid var(--vscode-panel-border,#47474718);padding-top:6px}
.git-msg-label{font-size:9px;color:var(--vscode-descriptionForeground,#999);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px}
.git-msg{font-family:'Cascadia Code',monospace;font-size:11px;padding:1px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Wrapped banner */
.wrapped-banner{background:linear-gradient(135deg,#1a133320,#1c103320);border:1px solid var(--vscode-panel-border,#474747);border-radius:var(--r);padding:18px;text-align:center;cursor:pointer;transition:all var(--t)}
.wrapped-banner:hover{border-color:var(--vscode-focusBorder,#007acc60);transform:translateY(-1px)}
.wrapped-badge{display:inline-block;padding:3px 12px;border-radius:10px;font-size:10px;font-weight:600;background:var(--vscode-button-background,#007acc15);color:var(--vscode-button-background,#58a6ff);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em}
.wrapped-big{font-size:36px;font-weight:800;letter-spacing:-0.03em;background:linear-gradient(135deg,var(--vscode-button-background,#58a6ff),#a371f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.wrapped-sub{font-size:11px;color:var(--vscode-descriptionForeground,#999);margin-top:2px}
/* Footer */
.footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:4px}
.footer-summary{font-size:10px;color:var(--vscode-descriptionForeground,#999);display:flex;gap:6px;flex-wrap:wrap}
.footer-summary strong{color:var(--vscode-editor-foreground,#ccc);font-weight:500}
/* Buttons */
.btn{padding:7px 16px;border:none;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;background:var(--vscode-button-background,#007acc);color:var(--vscode-button-foreground,#fff);transition:all var(--t);font-family:inherit}
.btn:hover{background:var(--vscode-button-hoverBackground,#1c97ea)}
.btn:focus-visible{outline:2px solid var(--vscode-focusBorder,#007acc);outline-offset:2px}
.btn-secondary{background:transparent;border:1px solid var(--vscode-panel-border,#474747);color:var(--vscode-editor-foreground,#ccc)}
.btn-secondary:hover{background:var(--vscode-list-hoverBackground,#2a2d2e)}
/* Share modal */
.modal-overlay{display:none;position:fixed;inset:0;background:#00000060;z-index:1000;align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal{background:var(--vscode-input-background,#3c3c3c);border:1px solid var(--vscode-panel-border,#474747);border-radius:12px;padding:24px;max-width:520px;width:92%;max-height:80vh;overflow-y:auto}
.modal-title{font-size:15px;font-weight:600;margin-bottom:16px}
/* Template picker - list style with preview */
.template-list{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.template-item{display:flex;align-items:center;gap:14px;padding:12px 14px;border:1px solid var(--vscode-panel-border,#474747);border-radius:8px;cursor:pointer;transition:all var(--t)}
.template-item:hover{border-color:var(--vscode-focusBorder,#007acc);background:var(--vscode-list-hoverBackground,#2a2d2e40)}
.template-item.selected{border-color:var(--vscode-button-background,#007acc);background:var(--vscode-button-background,#007acc08)}
.template-preview{width:80px;height:44px;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;overflow:hidden}
.tp-pro{background:linear-gradient(135deg,#1e1e36,#16213e);color:#7c8aff;border:1px solid rgba(255,255,255,0.08)}
.tp-min{background:#ffffff;color:#111827;border:1px solid #e5e7eb}
.tp-gh{background:#0d1117;color:#58a6ff;border:1px solid #30363d}
.tp-wr{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:1px solid rgba(255,255,255,0.1)}
.template-info{flex:1}.template-name{font-size:13px;font-weight:500}.template-desc{font-size:10px;color:var(--vscode-descriptionForeground,#999);margin-top:2px}
.modal-actions{display:flex;gap:8px;justify-content:flex-end}
/* Tooltips */
[data-tip]{position:relative}[data-tip]:hover::after{content:attr(data-tip);position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-panel-border,#474747);padding:3px 8px;border-radius:4px;font-size:10px;white-space:nowrap;z-index:100;margin-bottom:4px;pointer-events:none;color:var(--vscode-editor-foreground,#ccc)}
/* Animations */
@keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.ai{animation:fi 0.25s ease forwards;opacity:0}.d1{animation-delay:0.03s}.d2{animation-delay:0.06s}.d3{animation-delay:0.09s}.d4{animation-delay:0.12s}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--vscode-scrollbarSlider-background,#424242);border-radius:3px}
:focus-visible{outline:2px solid var(--vscode-focusBorder,#007acc);outline-offset:1px}
@media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important}}
`;
// ─── SVG Icons (Codicon-style, no emojis) ──
const ICONS = {
    clock: '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.2"/><polyline points="8,4 8,8 11,10" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    streak: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1c-2 3-4 5-4 7a4 4 0 008 0c0-2-2-4-4-7z" fill="currentColor"/></svg>',
    chart: '<svg width="14" height="14" viewBox="0 0 16 16"><rect x="1" y="8" width="3" height="6" rx="0.5" fill="currentColor"/><rect x="6" y="5" width="3" height="9" rx="0.5" fill="currentColor"/><rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor"/></svg>',
    folder: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M1 3.5A1.5 1.5 0 012.5 2h3.5l2 2h5.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-12A1.5 1.5 0 011 12.5z" fill="currentColor"/></svg>',
    git: '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="3" r="2" fill="currentColor"/><circle cx="6" cy="11" r="2" fill="currentColor"/><circle cx="12" cy="10" r="2" fill="currentColor"/><line x1="8" y1="5" x2="6.5" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="10.5" y1="8.5" x2="12" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>',
    target: '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="1" fill="currentColor"/></svg>',
    code: '<svg width="14" height="14" viewBox="0 0 16 16"><polyline points="5,5 2,8 5,11" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="11,5 14,8 11,11" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="9" y1="3" x2="7" y2="13" stroke="currentColor" stroke-width="1.5"/></svg>',
    flame: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 1.5C6 4.5 4 6.5 4 8.5a4 4 0 008 0c0-2-2-4-4-7z" fill="currentColor"/></svg>',
    share: '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="4" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="3" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="13" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="5.5" y1="6.5" x2="10.5" y2="4.5" stroke="currentColor" stroke-width="1.2"/><line x1="5.5" y1="9.5" x2="10.5" y2="11.5" stroke="currentColor" stroke-width="1.2"/></svg>',
};
// ─── HTML Components ────────────────────
function goalBar(label, current, target, unit, done) {
    const p = pct(current, target);
    const r = target - current;
    const val = unit === 'min' ? formatDuration(current * 60000) : `${current} ${unit}`;
    const tgt = unit === 'min' ? formatDuration(target * 60000) : `${target} ${unit}`;
    const left = unit === 'min' ? formatDuration(r * 60000) : `${r} ${unit}`;
    const eta = current > 0 && !done ? `Est. ${formatDuration(Math.floor((r / (current / (todayMs() / 60000))) * 60000))}` : '';
    return `<div class="goal-row${done ? ' goal-complete' : ''}">
        <div class="goal-info"><span class="goal-name">${label}</span><span class="goal-current">${val}</span><span class="goal-target">/ ${tgt}</span></div>
        <div class="goal-track"><div class="goal-fill" style="width:${p}%" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"></div></div>
        <div class="goal-meta"><span class="goal-pct">${p}%</span>${done ? '<span class="goal-check">Complete</span>' : `<span>${left} left${eta ? ' · ' + eta : ''}</span>`}</div>
    </div>`;
}
function projectListHTML(sort) {
    const pa = Object.values(projects);
    if (!pa.length)
        return '<div class="lempty"><strong>No projects tracked yet.</strong><br>Open a workspace folder and start coding. DevPulse will automatically detect your project.</div>';
    if (sort === 'time')
        pa.sort((a, b) => b.totalMs - a.totalMs);
    else if (sort === 'recent')
        pa.sort((a, b) => b.lastOpened - a.lastOpened);
    else
        pa.sort((a, b) => b.daysActive.size - a.daysActive.size);
    return pa.map(p => {
        const h = Math.floor(p.totalMs / 3600000);
        const d = p.daysActive.size;
        const fl = p.totalFiles;
        const topLangs = Object.keys(p.languages).slice(0, 2).join(', ');
        const ago = Math.floor((Date.now() - p.lastOpened) / 86400000);
        const as = ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${ago}d ago`;
        return `<div class="proj-card"><div class="proj-top"><span class="proj-name">${p.name}</span><span class="proj-ago">${as}</span></div><div class="proj-stats"><span>${h}h coded</span><span>${d} days</span><span>${fl} files</span>${topLangs ? `<span>${topLangs}</span>` : ''}</div></div>`;
    }).join('');
}
function gitHTML() {
    const g = getGitStats();
    if (!g.available || !g.repoName)
        return '<div class="lempty"><strong>No Git repository detected.</strong><br>Open a folder with a Git repository to see commits, branches, and activity.</div>';
    const msgs = g.recentMessages.length ? g.recentMessages.map(m => `<div class="git-msg">${m.slice(0, 64)}${m.length > 64 ? '\u2026' : ''}</div>`).join('') : '<div class="git-msg" style="opacity:0.4">No recent commits</div>';
    return `<div class="git-header"><span class="git-repo">${g.repoName}</span><span class="git-branch">${g.branch}</span></div><div class="git-grid"><div class="git-stat"><div class="git-stat-val">${g.commitsToday}</div><div class="git-stat-lbl">Today</div></div><div class="git-stat"><div class="git-stat-val">${g.commitsWeek}</div><div class="git-stat-lbl">This Week</div></div><div class="git-stat"><div class="git-stat-val">${g.commitsMonth}</div><div class="git-stat-lbl">This Month</div></div><div class="git-stat"><div class="git-stat-val">${g.commitsTotal}</div><div class="git-stat-lbl">Total</div></div></div><div class="git-files">${g.filesChanged} files changed</div><div class="git-msgs"><div class="git-msg-label">Recent commits</div>${msgs}</div>`;
}
// ─── Dashboard Builder (Smooth updates, no flicker) ──
function buildDashboardHTML() {
    const g = getGoalsConfig();
    const tm = todayMs();
    const tl = todayLines();
    const ts = todaySessions();
    const lg = todayLangs();
    const st = getStreak();
    const bs = bestStreak();
    const th = totalHours();
    const tll = totalLines();
    const wm = weekMs();
    const wd = weekDays();
    const mm = monthMs();
    const md = monthDays();
    const yk = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const ym = savedData[yk]?.ms || 0;
    const tr = ym > 0 ? Math.round(((tm - ym) / ym) * 100) : 0;
    const dt = Math.floor(tm / 60000);
    const dtD = dt >= g.daily.time.target;
    const dlD = tl >= g.daily.lines.target;
    const dsD = ts >= g.daily.sessions.target;
    const wt = Math.floor(wm / 60000);
    const wtD = wt >= g.weekly.time.target;
    const wdD = wd >= g.weekly.days.target;
    const mt = Math.floor(mm / 60000);
    const mtD = mt >= g.monthly.time.target;
    const mdD = md >= g.monthly.days.target;
    const git = getGitStats();
    const langs = Object.entries(lg).sort((a, b) => b[1] - a[1]);
    const tlT = langs.reduce((s, [, n]) => s + n, 0) || 1;
    const lc = { typescript: '#3178c6', javascript: '#f7df1e', python: '#3776ab', css: '#c6538c', html: '#e34c26', json: '#292929', markdown: '#083fa1', ts: '#3178c6', js: '#f7df1e', py: '#3776ab', java: '#b07219', go: '#00add8', rust: '#dea584', cpp: '#f34b7d' };
    let lr = '';
    for (const [l, n] of langs.slice(0, 4)) {
        const p = Math.round((n / tlT) * 100);
        const c = lc[l.toLowerCase()] || '#8b949e';
        lr += `<div class="lr"><span class="ld" style="background:${c}"></span><span class="ln">${l}</span><span class="lp">${p}%</span></div>`;
    }
    if (!lr)
        lr = '<div class="lempty"><strong>No language data yet.</strong><br>Save a file to see your language breakdown.</div>';
    let hm = '';
    const nw = new Date();
    for (let w = 25; w >= 0; w--)
        for (let d = 6; d >= 0; d--) {
            const dt = new Date(nw);
            dt.setDate(dt.getDate() - (w * 7 + d));
            const k = dt.toISOString().slice(0, 10);
            const it = k === todayStr();
            const ms = it ? tm : (savedData[k]?.ms || 0);
            let lv = 0;
            const h = ms / 3600000;
            if (h > 0)
                lv = 1;
            if (h > 0.5)
                lv = 2;
            if (h > 2)
                lv = 3;
            if (h > 4)
                lv = 4;
            const dayData = it ? { lines: tl, files: sessionFiles, langs: lg, sessions: ts } : savedData[k];
            const tip = `${k}: ${formatDuration(ms)}${dayData ? ` | ${dayData.lines || 0} lines` : ''}`;
            hm += `<div class="hmc hl${lv}" data-tip="${tip}"${it ? ' style="outline:1px solid var(--vscode-focusBorder,#007acc)"' : ''} tabindex="0" role="img" aria-label="${tip}"></div>`;
        }
    const wd_ = [];
    for (let i = 6; i >= 0; i--) {
        const dt = new Date(nw);
        dt.setDate(dt.getDate() - i);
        const k = dt.toISOString().slice(0, 10);
        wd_.push(k === todayStr() ? tm : (savedData[k]?.ms || 0));
    }
    const mxW = Math.max(...wd_, 60000);
    const dl_ = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let wb = '';
    for (let i = 0; i < 7; i++) {
        const h = wd_[i] / 3600000;
        const bp = Math.max((h / (mxW / 3600000)) * 48, 3);
        const it = i === 6;
        wb += `<div class="bw"><div class="b ${it ? 'bt' : h > 0 ? 'ba' : 'bi'}" style="height:${bp}px" role="img" aria-label="${dl_[(nw.getDay() - 6 + i + 7) % 7]}: ${formatDuration(wd_[i])}"></div><span class="bd${it ? ' bda' : ''}">${dl_[(nw.getDay() - 6 + i + 7) % 7]}</span></div>`;
    }
    // Insights
    const wk = weekStartStr();
    const ek = todayStr();
    let twm = 0, twl = 0, tws = 0, twls = 0;
    const twlg = {};
    const dm = {};
    const dn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const [k, d] of Object.entries(savedData)) {
        if (k === '_projects' || k < wk || k > ek)
            continue;
        const dy = d;
        twm += dy.ms || 0;
        twl += dy.lines || 0;
        tws += dy.sessions || 0;
        if (dy.ms > twls)
            twls = dy.ms;
        for (const [ln, nn] of Object.entries(dy.langs || {}))
            twlg[ln] = (twlg[ln] || 0) + nn;
        const dt = new Date(k);
        dm[dn[dt.getDay()]] = (dm[dn[dt.getDay()]] || 0) + (dy.ms || 0);
    }
    twm += sessionMs;
    twl += sessionLines;
    tws += focusSessions;
    let bd_ = '', bm_ = 0;
    for (const [nn, dd] of Object.entries(dm)) {
        if (dd > bm_) {
            bm_ = dd;
            bd_ = nn;
        }
    }
    const lwk = weekStartStr(1);
    let lwm = 0, lwl = 0;
    for (const [k, d] of Object.entries(savedData)) {
        if (k === '_projects' || k < lwk || k >= wk)
            continue;
        const dy = d;
        lwm += dy.ms || 0;
        lwl += dy.lines || 0;
    }
    const tch = lwm > 0 ? Math.round(((twm - lwm) / lwm) * 100) : 0;
    const da = Object.keys(dm).length;
    const insightsHTML = [
        { l: 'Coding time', v: formatDuration(twm), c: tch, cl: tch >= 0 ? `+${Math.abs(tch)}%` : `-${Math.abs(tch)}%` },
        { l: 'Daily avg', v: formatDuration(da > 0 ? Math.floor(twm / da) : 0), c: 0, cl: `${da}/7 days` },
        { l: 'Best day', v: bd_, c: 0, cl: formatDuration(bm_) },
        { l: 'Lines', v: formatNumber(twl), c: lwl > 0 ? Math.round(((twl - lwl) / lwl) * 100) : 0, cl: lwl > 0 ? `${twl > lwl ? '+' : ''}${Math.round(((twl - lwl) / lwl) * 100)}%` : '' },
        { l: 'Sessions', v: String(tws), c: 0, cl: '25 min blocks' },
        { l: 'Longest', v: formatDuration(twls), c: 0, cl: '' },
    ].map(x => `<div class="insight-card"><div class="insight-icon">${x.l === 'Coding time' ? ICONS.clock : x.l === 'Best day' ? ICONS.chart : x.l === 'Lines' ? ICONS.code : x.l === 'Sessions' ? ICONS.target : ICONS.streak}</div><div class="insight-body"><div class="insight-label">${x.l}</div><div class="insight-value">${x.v}</div>${x.cl ? `<div class="insight-change ${x.c > 0 ? 'insight-up' : x.c < 0 ? 'insight-down' : 'insight-neutral'}">${x.cl}</div>` : ''}</div></div>`).join('');
    const projCount = Object.keys(projects).length;
    const tcClass = tr > 10 ? 'trend-up' : tr < -10 ? 'trend-down' : 'trend-neutral';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>DevPulse</title><style>${CSS}</style></head><body>
<div class="c">
<div class="hero-row ai">
<div class="hero"><div class="hero-value" id="dv-time" aria-live="polite">${formatDuration(tm)}</div><div class="hero-label">Today${activeProject ? ' &middot; ' + getProjectName(activeProject) : ''}${git.available ? ' &middot; ' + git.branch : ''}</div><div class="hero-trend ${tcClass}">${tr > 0 ? '+' + tr : tr}% vs yesterday</div></div>
<div class="metric"><div class="metric-value" id="dv-streak">${st} days</div><div class="metric-label">Current Streak</div></div>
<div class="metric"><div class="metric-value" id="dv-deep">${formatDuration(tm > 25 * 60000 ? Math.floor(tm * 0.4) : 0)}</div><div class="metric-label">Deep Work</div></div>
</div>
<div class="card ai d1"><div class="card-header"><span class="card-title">Goals</span><div class="tabs"><button class="tab active" onclick="switchTab('daily')" aria-pressed="true">Daily</button><button class="tab" onclick="switchTab('weekly')" aria-pressed="false">Weekly</button><button class="tab" onclick="switchTab('monthly')" aria-pressed="false">Monthly</button></div></div><div id="tab-daily" class="tab-content active">${goalBar(g.daily.time.label, dt, g.daily.time.target, g.daily.time.unit, dtD)}${goalBar(g.daily.lines.label, tl, g.daily.lines.target, g.daily.lines.unit, dlD)}${goalBar(g.daily.sessions.label, ts, g.daily.sessions.target, g.daily.sessions.unit, dsD)}</div><div id="tab-weekly" class="tab-content">${goalBar(g.weekly.time.label, wt, g.weekly.time.target, g.weekly.time.unit, wtD)}${goalBar(g.weekly.days.label, wd, g.weekly.days.target, g.weekly.days.unit, wdD)}</div><div id="tab-monthly" class="tab-content">${goalBar(g.monthly.time.label, mt, g.monthly.time.target, g.monthly.time.unit, mtD)}${goalBar(g.monthly.days.label, md, g.monthly.days.target, g.monthly.days.unit, mdD)}</div></div>
<div class="wrapped-banner ai d2" onclick="openWrapped()" tabindex="0" role="button" aria-label="Open Developer Wrapped" onkeydown="if(event.key==='Enter')openWrapped()"><div class="wrapped-badge">Annual Report</div><div class="wrapped-big">2026</div><div class="wrapped-sub">View your year in code</div></div>
<div class="card ai d2"><div class="card-header"><span class="card-title">Git Activity</span>${git.available ? `<span class="card-sub">${git.repoName}</span>` : '<span class="card-sub">Not available</span>'}</div>${gitHTML()}</div>
<div class="card ai d2"><div class="card-header"><span class="card-title">This Week</span><span class="card-sub">vs last week</span></div><div class="insights-grid">${insightsHTML}</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--g)" class="ai d3"><div class="card"><div class="card-header"><span class="card-title">Activity</span><span class="card-sub">6 months</span></div><div class="hmg">${hm}</div><div class="leg">Less<div class="legc" style="background:var(--vscode-editor-inactiveSelectionBackground,#3a3d41)"></div><div class="legc hl1"></div><div class="legc hl2"></div><div class="legc hl3"></div><div class="legc hl4"></div>More</div></div><div class="card"><div class="card-header"><span class="card-title">This Week</span></div><div class="bars">${wb}</div></div></div>
<div class="card ai d3"><div class="card-header"><span class="card-title">Projects</span><span class="card-sub">${projCount} tracked</span></div><div class="sort-row"><button class="sort-btn active" onclick="sortProjects('time')">Most Time</button><button class="sort-btn" onclick="sortProjects('recent')">Recent</button><button class="sort-btn" onclick="sortProjects('active')">Most Active</button></div><div id="project-list">${projectListHTML('time')}</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--g)" class="ai d3"><div class="card"><div class="card-header"><span class="card-title">Languages</span><span class="card-sub">Today</span></div>${lr}</div><div class="card"><div class="card-header"><span class="card-title">Overview</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><div class="metric-value" style="font-size:18px" id="dv-lines">${formatNumber(tl)}</div><div class="metric-label">Lines today</div></div><div><div class="metric-value" style="font-size:18px">${formatNumber(sessionSaves)}</div><div class="metric-label">Saves</div></div><div><div class="metric-value" style="font-size:18px">${th}h</div><div class="metric-label">All time</div></div><div><div class="metric-value" style="font-size:18px">${bs}d</div><div class="metric-label">Best streak</div></div></div></div></div>
<div class="footer ai d4"><div class="footer-summary">All time <strong>${th}h</strong> &middot; <strong>${formatNumber(tll)}</strong> lines${git.available ? ` &middot; <strong>${git.commitsTotal}</strong> commits` : ''}</div><button class="btn" onclick="openShareModal()">Share</button></div>
</div>
<div class="modal-overlay" id="shareModal" role="dialog" aria-modal="true" aria-label="Share your progress"><div class="modal"><div class="modal-title">Share your progress</div><div class="template-list"><div class="template-item selected" onclick="selectTemplate('professional',this)"><div class="template-preview tp-pro">Pro</div><div class="template-info"><div class="template-name">Professional</div><div class="template-desc">Clean layout for LinkedIn and portfolios</div></div></div><div class="template-item" onclick="selectTemplate('minimal',this)"><div class="template-preview tp-min">Min</div><div class="template-info"><div class="template-name">Minimal</div><div class="template-desc">Typography-focused, black and white</div></div></div><div class="template-item" onclick="selectTemplate('github',this)"><div class="template-preview tp-gh">Git</div><div class="template-info"><div class="template-name">GitHub</div><div class="template-desc">Developer aesthetic for your profile</div></div></div><div class="template-item" onclick="selectTemplate('wrapped',this)"><div class="template-preview tp-wr">Wrp</div><div class="template-info"><div class="template-name">Wrapped</div><div class="template-desc">Annual report with summary stats</div></div></div></div><div class="modal-actions"><button class="btn btn-secondary" onclick="closeShareModal()">Cancel</button><button class="btn" onclick="generateShareCard()">Copy to Clipboard</button></div></div></div>
<script>
const vscode = acquireVsCodeApi(); let selectedTemplate = 'professional';
function openShareModal(){document.getElementById('shareModal').classList.add('open')}
function closeShareModal(){document.getElementById('shareModal').classList.remove('open')}
function selectTemplate(t,el){selectedTemplate=t;document.querySelectorAll('.template-item').forEach(e=>e.classList.remove('selected'));el.classList.add('selected')}
function generateShareCard(){vscode.postMessage({t:'shareCard',template:selectedTemplate});closeShareModal()}
function openWrapped(){vscode.postMessage({t:'openWrapped',period:'yearly'})}
function switchTab(t){document.querySelectorAll('.tab').forEach(e=>{e.classList.remove('active');e.setAttribute('aria-pressed','false')});document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.getElementById('tab-'+t).classList.add('active');event.target.classList.add('active');event.target.setAttribute('aria-pressed','true')}
function sortProjects(s){vscode.postMessage({t:'sortProjects',sort:s});document.querySelectorAll('.sort-btn').forEach(e=>e.classList.remove('active'));event.target.classList.add('active')}
// Smooth updates - only update changed values, no DOM flicker
window.addEventListener('message',function(e){
 if(e.data.t==='u'){
  var t=document.getElementById('dv-time'), s=document.getElementById('dv-streak'), l=document.getElementById('dv-lines'), d=document.getElementById('dv-deep');
  if(t&&t.textContent!==e.data.time) t.textContent=e.data.time;
  if(s&&s.textContent!==e.data.streak+' days') s.textContent=e.data.streak+' days';
  if(l&&l.textContent!==e.data.lines) l.textContent=e.data.lines;
  if(d&&d.textContent!==e.data.deep) d.textContent=e.data.deep;
 }
 if(e.data.t==='projects'){ var pl=document.getElementById('project-list'); if(pl) pl.innerHTML=e.data.html; }
});
setInterval(function(){vscode.postMessage({t:'poll'})},5000);
document.getElementById('shareModal').addEventListener('click',function(e){if(e.target===this)closeShareModal()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeShareModal()});
</script></body></html>`;
}
// ─── Share Cards (Unique per template) ──
function buildShareCardHTML(template) {
    const th = totalHours();
    const tl = totalLines();
    const bs = bestStreak();
    const cs = getStreak();
    const topLang = Object.entries(todayLangs()).sort((a, b) => b[1] - a[1])[0];
    const pc = Object.keys(projects).length;
    const git = getGitStats();
    const uid = vscode.env.machineId.slice(0, 8);
    const ds = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const cards = {
        professional: `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#1a1a2e;color:#e4e4ed;width:1200px;height:630px}.card{width:100%;height:100%;padding:56px 64px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(135deg,#1e1e36,#16213e);border:1px solid rgba(255,255,255,0.06)}.top{display:flex;justify-content:space-between;align-items:flex-start}.user{font-size:15px;color:#8888a0}.brand{font-size:28px;font-weight:700;color:#7c8aff;letter-spacing:-0.02em}.stats{display:flex;gap:56px;justify-content:center}.stat{text-align:center}.stat-val{font-size:46px;font-weight:700;color:#7c8aff;letter-spacing:-0.02em;font-family:'Cascadia Code',monospace}.stat-lbl{font-size:12px;color:#8888a0;margin-top:6px;text-transform:uppercase;letter-spacing:0.05em}.bottom{display:flex;justify-content:space-between;align-items:flex-end;color:#8888a0;font-size:12px}.bottom strong{color:#7c8aff;font-weight:500}</style></head><body><div class="card"><div class="top"><span class="user">${uid}${git.available ? ' &middot; ' + git.repoName : ''}</span><span class="brand">DevPulse</span></div><div class="stats"><div class="stat"><div class="stat-val">${th}h</div><div class="stat-lbl">Total coded</div></div><div class="stat"><div class="stat-val">${bs}d</div><div class="stat-lbl">Best streak</div></div><div class="stat"><div class="stat-val">${formatNumber(tl)}</div><div class="stat-lbl">Lines written</div></div>${git.available ? `<div class="stat"><div class="stat-val">${git.commitsTotal}</div><div class="stat-lbl">Commits</div></div>` : ''}</div><div class="bottom"><span>${ds} &middot; ${topLang ? topLang[0] : '—'} &middot; ${pc} projects</span><span>Tracked by <strong>DevPulse</strong></span></div></div></body></html>`,
        minimal: `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111827;width:1200px;height:630px}.card{width:100%;height:100%;padding:64px 72px;display:flex;flex-direction:column;justify-content:center;gap:48px}.title{font-size:16px;font-weight:400;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase}.stat-row{display:flex;gap:64px}.stat{display:flex;flex-direction:column}.stat-val{font-size:64px;font-weight:200;letter-spacing:-0.03em;font-family:'Cascadia Code',monospace}.stat-lbl{font-size:12px;color:#6b7280;margin-top:4px}.line{border-top:1px solid #e5e7eb;padding-top:20px;font-size:12px;color:#9ca3af}</style></head><body><div class="card"><div class="title">Developer report</div><div class="stat-row"><div class="stat"><div class="stat-val">${th}h</div><div class="stat-lbl">Total coding time</div></div><div class="stat"><div class="stat-val">${cs}d</div><div class="stat-lbl">Current streak</div></div><div class="stat"><div class="stat-val">${formatNumber(tl)}</div><div class="stat-lbl">Lines written</div></div></div><div class="line">${ds} &middot; ${uid} &middot; DevPulse</div></div></body></html>`,
        github: `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1117;color:#c9d1d9;width:1200px;height:630px}.card{width:100%;height:100%;padding:48px 56px;background:#161b22;border:1px solid #30363d;border-radius:12px;display:flex;flex-direction:column;justify-content:center;gap:40px}.header{display:flex;align-items:center;gap:14px}.avatar{width:44px;height:44px;border-radius:50%;background:#30363d;display:flex;align-items:center;justify-content:center;font-size:18px}.name{font-weight:600;font-size:16px}.handle{font-size:12px;color:#8b949e}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}.cell{text-align:center;padding:16px;background:#0d1117;border:1px solid #21262d;border-radius:8px}.cell-val{font-size:32px;font-weight:600;color:#58a6ff;font-family:'Cascadia Code',monospace}.cell-lbl{font-size:10px;color:#8b949e;margin-top:4px;text-transform:uppercase}.footer{border-top:1px solid #30363d;padding-top:16px;font-size:12px;color:#8b949e}</style></head><body><div class="card"><div class="header"><div class="avatar">D</div><div><div class="name">Developer</div><div class="handle">${uid} &middot; ${ds}</div></div></div><div class="grid"><div class="cell"><div class="cell-val">${th}h</div><div class="cell-lbl">Coding</div></div><div class="cell"><div class="cell-val">${bs}d</div><div class="cell-lbl">Best streak</div></div><div class="cell"><div class="cell-val">${formatNumber(tl)}</div><div class="cell-lbl">Lines</div></div><div class="cell"><div class="cell-val">${git.available ? git.commitsTotal : pc}</div><div class="cell-lbl">${git.available ? 'Commits' : 'Projects'}</div></div></div><div class="footer">Tracked by DevPulse &middot; ${git.available ? git.repoName + ' &middot; ' + git.branch : ''}All data stored locally</div></div></body></html>`,
        wrapped: `<!DOCTYPE html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;width:1200px;height:630px}.card{width:100%;height:100%;padding:56px;background:rgba(255,255,255,0.06);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:32px}.badge{padding:6px 20px;border-radius:20px;background:rgba(255,255,255,0.12);font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase}.year{font-size:80px;font-weight:800;letter-spacing:-0.04em}.sub{font-size:18px;opacity:0.8}.row{display:flex;gap:48px}.s{text-align:center}.sv{font-size:42px;font-weight:700;font-family:'Cascadia Code',monospace}.sl{font-size:11px;opacity:0.7;margin-top:4px;text-transform:uppercase}.ft{font-size:11px;opacity:0.5}</style></head><body><div class="card"><div class="badge">Annual report</div><div class="year">${th}h</div><div class="sub">of coding this year</div><div class="row"><div class="s"><div class="sv">${bs}d</div><div class="sl">Best streak</div></div><div class="s"><div class="sv">${formatNumber(tl)}</div><div class="sl">Lines</div></div><div class="s"><div class="sv">${pc}</div><div class="sl">Projects</div></div><div class="s"><div class="sv">${topLang ? topLang[0] : '—'}</div><div class="sl">Top language</div></div></div><div class="ft">${ds} &middot; ${uid} &middot; DevPulse</div></div></body></html>`
    };
    return cards[template] || cards.professional;
}
// ─── Wrapped ────────────────────────────
function buildWrappedHTML(period) {
    const th = totalHours();
    const tl = totalLines();
    const bs = bestStreak();
    const topLang = Object.entries(todayLangs()).sort((a, b) => b[1] - a[1])[0];
    const tp = Object.values(projects).sort((a, b) => b.totalMs - a.totalMs)[0];
    const git = getGitStats();
    const title = period === 'yearly' ? '2026' : new Date().toLocaleString('default', { month: 'long' });
    const st = period === 'yearly' ? 'Your Year in Code' : 'Your Month in Code';
    const slides = git.available && git.commitsTotal > 0 ? 8 : 7;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>DevPulse Wrapped</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#0d1117;color:#c9d1d9;overflow:hidden;height:100vh}
.slide{display:none;height:100vh;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center}.slide.active{display:flex}
.sd{background:#0d1117}.sa{background:linear-gradient(180deg,#161b22,#0d1117)}.sp{background:linear-gradient(180deg,#1a1333,#0d1117)}
.wl{font-size:13px;text-transform:uppercase;letter-spacing:0.15em;color:#8b949e;margin-bottom:12px}
.wb{font-size:88px;font-weight:800;letter-spacing:-0.04em;line-height:1;background:linear-gradient(135deg,#58a6ff,#a371f7);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ws{font-size:18px;color:#8b949e;margin-top:8px;font-weight:300}
.wv{font-size:64px;font-weight:700;letter-spacing:-0.03em;line-height:1}.wl2{font-size:15px;color:#8b949e;margin-top:6px}
.nav-dots{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:100}
.nd{width:6px;height:6px;border-radius:50%;background:#30363d;cursor:pointer;transition:all 0.2s;border:none}
.nd.active{background:#58a6ff;width:20px;border-radius:3px}
.na{position:fixed;top:50%;transform:translateY(-50%);font-size:24px;color:#8b949e;cursor:pointer;z-index:100;background:none;border:none;padding:12px 16px}.na:hover{color:#c9d1d9}.np{left:8px}.nn{right:8px}
@keyframes fu{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.anim{animation:fu 0.5s ease forwards;opacity:0}.ad1{animation-delay:0.08s}.ad2{animation-delay:0.16s}.ad3{animation-delay:0.24s}
@media(max-width:600px){.wb{font-size:56px}.wv{font-size:40px}}
</style></head><body>
<div class="slide sa active" id="s0"><div class="anim"><div class="wl">Developer Wrapped</div></div><div class="anim ad1"><div class="wb">${title}</div></div><div class="anim ad2"><div class="ws">${st}</div></div></div>
<div class="slide sd" id="s1"><div class="anim"><div class="wl">You coded for</div></div><div class="anim ad1"><div class="wv" style="color:#58a6ff">${th}h</div></div><div class="anim ad2"><div class="wl2">${formatNumber(tl)} lines written</div></div></div>
<div class="slide sd" id="s2"><div class="anim"><div class="wl">Your dedication</div></div><div class="anim ad1"><div class="wv">${bs}d</div></div><div class="anim ad2"><div class="wl2">longest streak</div></div></div>
<div class="slide sd" id="s3"><div class="anim"><div class="wl">Top language</div></div><div class="anim ad1"><div class="wv" style="color:#a371f7">${topLang ? topLang[0] : '—'}</div></div></div>
<div class="slide sd" id="s4"><div class="anim"><div class="wl">Main project</div></div><div class="anim ad1"><div class="wv" style="font-size:44px;color:#3fb950">${tp ? tp.name : '—'}</div></div><div class="anim ad2"><div class="wl2">${tp ? Math.floor(tp.totalMs / 3600000) : 0}h spent</div></div></div>
${git.available && git.commitsTotal > 0 ? `<div class="slide sd" id="s5"><div class="anim"><div class="wl">You shipped</div></div><div class="anim ad1"><div class="wv" style="color:#3fb950">${git.commitsTotal}</div></div><div class="anim ad2"><div class="wl2">commits</div></div></div>` : ''}
<div class="slide sa" id="s${slides - 2}"><div class="anim"><div class="wv" style="color:#f78166">Keep building.</div></div></div>
<div class="slide sd" id="s${slides - 1}"><div class="anim"><div class="wb" style="font-size:44px">See you next ${period === 'yearly' ? 'year' : 'month'}.</div></div><div class="anim ad2"><div style="color:#484f58;font-size:11px;margin-top:24px">Tracked by <strong style="color:#8b949e">DevPulse</strong> &middot; All data stored locally</div></div></div>
<button class="na np" onclick="pv()" aria-label="Previous">&#8592;</button><button class="na nn" onclick="nx()" aria-label="Next">&#8594;</button><div class="nav-dots" id="nd"></div>
<script>var ts=${slides},c=0;function sh(n){document.querySelectorAll('.slide').forEach(function(s){s.classList.remove('active')});document.getElementById('s'+n).classList.add('active');document.querySelectorAll('.nd').forEach(function(d,i){d.classList.toggle('active',i===n)})}function nx(){c=(c+1)%ts;sh(c)}function pv(){c=(c-1+ts)%ts;sh(c)}var nd=document.getElementById('nd');for(var i=0;i<ts;i++){var d=document.createElement('button');d.className='nd'+(i===0?' active':'');d.setAttribute('aria-label','Slide '+(i+1));d.onclick=(function(idx){return function(){c=idx;sh(c)}})(i);nd.appendChild(d)}document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowDown')nx();if(e.key==='ArrowLeft'||e.key==='ArrowUp')pv()});</script></body></html>`;
}
// ─── Activate ────────────────────────────
function activate(context) {
    storagePath = context.globalStorageUri.fsPath;
    if (!fs.existsSync(storagePath))
        fs.mkdirSync(storagePath, { recursive: true });
    loadData();
    activeProject = getActiveWorkspace();
    if (activeProject)
        ensureProject(activeProject);
    disposables.push(vscode.window.onDidChangeActiveTextEditor(() => { const np = getActiveWorkspace(); if (np && np !== activeProject) {
        activeProject = np;
        ensureProject(activeProject);
        cachedGitStats = null;
    } }));
    disposables.push(vscode.workspace.onDidChangeTextDocument(e => { for (const c of e.contentChanges)
        sessionLines += Math.max(0, c.text.split('\n').length - 1); lastActivity = Date.now(); if (!focusTimer && Date.now() - lastActivity < IDLE_TIMEOUT_MS) {
        focusStart = Date.now();
        focusTimer = setInterval(() => { if (Date.now() - focusStart >= FOCUS_SESSION_MIN_MS) {
            focusSessions++;
            focusStart = Date.now();
        } }, 60000);
    } }), vscode.workspace.onDidSaveTextDocument(doc => { sessionFiles++; sessionSaves++; sessionLanguages[doc.languageId] = (sessionLanguages[doc.languageId] || 0) + 1; cachedGitStats = null; }), vscode.window.onDidChangeWindowState(s => { if (s.focused)
        lastActivity = Date.now(); }));
    activeTimer = setInterval(() => { if (Date.now() - lastActivity < IDLE_TIMEOUT_MS) {
        sessionMs += ACTIVE_TICK_MS;
        if (activeProject) {
            const p = projects[activeProject];
            if (p) {
                p.totalMs += ACTIVE_TICK_MS;
                p.daysActive.add(todayStr());
            }
        }
    } if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS && focusTimer) {
        clearInterval(focusTimer);
        focusTimer = null;
    } if (panel)
        panel.webview.postMessage({ t: 'u', time: formatDuration(todayMs()), streak: String(getStreak()), lines: formatNumber(todayLines()), deep: formatDuration(todayMs() > 25 * 60000 ? Math.floor(todayMs() * 0.4) : 0) }); }, ACTIVE_TICK_MS);
    saveTimer = setInterval(() => saveData(), SAVE_INTERVAL_MS);
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'devpulse.showDashboard';
    statusBar.text = '$(pulse) DevPulse';
    statusBar.show();
    disposables.push(statusBar);
    statusTimer = setInterval(() => { const m = Math.floor(todayMs() / 60000); statusBar.text = m > 0 ? `$(flame) ${m}m` : '$(pulse) DevPulse'; }, STATUS_UPDATE_MS);
    disposables.push(vscode.commands.registerCommand('devpulse.showDashboard', () => { if (panel) {
        panel.reveal();
    }
    else {
        panel = vscode.window.createWebviewPanel('devpulse', 'DevPulse', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        panel.onDidDispose(() => { panel = null; });
        panel.webview.onDidReceiveMessage(m => { if (m.t === 'shareCard') {
            vscode.env.clipboard.writeText(buildShareCardHTML(m.template));
            vscode.window.showInformationMessage('Share card copied to clipboard');
        } if (m.t === 'poll' && panel) { /* Smooth update via postMessage, no full reload */ } if (m.t === 'sortProjects' && panel)
            panel.webview.postMessage({ t: 'projects', html: projectListHTML(m.sort) }); if (m.t === 'openWrapped' && panel)
            panel.webview.html = buildWrappedHTML(m.period ?? 'yearly'); });
    } panel.webview.html = buildDashboardHTML(); }), vscode.commands.registerCommand('devpulse.wrapped', () => { if (panel) {
        panel.reveal();
    }
    else {
        panel = vscode.window.createWebviewPanel('devpulse', 'DevPulse Wrapped', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        panel.onDidDispose(() => { panel = null; });
    } panel.webview.html = buildWrappedHTML('yearly'); }), vscode.commands.registerCommand('devpulse.wrappedMonthly', () => { if (panel) {
        panel.reveal();
    }
    else {
        panel = vscode.window.createWebviewPanel('devpulse', 'DevPulse Wrapped', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
        panel.onDidDispose(() => { panel = null; });
    } panel.webview.html = buildWrappedHTML('monthly'); }), vscode.commands.registerCommand('devpulse.shareCard', () => { vscode.env.clipboard.writeText(buildShareCardHTML('professional')); vscode.window.showInformationMessage('Share card copied to clipboard'); }), vscode.commands.registerCommand('devpulse.exportData', () => { saveData(); const fp = path.join(storagePath, `devpulse-export-${todayStr()}.json`); fs.writeFileSync(fp, JSON.stringify(savedData, null, 2)); vscode.window.showInformationMessage('Data exported'); }));
}
function deactivate() { saveData(); disposeAll(); }
