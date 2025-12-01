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
      baseURL: 'https://api.deepseek.com'
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
}
