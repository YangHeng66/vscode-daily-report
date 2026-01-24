import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import type { CommitRecord, ReportConfig, IVCSProvider, VCSType } from '../types';
import { formatDate } from '../utils/dateUtils';

const execAsync = promisify(exec);

interface SvnLogEntry {
  revision: string;
  author: string;
  date: string;
  msg: string;
  paths?: string[];
}

export class SvnProvider implements IVCSProvider {
  getType(): VCSType {
    return 'svn';
  }

  async isRepository(workspacePath: string): Promise<boolean> {
    const svnDir = path.join(workspacePath, '.svn');
    try {
      const stats = await fs.promises.stat(svnDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async getCommits(workspacePath: string, config: ReportConfig): Promise<CommitRecord[]> {
    const startDate = formatDate(config.dateRange.start, 'YYYY-MM-DD');
    // SVN 日期范围是左闭右开的，需要将结束日期加一天才能包含当天的提交
    const endDatePlusOne = new Date(config.dateRange.end);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
    const endDate = formatDate(endDatePlusOne, 'YYYY-MM-DD');

    // 构建svn log命令
    let command = `svn log -r {${startDate}}:{${endDate}} --xml`;

    if (config.includeFiles !== false) {
      command += ' -v'; // verbose模式，包含修改的文件
    }

    try {
      const { stdout } = await execAsync(command, { cwd: workspacePath });
      const entries = this.parseXmlLog(stdout);

      // 按作者过滤
      let filteredEntries = entries;
      if (config.author) {
        filteredEntries = entries.filter(e =>
          e.author.toLowerCase().includes(config.author!.toLowerCase())
        );
      }

      return filteredEntries.map(entry => ({
        id: entry.revision,
        message: entry.msg,
        author: entry.author,
        date: new Date(entry.date),
        files: entry.paths
      }));
    } catch (error) {
      console.error('Failed to get SVN commits:', error);
      throw new Error(`获取SVN提交记录失败: ${error}`);
    }
  }

  /**
   * 解析SVN XML格式的日志输出
   */
  private parseXmlLog(xml: string): SvnLogEntry[] {
    const entries: SvnLogEntry[] = [];

    // 简单的XML解析（不依赖额外库）
    const logEntryRegex = /<logentry\s+revision="(\d+)">([\s\S]*?)<\/logentry>/g;
    const authorRegex = /<author>(.*?)<\/author>/;
    const dateRegex = /<date>(.*?)<\/date>/;
    const msgRegex = /<msg>([\s\S]*?)<\/msg>/;
    const pathRegex = /<path[^>]*>(.*?)<\/path>/g;

    let match;
    while ((match = logEntryRegex.exec(xml)) !== null) {
      const revision = match[1];
      const content = match[2];

      const authorMatch = authorRegex.exec(content);
      const dateMatch = dateRegex.exec(content);
      const msgMatch = msgRegex.exec(content);

      const entry: SvnLogEntry = {
        revision: `r${revision}`,
        author: authorMatch ? authorMatch[1] : 'unknown',
        date: dateMatch ? dateMatch[1] : new Date().toISOString(),
        msg: msgMatch ? msgMatch[1].trim() : ''
      };

      // 提取修改的文件路径
      const paths: string[] = [];
      let pathMatch;
      while ((pathMatch = pathRegex.exec(content)) !== null) {
        paths.push(pathMatch[1]);
      }
      if (paths.length > 0) {
        entry.paths = paths;
      }

      entries.push(entry);
    }

    return entries;
  }

  /**
   * 获取当前SVN用户信息
   */
  async getCurrentUser(workspacePath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('svn info --show-item last-changed-author', {
        cwd: workspacePath
      });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * 获取未提交变更的 diff
   * SVN 没有 staged/unstaged 概念，所有本地修改都视为未暂存
   */
  async getDiff(workspacePath: string, _staged?: boolean): Promise<string> {
    try {
      const { stdout } = await execAsync('svn diff', { cwd: workspacePath });
      return stdout;
    } catch (error) {
      console.error('Failed to get SVN diff:', error);
      return '';
    }
  }

  /**
   * 获取最近 N 条提交的 diff
   */
  async getRecentDiff(workspacePath: string, count: number): Promise<string> {
    try {
      // 先获取最近 N 条提交的版本号列表
      const { stdout: logOut } = await execAsync(`svn log -l ${count} --xml`, { cwd: workspacePath });
      const entries = this.parseXmlLog(logOut);

      if (entries.length === 0) {
        return '';
      }

      // 获取最早和最新的版本号（entries 已经按时间倒序排列）
      const newestRev = entries[0].revision.replace('r', '');
      const oldestRev = entries[entries.length - 1].revision.replace('r', '');

      // 获取这个范围的 diff
      const { stdout } = await execAsync(`svn diff -r ${oldestRev}:${newestRev}`, { cwd: workspacePath });
      return stdout;
    } catch (error) {
      console.error('Failed to get SVN recent diff:', error);
      return '';
    }
  }

  /**
   * 获取两个版本之间的 diff
   */
  async getRangeDiff(workspacePath: string, from: string, to: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`svn diff -r ${from}:${to}`, { cwd: workspacePath });
      return stdout;
    } catch (error) {
      console.error('Failed to get SVN range diff:', error);
      return '';
    }
  }

  /**
   * 获取最近的提交列表（用于选择）
   */
  async getRecentCommitList(workspacePath: string, count: number = 20): Promise<Array<{ hash: string; message: string; date: string }>> {
    try {
      const { stdout } = await execAsync(`svn log -l ${count} --xml`, { cwd: workspacePath });
      const entries = this.parseXmlLog(stdout);
      return entries.map(e => ({
        hash: e.revision,
        message: e.msg.split('\n')[0].substring(0, 50),
        date: e.date.substring(0, 10)
      }));
    } catch (error) {
      console.error('Failed to get SVN commit list:', error);
      return [];
    }
  }
}
