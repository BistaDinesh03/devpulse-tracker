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
exports.isGitAvailable = isGitAvailable;
exports.isGitRepo = isGitRepo;
exports.getBranch = getBranch;
exports.getRepoName = getRepoName;
exports.getGitStats = getGitStats;
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
/**
 * Get the user's default shell for the current platform.
 * Returns the appropriate shell path for shell: option in execSync.
 */
function getShell() {
    if (os.platform() === 'win32') {
        return process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/sh';
}
/**
 * Execute a git command in the given repository directory.
 * Returns trimmed stdout, or empty string on failure.
 * Suppresses stderr by default to avoid noise when git is not available.
 */
function git(args, cwd) {
    try {
        const result = (0, child_process_1.execFileSync)('git', args, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'], // capture stderr separately
            shell: getShell(),
            windowsHide: true,
        });
        return result.trim();
    }
    catch (error) {
        // Git command failed - return empty string silently
        // This handles: no git repo, no commits, etc.
        return '';
    }
}
/**
 * Execute a git command that needs shell features (like pipes).
 * Uses the platform's shell for compatibility.
 */
function gitShell(command, cwd) {
    try {
        const result = (0, child_process_1.execSync)(command, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: getShell(),
            windowsHide: true,
        });
        return result.trim();
    }
    catch (error) {
        return '';
    }
}
/**
 * Count lines in a string. Cross-platform replacement for `wc -l`.
 */
function countLines(text) {
    if (!text || text.length === 0)
        return 0;
    return text.split('\n').filter(line => line.length > 0).length;
}
/**
 * Check if git is available on the system.
 */
function isGitAvailable() {
    try {
        (0, child_process_1.execFileSync)('git', ['--version'], {
            stdio: 'pipe',
            windowsHide: true,
        });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Check if a directory is a git repository.
 */
function isGitRepo(dirPath) {
    try {
        (0, child_process_1.execFileSync)('git', ['rev-parse', '--git-dir'], {
            cwd: dirPath,
            stdio: 'pipe',
            windowsHide: true,
        });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get the current branch name.
 */
function getBranch(repoPath) {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
}
/**
 * Get the repository name from the path.
 */
function getRepoName(repoPath) {
    return path.basename(repoPath);
}
/**
 * Get the git user name for filtering commits.
 */
function getUserName(repoPath) {
    try {
        return git(['config', 'user.name'], repoPath) || '';
    }
    catch {
        return '';
    }
}
/**
 * Count commits in a date range by the current user.
 */
function countCommitsByAuthor(repoPath, since, until) {
    const author = getUserName(repoPath);
    if (!author)
        return 0;
    const args = ['log', '--oneline'];
    if (since) {
        args.push(`--since=${since}`);
    }
    if (until) {
        args.push(`--until=${until}`);
    }
    args.push(`--author=${author}`);
    const output = git(args, repoPath);
    return countLines(output);
}
/**
 * Get total commits by the current user across all branches.
 */
function countTotalCommits(repoPath) {
    const author = getUserName(repoPath);
    if (!author)
        return 0;
    const output = git(['rev-list', '--count', 'HEAD', `--author=${author}`], repoPath);
    const num = parseInt(output, 10);
    return isNaN(num) ? 0 : num;
}
/**
 * Get count of files changed (unstaged changes).
 */
function countFilesChanged(repoPath) {
    const output = git(['diff', '--name-only', 'HEAD'], repoPath);
    return countLines(output);
}
/**
 * Get recent commit messages.
 */
function getRecentMessages(repoPath, count = 5) {
    const author = getUserName(repoPath);
    if (!author)
        return [];
    const output = git(['log', `-${count}`, '--pretty=format:%s', `--author=${author}`], repoPath);
    if (!output)
        return [];
    return output.split('\n').filter(msg => msg.length > 0);
}
/**
 * Main function to get all git statistics.
 * Returns null if git is not available or not a repo.
 */
function getGitStats(repoPath) {
    if (!isGitAvailable())
        return null;
    if (!isGitRepo(repoPath))
        return null;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // Start of current week (Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStr = weekStart.toISOString().slice(0, 10);
    // Start of current month
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return {
        available: true,
        branch: getBranch(repoPath),
        repoName: getRepoName(repoPath),
        commitsToday: countCommitsByAuthor(repoPath, `${today}T00:00:00`, `${today}T23:59:59`),
        commitsWeek: countCommitsByAuthor(repoPath, `${weekStr}T00:00:00`),
        commitsMonth: countCommitsByAuthor(repoPath, `${monthStr}T00:00:00`),
        commitsTotal: countTotalCommits(repoPath),
        filesChanged: countFilesChanged(repoPath),
        recentMessages: getRecentMessages(repoPath, 5),
    };
}
