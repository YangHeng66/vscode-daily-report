import type { IVCSProvider, VCSType } from '../types';
import { GitProvider } from './gitProvider';
import { SvnProvider } from './svnProvider';

export { GitProvider } from './gitProvider';
export { SvnProvider } from './svnProvider';

/**
 * 自动检测并返回合适的VCS提供者
 */
export async function detectVCSProvider(workspacePath: string): Promise<IVCSProvider | null> {
  const gitProvider = new GitProvider();
  const svnProvider = new SvnProvider();

  // 优先检测Git
  if (await gitProvider.isRepository(workspacePath)) {
    return gitProvider;
  }

  // 其次检测SVN
  if (await svnProvider.isRepository(workspacePath)) {
    return svnProvider;
  }

  return null;
}

/**
 * 根据指定类型获取VCS提供者
 */
export function getVCSProvider(type: VCSType): IVCSProvider {
  switch (type) {
    case 'git':
      return new GitProvider();
    case 'svn':
      return new SvnProvider();
    default:
      throw new Error(`不支持的版本控制系统: ${type}`);
  }
}
