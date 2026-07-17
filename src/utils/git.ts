import { execSync, execFileSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';

/**
 * Get the user's default shell for the current platform.
 * Returns the appropriate shell path for shell: option in execSync.
 */
function getShell(): string {
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
function git(args: string[], cwd: string): string {
    try {
        const result = execFileSync('git', args, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'], // capture stderr separately
            shell: getShell(),
            windowsHide: true,
        });
        return result.trim();
    } catch (error: unknown) {
        // Git command failed - return empty string silently
        // This handles: no git repo, no commits, etc.
        return '';
    }
}

/**
 * Execute a git command that needs shell features (like pipes).
 * Uses the platform's shell for compatibility.
 */
function gitShell(command: string, cwd: string): string {
    try {
        const result = execSync(command, {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: getShell(),
            windowsHide: true,
        });
        return result.trim();
    } catch (error: unknown) {
        return '';
    }
}

/**
 * Count lines in a string. Cross-platform replacement for `wc -l`.
 */
function countLines(text: string): number {
    if (!text || text.length === 0) return 0;
    return text.split('\n').filter(line => line.length > 0).length;
}

/**
 * Check if git is available on the system.
 */
export function isGitAvailable(): boolean {
    try {
        execFileSync('git', ['--version'], {
            stdio: 'pipe',
            windowsHide: true,
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if a directory is a git repository.
 */
export function isGitRepo(dirPath: string): boolean {
    try {
        execFileSync('git', ['rev-parse', '--git-dir'], {
            cwd: dirPath,
            stdio: 'pipe',
            windowsHide: true,
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the current branch name.
 */
export function getBranch(repoPath: string): string {
    return git(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
}

/**
 * Get the repository name from the path.
 */
export function getRepoName(repoPath: string): string {
    return path.basename(repoPath);
}

/**
 * Get the git user name for filtering commits.
 */
function getUserName(repoPath: string): string {
    try {
        return git(['config', 'user.name'], repoPath) || '';
    } catch {
        return '';
    }
}

/**
 * Count commits in a date range by the current user.
 */
function countCommitsByAuthor(
    repoPath: string,
    since?: string,
    until?: string
): number {
    const author = getUserName(repoPath);
    if (!author) return 0;

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
function countTotalCommits(repoPath: string): number {
    const author = getUserName(repoPath);
    if (!author) return 0;

    const output = git(['rev-list', '--count', 'HEAD', `--author=${author}`], repoPath);
    const num = parseInt(output, 10);
    return isNaN(num) ? 0 : num;
}

/**
 * Get count of files changed (unstaged changes).
 */
function countFilesChanged(repoPath: string): number {
    const output = git(['diff', '--name-only', 'HEAD'], repoPath);
    return countLines(output);
}

/**
 * Get recent commit messages.
 */
function getRecentMessages(repoPath: string, count: number = 5): string[] {
    const author = getUserName(repoPath);
    if (!author) return [];

    const output = git(
        ['log', `-${count}`, '--pretty=format:%s', `--author=${author}`],
        repoPath
    );
    
    if (!output) return [];
    return output.split('\n').filter(msg => msg.length > 0);
}

/**
 * Main function to get all git statistics.
 * Returns null if git is not available or not a repo.
 */
export function getGitStats(repoPath: string): GitStats | null {
    if (!isGitAvailable()) return null;
    if (!isGitRepo(repoPath)) return null;

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

export interface GitStats {
    available: boolean;
    branch: string;
    repoName: string;
    commitsToday: number;
    commitsWeek: number;
    commitsMonth: number;
    commitsTotal: number;
    filesChanged: number;
    recentMessages: string[];
}