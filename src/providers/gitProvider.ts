import simpleGit, { SimpleGit, LogResult } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import type { CommitRecord, ReportConfig, IVCSProvider, VCSType } from '../types';
import { formatDate } from '../utils/dateUtils';

export class GitProvider implements IVCSProvider {
  getType(): VCSType {
    return 'git';
  }

  async isRepository(workspacePath: string): Promise<boolean> {
    const gitDir = path.join(workspacePath, '.git');
    try {
      const stats = await fs.promises.stat(gitDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async getCommits(workspacePath: string, config: ReportConfig): Promise<CommitRecord[]> {
    const git: SimpleGit = simpleGit(workspacePath);

    const logOptions: Record<string, string | undefined> = {
      '--since': formatDate(config.dateRange.start, 'YYYY-MM-DD 00:00:00'),
      '--until': formatDate(config.dateRange.end, 'YYYY-MM-DD 23:59:59'),
    };

    if (config.author) {
      logOptions['--author'] = config.author;
    }

    try {
      const log: LogResult = await git.log(logOptions);
      const commits: CommitRecord[] = [];

      for (const entry of log.all) {
        const commit: CommitRecord = {
          id: entry.hash.substring(0, 8),
          message: entry.message,
          author: entry.author_name,
          email: entry.author_email,
          date: new Date(entry.date),
        };

        // 获取修改的文件列表
        if (config.includeFiles !== false) {
          try {
            const diffSummary = await git.diffSummary([`${entry.hash}^`, entry.hash]);
            commit.files = diffSummary.files.map(f => f.file);
          } catch {
            // 可能是第一个commit，没有父提交
            const diffSummary = await git.diffSummary([entry.hash]);
            commit.files = diffSummary.files.map(f => f.file);
          }
        }

        // 获取diff内容
        if (config.includeDiff) {
          try {
            const diff = await git.diff([`${entry.hash}^`, entry.hash]);
            commit.diff = diff;
          } catch {
            // 忽略diff获取失败
          }
        }

        commits.push(commit);
      }

      return commits;
    } catch (error) {
      console.error('Failed to get git commits:', error);
      throw new Error(`获取Git提交记录失败: ${error}`);
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(workspacePath: string): Promise<{ name: string; email: string } | null> {
    const git: SimpleGit = simpleGit(workspacePath);
    try {
      const name = await git.getConfig('user.name');
      const email = await git.getConfig('user.email');
      return {
        name: name.value || '',
        email: email.value || ''
      };
    } catch {
      return null;
    }
  }

  /**
   * 获取未提交变更的 diff
   */
  async getDiff(workspacePath: string, staged: boolean): Promise<string> {
    const git: SimpleGit = simpleGit(workspacePath);
    return staged ? git.diff(['--cached']) : git.diff();
  }

  /**
   * 获取变更文件状态
   */
  async getStatus(workspacePath: string): Promise<{ staged: string[]; unstaged: string[] }> {
    const git: SimpleGit = simpleGit(workspacePath);
    const status = await git.status();
    return {
      staged: [...status.staged, ...status.created.filter(f => status.staged.includes(f))],
      unstaged: [...status.modified.filter(f => !status.staged.includes(f)), ...status.not_added]
    };
  }

  /**
   * 获取最近 N 条提交的 diff
   */
  async getRecentDiff(workspacePath: string, count: number): Promise<string> {
    const git: SimpleGit = simpleGit(workspacePath);
    return git.diff([`HEAD~${count}`, 'HEAD']);
  }

  /**
   * 获取两个 commit 之间的 diff
   */
  async getRangeDiff(workspacePath: string, from: string, to: string): Promise<string> {
    const git: SimpleGit = simpleGit(workspacePath);
    return git.diff([from, to]);
  }

  /**
   * 获取最近的提交列表（用于选择）
   */
  async getRecentCommitList(workspacePath: string, count: number = 20): Promise<Array<{ hash: string; message: string; date: string }>> {
    const git: SimpleGit = simpleGit(workspacePath);
    const log = await git.log({ maxCount: count });
    return log.all.map(c => ({
      hash: c.hash.substring(0, 8),
      message: c.message.split('\n')[0].substring(0, 50),
      date: c.date.substring(0, 10)
    }));
  }
}
