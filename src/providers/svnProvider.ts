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
    const endDate = formatDate(config.dateRange.end, 'YYYY-MM-DD');

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
}
