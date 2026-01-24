import * as vscode from 'vscode';
import { GitProvider } from '../providers/gitProvider';
import { SvnProvider } from '../providers/svnProvider';
import { AIService } from '../services/aiService';
import type { AIProvider } from '../types';

function getPluginConfig() {
  const config = vscode.workspace.getConfiguration('dailyReport');
  return {
    aiProvider: config.get<AIProvider>('aiProvider', 'deepseek'),
    aiApiKey: config.get<string>('aiApiKey', ''),
    aiModel: config.get<string>('aiModel', 'deepseek-chat'),
  };
}

function getWorkspacePath(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

type VCSProvider = { type: 'git'; provider: GitProvider } | { type: 'svn'; provider: SvnProvider };

async function detectVCS(workspacePath: string): Promise<VCSProvider | null> {
  const gitProvider = new GitProvider();
  if (await gitProvider.isRepository(workspacePath)) {
    return { type: 'git', provider: gitProvider };
  }
  const svnProvider = new SvnProvider();
  if (await svnProvider.isRepository(workspacePath)) {
    return { type: 'svn', provider: svnProvider };
  }
  return null;
}

export async function generateCommitMessage(): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    vscode.window.showErrorMessage('请先打开一个工作区');
    return;
  }

  const vcs = await detectVCS(workspacePath);
  if (!vcs) {
    vscode.window.showErrorMessage('当前目录不是 Git 或 SVN 仓库');
    return;
  }

  const config = getPluginConfig();
  if (!config.aiApiKey) {
    vscode.window.showErrorMessage('请先配置 AI API Key');
    return;
  }

  // SVN 没有 staged/unstaged 概念
  let scopeValue = 'all';
  if (vcs.type === 'git') {
    const scope = await vscode.window.showQuickPick(
      [
        { label: '已暂存的变更 (Staged)', value: 'staged' },
        { label: '未暂存的变更 (Unstaged)', value: 'unstaged' },
        { label: '所有变更 (All)', value: 'all' }
      ],
      { placeHolder: '选择要分析的变更范围' }
    );
    if (!scope) return;
    scopeValue = scope.value;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: '正在生成 Commit Message...' },
    async () => {
      try {
        let diff = '';
        if (vcs.type === 'git') {
          if (scopeValue === 'staged' || scopeValue === 'all') {
            diff += await vcs.provider.getDiff(workspacePath, true);
          }
          if (scopeValue === 'unstaged' || scopeValue === 'all') {
            diff += await vcs.provider.getDiff(workspacePath, false);
          }
        } else {
          diff = await vcs.provider.getDiff(workspacePath);
        }

        if (!diff.trim()) {
          vscode.window.showWarningMessage('没有检测到代码变更');
          return;
        }

        const aiService = new AIService(config.aiProvider, config.aiApiKey, config.aiModel);
        const message = await aiService.generateCommitMessage(diff);

        let filled = false;

        if (vcs.type === 'git') {
          // Git: 直接填充到 Git 面板输入框，无需确认
          try {
            const gitExt = vscode.extensions.getExtension('vscode.git');
            if (gitExt) {
              const gitAPI = gitExt.exports?.getAPI?.(1);
              if (gitAPI?.repositories?.[0]?.inputBox) {
                gitAPI.repositories[0].inputBox.value = message;
                vscode.window.showInformationMessage('Commit Message 已填充到 Git 面板');
                filled = true;
              }
            }
          } catch {
            // 忽略错误，使用备用方案
          }

          // 备用：复制到剪贴板
          if (!filled) {
            await vscode.env.clipboard.writeText(message);
            vscode.window.showInformationMessage('Commit Message 已复制到剪贴板');
          }
        } else {
          // SVN: 保持原有逻辑，让用户编辑确认
          const edited = await vscode.window.showInputBox({
            prompt: '确认或编辑 Commit Message',
            value: message,
            valueSelection: [0, message.indexOf('\n') > 0 ? message.indexOf('\n') : message.length]
          });

          if (edited) {
            try {
              // SVN: 尝试通过 SVN 扩展 API 设置 inputBox
              const svnExt = vscode.extensions.getExtension('johnstoncode.svn-scm');
              if (svnExt) {
                if (!svnExt.isActive) {
                  await svnExt.activate();
                }
                const svnAPI = svnExt.exports;
                if (svnAPI) {
                  const repo = svnAPI?.repositories?.[0]
                    || svnAPI?.model?.repositories?.[0]
                    || (typeof svnAPI?.getAPI === 'function' ? svnAPI.getAPI(1)?.repositories?.[0] : null);

                  if (repo?.inputBox) {
                    repo.inputBox.value = edited;
                    vscode.window.showInformationMessage('Commit Message 已填充到 SVN 面板');
                    filled = true;
                  }
                }
              }

              // SVN 扩展不暴露 API，复制到剪贴板并打开 SCM 视图
              if (!filled) {
                await vscode.env.clipboard.writeText(edited);
                await vscode.commands.executeCommand('workbench.view.scm');
                await vscode.commands.executeCommand('workbench.scm.focus');
                vscode.window.showInformationMessage('Commit Message 已复制到剪贴板，请按 Cmd+V 粘贴');
              }
            } catch {
              // 备用：复制到剪贴板
              await vscode.env.clipboard.writeText(edited);
              vscode.window.showInformationMessage('Commit Message 已复制到剪贴板');
            }
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`生成失败: ${error}`);
      }
    }
  );
}
