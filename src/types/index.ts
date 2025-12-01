/**
 * 提交记录接口
 */
export interface CommitRecord {
  /** 提交ID/版本号 */
  id: string;
  /** 提交信息 */
  message: string;
  /** 作者 */
  author: string;
  /** 作者邮箱 */
  email?: string;
  /** 提交日期 */
  date: Date;
  /** 修改的文件列表 */
  files?: string[];
  /** diff内容 */
  diff?: string;
}

/**
 * 版本控制系统类型
 */
export type VCSType = 'git' | 'svn';

/**
 * 日期范围
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * 报告类型
 */
export type ReportType = 'daily' | 'weekly' | 'custom';

/**
 * 报告配置
 */
export interface ReportConfig {
  type: ReportType;
  dateRange: DateRange;
  author?: string;
  includeFiles?: boolean;
  includeDiff?: boolean;
}

/**
 * AI提供商类型
 */
export type AIProvider = 'openai' | 'anthropic' | 'deepseek';

/**
 * 插件配置
 */
export interface PluginConfig {
  aiProvider: AIProvider;
  aiApiKey: string;
  aiModel: string;
  outputDirectory: string;
  authorFilter: string;
  vcsType: 'auto' | VCSType;
  language: 'zh-CN' | 'en';
}

/**
 * VCS提供者接口
 */
export interface IVCSProvider {
  /** 获取VCS类型 */
  getType(): VCSType;
  /** 检查是否为该类型的仓库 */
  isRepository(workspacePath: string): Promise<boolean>;
  /** 获取提交记录 */
  getCommits(workspacePath: string, config: ReportConfig): Promise<CommitRecord[]>;
}
