import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitProvider } from '../providers/gitProvider';
import { AIService } from '../services/aiService';
import type { AIProvider } from '../types';
import { formatDate } from '../utils/dateUtils';

function getPluginConfig() {
  const config = vscode.workspace.getConfiguration('dailyReport');
  return {
    aiProvider: config.get<AIProvider>('aiProvider', 'deepseek'),
    aiApiKey: config.get<string>('aiApiKey', ''),
    aiModel: config.get<string>('aiModel', 'deepseek-chat'),
    outputDirectory: config.get<string>('outputDirectory', './reports'),
  };
}

function getWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function generateChangeSummary(): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    vscode.window.showErrorMessage('请先打开一个工作区');
    return;
  }

  const gitProvider = new GitProvider();
  if (!(await gitProvider.isRepository(workspacePath))) {
    vscode.window.showErrorMessage('当前目录不是 Git 仓库');
    return;
  }

  const config = getPluginConfig();
  if (!config.aiApiKey) {
    vscode.window.showErrorMessage('请先配置 AI API Key');
    return;
  }

  // 选择范围类型
  const rangeType = await vscode.window.showQuickPick(
    [
      { label: '最近 N 条提交', value: 'recent' },
      { label: '指定提交范围', value: 'range' }
    ],
    { placeHolder: '选择分析范围' }
  );

  if (!rangeType) return;

  let diff = '';
  let commits: Array<{ hash: string; message: string }> = [];

  if (rangeType.value === 'recent') {
    const countStr = await vscode.window.showInputBox({
      prompt: '输入要分析的提交数量',
      value: '5',
      validateInput: v => /^\d+$/.test(v) && parseInt(v) > 0 ? null : '请输入正整数'
    });
    if (!countStr) return;

    const count = parseInt(countStr);
    const commitList = await gitProvider.getRecentCommitList(workspacePath, count);
    commits = commitList.map(c => ({ hash: c.hash, message: c.message }));
    diff = await gitProvider.getRecentDiff(workspacePath, count);
  } else {
    // 获取提交列表供选择（按时间倒序，索引越小越新）
    const commitList = await gitProvider.getRecentCommitList(workspacePath, 30);
    const items = commitList.map((c, idx) => ({
      label: c.hash,
      description: c.message,
      detail: c.date,
      index: idx
    }));

    const fromCommit = await vscode.window.showQuickPick(items, { placeHolder: '选择起始提交 (较早的)' });
    if (!fromCommit) return;

    // 排除已选的 commit
    const toItems = items.filter(i => i.label !== fromCommit.label);
    const toCommit = await vscode.window.showQuickPick(toItems, { placeHolder: '选择结束提交 (较新的)' });
    if (!toCommit) return;

    // 确保 from 在 to 之前（index 大的是较早的提交）
    const [older, newer] = fromCommit.index > toCommit.index
      ? [fromCommit, toCommit]
      : [toCommit, fromCommit];

    diff = await gitProvider.getRangeDiff(workspacePath, older.label, newer.label);
    commits = commitList.filter(c => c.hash === older.label || c.hash === newer.label)
      .map(c => ({ hash: c.hash, message: c.message }));
  }

  if (!diff.trim()) {
    vscode.window.showWarningMessage('选定范围内没有代码变更');
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: '正在生成变更摘要...' },
    async () => {
      try {
        const aiService = new AIService(config.aiProvider, config.aiApiKey, config.aiModel);
        const summary = await aiService.generateChangeSummary(diff, commits);

        // 构建报告
        const report = `# 代码变更摘要\n\n> 生成时间: ${formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss')}\n> 分析范围: ${commits.map(c => c.hash).join(' → ')}\n\n---\n\n${summary}`;

        // 保存文件
        let outputDir = config.outputDirectory;
        if (!path.isAbsolute(outputDir)) {
          outputDir = path.join(workspacePath, outputDir);
        }
        await fs.promises.mkdir(outputDir, { recursive: true });

        const fileName = `change_summary_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.md`;
        const filePath = path.join(outputDir, fileName);
        await fs.promises.writeFile(filePath, report, 'utf-8');

        // 打开文件
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`变更摘要已生成: ${filePath}`);
      } catch (error) {
        vscode.window.showErrorMessage(`生成失败: ${error}`);
      }
    }
  );
}
