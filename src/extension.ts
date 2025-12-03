import * as vscode from 'vscode';
import {
  generateDailyReport,
  generateWeeklyReport,
  generateCustomReport,
  openConfiguration
} from './commands/generateReport';
import { generateCommitMessage } from './commands/generateCommit';
import { generateChangeSummary } from './commands/changeSummary';

export function activate(context: vscode.ExtensionContext) {
  console.log('Daily Report Generator is now active!');

  // 注册命令
  const commands = [
    vscode.commands.registerCommand('dailyReport.generateDaily', generateDailyReport),
    vscode.commands.registerCommand('dailyReport.generateWeekly', generateWeeklyReport),
    vscode.commands.registerCommand('dailyReport.generateCustom', generateCustomReport),
    vscode.commands.registerCommand('dailyReport.configure', openConfiguration),
    vscode.commands.registerCommand('dailyReport.generateCommit', generateCommitMessage),
    vscode.commands.registerCommand('dailyReport.changeSummary', generateChangeSummary)
  ];

  context.subscriptions.push(...commands);

  // 显示欢迎信息（仅首次激活）
  const hasShownWelcome = context.globalState.get('hasShownWelcome');
  if (!hasShownWelcome) {
    vscode.window.showInformationMessage(
      'Daily Report Generator 已激活！使用命令面板 (Ctrl+Shift+P) 搜索 "Daily Report" 开始使用。',
      '配置设置'
    ).then(selection => {
      if (selection === '配置设置') {
        openConfiguration();
      }
    });
    context.globalState.update('hasShownWelcome', true);
  }
}

export function deactivate() {
  console.log('Daily Report Generator is now deactivated.');
}
