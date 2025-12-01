import * as vscode from 'vscode';
import type { ReportType, ReportConfig, PluginConfig, DateRange } from '../types';
import { detectVCSProvider, getVCSProvider } from '../providers';
import { ReportGenerator } from '../services/reportGenerator';
import { getTodayRange, getThisWeekRange, parseDate } from '../utils/dateUtils';

/**
 * 获取插件配置
 */
function getPluginConfig(): PluginConfig {
  const config = vscode.workspace.getConfiguration('dailyReport');
  return {
    aiProvider: config.get('aiProvider', 'openai'),
    aiApiKey: config.get('aiApiKey', ''),
    aiModel: config.get('aiModel', 'gpt-4o-mini'),
    outputDirectory: config.get('outputDirectory', './reports'),
    authorFilter: config.get('authorFilter', ''),
    vcsType: config.get('vcsType', 'auto'),
    language: config.get('language', 'zh-CN')
  };
}

/**
 * 获取工作区路径
 */
function getWorkspacePath(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }
  return workspaceFolders[0].uri.fsPath;
}

/**
 * 生成报告的核心逻辑
 */
async function generateReport(reportType: ReportType, dateRange: DateRange): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    vscode.window.showErrorMessage('请先打开一个工作区');
    return;
  }

  const pluginConfig = getPluginConfig();

  // 检测或获取VCS提供者
  let provider;
  if (pluginConfig.vcsType === 'auto') {
    provider = await detectVCSProvider(workspacePath);
    if (!provider) {
      vscode.window.showErrorMessage('未检测到Git或SVN仓库');
      return;
    }
  } else {
    provider = getVCSProvider(pluginConfig.vcsType);
    const isRepo = await provider.isRepository(workspacePath);
    if (!isRepo) {
      vscode.window.showErrorMessage(`当前目录不是${pluginConfig.vcsType.toUpperCase()}仓库`);
      return;
    }
  }

  const reportConfig: ReportConfig = {
    type: reportType,
    dateRange,
    author: pluginConfig.authorFilter || undefined,
    includeFiles: true,
    includeDiff: false
  };

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在生成报告...',
      cancellable: false
    },
    async (progress) => {
      try {
        // 获取提交记录
        progress.report({ message: '获取提交记录...' });
        const commits = await provider.getCommits(workspacePath, reportConfig);

        if (commits.length === 0) {
          vscode.window.showWarningMessage('没有找到符合条件的提交记录');
          return;
        }

        // 生成报告
        progress.report({ message: `找到 ${commits.length} 条提交，正在生成报告...` });
        const generator = new ReportGenerator(pluginConfig);

        let filePath: string;
        if (pluginConfig.aiApiKey) {
          filePath = await generator.generate(commits, reportType, dateRange, workspacePath);
        } else {
          // 没有配置AI Key，使用简单报告
          filePath = await generator.generateSimple(commits, reportType, dateRange, workspacePath);
          vscode.window.showWarningMessage('未配置AI API Key，已生成简单报告');
        }

        // 打开生成的报告
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(`报告已生成: ${filePath}`);
      } catch (error) {
        vscode.window.showErrorMessage(`生成报告失败: ${error}`);
      }
    }
  );
}

/**
 * 生成日报命令
 */
export async function generateDailyReport(): Promise<void> {
  await generateReport('daily', getTodayRange());
}

/**
 * 生成周报命令
 */
export async function generateWeeklyReport(): Promise<void> {
  await generateReport('weekly', getThisWeekRange());
}

/**
 * 生成自定义日期范围报告
 */
export async function generateCustomReport(): Promise<void> {
  // 选择开始日期
  const startDateStr = await vscode.window.showInputBox({
    prompt: '请输入开始日期',
    placeHolder: 'YYYY-MM-DD',
    validateInput: (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return '请输入正确的日期格式 (YYYY-MM-DD)';
      }
      return null;
    }
  });

  if (!startDateStr) {
    return;
  }

  // 选择结束日期
  const endDateStr = await vscode.window.showInputBox({
    prompt: '请输入结束日期',
    placeHolder: 'YYYY-MM-DD',
    value: startDateStr,
    validateInput: (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return '请输入正确的日期格式 (YYYY-MM-DD)';
      }
      return null;
    }
  });

  if (!endDateStr) {
    return;
  }

  const dateRange: DateRange = {
    start: parseDate(startDateStr),
    end: parseDate(endDateStr + ' 23:59:59')
  };

  await generateReport('custom', dateRange);
}

/**
 * 打开配置页面
 */
export async function openConfiguration(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', 'dailyReport');
}
