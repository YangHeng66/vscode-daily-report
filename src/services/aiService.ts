import OpenAI from 'openai';
import type { CommitRecord, AIProvider, ReportType } from '../types';

export class AIService {
  private provider: AIProvider;
  private apiKey: string;
  private model: string;
  private language: 'zh-CN' | 'en';

  constructor(provider: AIProvider, apiKey: string, model: string, language: 'zh-CN' | 'en' = 'zh-CN') {
    this.provider = provider;
    this.apiKey = apiKey;
    this.model = model;
    this.language = language;
  }

  /**
   * 生成报告摘要
   */
  async generateSummary(commits: CommitRecord[], reportType: ReportType): Promise<string> {
    if (!this.apiKey) {
      throw new Error('未配置AI API Key，请在设置中配置');
    }

    const prompt = this.buildPrompt(commits, reportType);

    switch (this.provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      case 'deepseek':
        return this.callDeepSeek(prompt);
      default:
        throw new Error(`不支持的AI提供商: ${this.provider}`);
    }
  }

  /**
   * 构建提示词
   */
  private buildPrompt(commits: CommitRecord[], reportType: ReportType): string {
    const commitList = commits.map(c => {
      let entry = `- [${c.id}] ${c.message}`;
      if (c.files && c.files.length > 0) {
        entry += `\n  修改文件: ${c.files.slice(0, 5).join(', ')}`;
        if (c.files.length > 5) {
          entry += ` 等${c.files.length}个文件`;
        }
      }
      return entry;
    }).join('\n');

    const reportTypeName = reportType === 'daily' ? '日报' : reportType === 'weekly' ? '周报' : '工作报告';

    if (this.language === 'zh-CN') {
      return `你是一个专业的技术文档撰写助手。请根据以下Git/SVN提交记录，生成一份结构化的工作${reportTypeName}。

## 提交记录
${commitList}

## 要求
1. 用中文撰写
2. 按功能模块或工作类型分类总结
3. 突出重点工作成果
4. 语言简洁专业
5. 使用Markdown格式

## 输出格式
### 工作概述
（一句话总结本${reportType === 'daily' ? '日' : '周期'}主要工作）

### 完成事项
（按类别列出完成的工作）

### 技术细节
（如有重要的技术实现，简要说明）

### 下一步计划
（可选，如果能从提交记录推断）

请直接输出报告内容，不要有额外的解释。`;
    } else {
      return `You are a professional technical documentation assistant. Please generate a structured work ${reportTypeName} based on the following Git/SVN commit records.

## Commit Records
${commitList}

## Requirements
1. Write in English
2. Categorize by feature modules or work types
3. Highlight key achievements
4. Use concise and professional language
5. Use Markdown format

## Output Format
### Overview
(One sentence summary of the main work)

### Completed Tasks
(List completed work by category)

### Technical Details
(Brief explanation of important technical implementations, if any)

### Next Steps
(Optional, if inferable from commit records)

Please output the report content directly without additional explanations.`;
    }
  }

  /**
   * 调用OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const openai = new OpenAI({
      apiKey: this.apiKey,
    });

    const response = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content || '生成失败';
  }

  /**
   * 调用Anthropic API
   */
  private async callAnthropic(prompt: string): Promise<string> {
    // 使用fetch直接调用Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model || 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API调用失败: ${error}`);
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content[0]?.text || '生成失败';
  }

  /**
   * 调用DeepSeek API (兼容OpenAI格式)
   */
  private async callDeepSeek(prompt: string): Promise<string> {
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    });

    const response = await openai.chat.completions.create({
      model: this.model || 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content || '生成失败';
  }

  /**
   * 生成 commit message
   */
  async generateCommitMessage(diff: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('未配置AI API Key，请在设置中配置');
    }

    const prompt = this.buildCommitPrompt(diff);

    switch (this.provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      case 'deepseek':
        return this.callDeepSeek(prompt);
      default:
        throw new Error(`不支持的AI提供商: ${this.provider}`);
    }
  }

  /**
   * 构建 commit message 提示词
   */
  private buildCommitPrompt(diff: string): string {
    const truncatedDiff = diff.length > 8000 ? diff.substring(0, 8000) + '\n...(truncated)' : diff;

    return `根据以下代码变更生成一个简洁的 Git commit message。

## 格式要求
- 使用中文
- 第一行：类型: 简短描述（不超过50字）
- 类型包括：feat(新功能), fix(修复), docs(文档), style(格式), refactor(重构), test(测试), chore(构建/工具)
- 如有必要，空一行后添加详细说明

## 代码变更
\`\`\`diff
${truncatedDiff}
\`\`\`

## 输出
直接输出 commit message，不要有其他解释。`;
  }

  /**
   * 生成代码变更摘要
   */
  async generateChangeSummary(diff: string, commits: Array<{ hash: string; message: string }>): Promise<string> {
    if (!this.apiKey) {
      throw new Error('未配置AI API Key，请在设置中配置');
    }

    const prompt = this.buildChangeSummaryPrompt(diff, commits);

    switch (this.provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      case 'deepseek':
        return this.callDeepSeek(prompt);
      default:
        throw new Error(`不支持的AI提供商: ${this.provider}`);
    }
  }

  /**
   * 构建代码变更摘要提示词
   */
  private buildChangeSummaryPrompt(diff: string, commits: Array<{ hash: string; message: string }>): string {
    const truncatedDiff = diff.length > 12000 ? diff.substring(0, 12000) + '\n...(truncated)' : diff;
    const commitList = commits.map(c => `- [${c.hash}] ${c.message}`).join('\n');

    return `作为代码审查专家，请分析以下代码变更并生成详细的变更摘要报告。

## 提交记录
${commitList}

## 代码变更
\`\`\`diff
${truncatedDiff}
\`\`\`

## 输出格式（Markdown）
### 变更概述
（一段话总结本次变更的主要内容和目的）

### 主要改动
（按模块/功能分类列出主要改动点）

### 技术细节
（重要的实现细节、算法变更、架构调整等）

### 潜在风险
（可能存在的问题、边界情况、兼容性风险等，如无则写"暂无明显风险"）

### 改进建议
（代码质量、性能、可维护性等方面的建议，如无则写"暂无"）

请直接输出报告内容。`;
  }
}
