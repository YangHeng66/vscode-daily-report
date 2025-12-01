import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { CommitRecord, ReportType, DateRange, PluginConfig } from '../types';
import { AIService } from './aiService';
import { formatDate, formatDateRangeForFilename } from '../utils/dateUtils';

export class ReportGenerator {
  private config: PluginConfig;

  constructor(config: PluginConfig) {
    this.config = config;
  }

  /**
   * 生成报告
   */
  async generate(
    commits: CommitRecord[],
    reportType: ReportType,
    dateRange: DateRange,
    workspacePath: string
  ): Promise<string> {
    if (commits.length === 0) {
      throw new Error('没有找到符合条件的提交记录');
    }

    // 使用AI生成摘要
    const aiService = new AIService(
      this.config.aiProvider,
      this.config.aiApiKey,
      this.config.aiModel,
      this.config.language
    );

    const summary = await aiService.generateSummary(commits, reportType);

    // 构建完整的Markdown报告
    const report = this.buildMarkdownReport(commits, summary, reportType, dateRange);

    // 保存报告
    const filePath = await this.saveReport(report, reportType, dateRange, workspacePath);

    return filePath;
  }

  /**
   * 构建Markdown报告
   */
  private buildMarkdownReport(
    commits: CommitRecord[],
    summary: string,
    reportType: ReportType,
    dateRange: DateRange
  ): string {
    const title = this.getReportTitle(reportType, dateRange);
    const dateStr = this.getDateRangeString(dateRange);

    let report = `# ${title}\n\n`;
    report += `> 生成时间: ${formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')}\n`;
    report += `> 统计周期: ${dateStr}\n`;
    report += `> 提交数量: ${commits.length}\n\n`;
    report += `---\n\n`;

    // AI生成的摘要
    report += summary;
    report += '\n\n---\n\n';

    // 原始提交记录
    report += `## 提交记录明细\n\n`;
    report += `| 时间 | ID | 作者 | 提交信息 |\n`;
    report += `|------|-----|------|----------|\n`;

    for (const commit of commits) {
      const time = formatDate(commit.date, 'MM-DD HH:mm');
      const message = commit.message.split('\n')[0].substring(0, 50);
      report += `| ${time} | ${commit.id} | ${commit.author} | ${message} |\n`;
    }

    return report;
  }

  /**
   * 获取报告标题
   */
  private getReportTitle(reportType: ReportType, dateRange: DateRange): string {
    const lang = this.config.language;

    switch (reportType) {
      case 'daily':
        return lang === 'zh-CN'
          ? `工作日报 - ${formatDate(dateRange.start, 'YYYY年MM月DD日')}`
          : `Daily Report - ${formatDate(dateRange.start, 'YYYY-MM-DD')}`;
      case 'weekly':
        return lang === 'zh-CN'
          ? `工作周报 - ${formatDate(dateRange.start, 'MM月DD日')}-${formatDate(dateRange.end, 'MM月DD日')}`
          : `Weekly Report - ${formatDate(dateRange.start, 'MM-DD')} to ${formatDate(dateRange.end, 'MM-DD')}`;
      default:
        return lang === 'zh-CN' ? '工作报告' : 'Work Report';
    }
  }

  /**
   * 获取日期范围字符串
   */
  private getDateRangeString(dateRange: DateRange): string {
    const start = formatDate(dateRange.start, 'YYYY-MM-DD');
    const end = formatDate(dateRange.end, 'YYYY-MM-DD');
    return start === end ? start : `${start} ~ ${end}`;
  }

  /**
   * 保存报告到文件
   */
  private async saveReport(
    content: string,
    reportType: ReportType,
    dateRange: DateRange,
    workspacePath: string
  ): Promise<string> {
    // 确定输出目录
    let outputDir = this.config.outputDirectory;
    if (!path.isAbsolute(outputDir)) {
      outputDir = path.join(workspacePath, outputDir);
    }

    // 确保目录存在
    await fs.promises.mkdir(outputDir, { recursive: true });

    // 生成文件名
    const prefix = reportType === 'daily' ? 'daily' : reportType === 'weekly' ? 'weekly' : 'report';
    const dateStr = formatDateRangeForFilename(dateRange);
    const fileName = `${prefix}_${dateStr}.md`;
    const filePath = path.join(outputDir, fileName);

    // 写入文件
    await fs.promises.writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  /**
   * 生成不使用AI的简单报告（备用方案）
   */
  async generateSimple(
    commits: CommitRecord[],
    reportType: ReportType,
    dateRange: DateRange,
    workspacePath: string
  ): Promise<string> {
    if (commits.length === 0) {
      throw new Error('没有找到符合条件的提交记录');
    }

    const title = this.getReportTitle(reportType, dateRange);
    const dateStr = this.getDateRangeString(dateRange);

    let report = `# ${title}\n\n`;
    report += `> 生成时间: ${formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')}\n`;
    report += `> 统计周期: ${dateStr}\n`;
    report += `> 提交数量: ${commits.length}\n\n`;
    report += `---\n\n`;

    // 按日期分组
    const groupedByDate = this.groupCommitsByDate(commits);

    for (const [date, dayCommits] of Object.entries(groupedByDate)) {
      report += `## ${date}\n\n`;
      for (const commit of dayCommits) {
        report += `- **${commit.message.split('\n')[0]}** (${commit.id})\n`;
        if (commit.files && commit.files.length > 0) {
          report += `  - 修改文件: ${commit.files.slice(0, 3).join(', ')}`;
          if (commit.files.length > 3) {
            report += ` 等${commit.files.length}个文件`;
          }
          report += '\n';
        }
      }
      report += '\n';
    }

    // 保存报告
    let outputDir = this.config.outputDirectory;
    if (!path.isAbsolute(outputDir)) {
      outputDir = path.join(workspacePath, outputDir);
    }
    await fs.promises.mkdir(outputDir, { recursive: true });

    const prefix = reportType === 'daily' ? 'daily' : reportType === 'weekly' ? 'weekly' : 'report';
    const fileDateStr = formatDateRangeForFilename(dateRange);
    const fileName = `${prefix}_${fileDateStr}.md`;
    const filePath = path.join(outputDir, fileName);

    await fs.promises.writeFile(filePath, report, 'utf-8');

    return filePath;
  }

  /**
   * 按日期分组提交记录
   */
  private groupCommitsByDate(commits: CommitRecord[]): Record<string, CommitRecord[]> {
    const grouped: Record<string, CommitRecord[]> = {};

    for (const commit of commits) {
      const date = formatDate(commit.date, 'YYYY-MM-DD');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(commit);
    }

    return grouped;
  }
}
