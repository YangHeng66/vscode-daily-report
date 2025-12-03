# Daily Report Generator

一个 VSCode 插件，用于从 Git/SVN 提交记录自动生成工作日报和周报，并提供 AI 辅助开发功能。

## 功能特性

- **多版本控制支持**: 支持 Git 和 SVN 仓库
- **智能 AI 总结**: 支持使用 OpenAI、Claude 或 DeepSeek API 智能总结工作内容
- **灵活的日期范围**: 支持日报、周报和自定义日期范围
- **Markdown 输出**: 生成结构化的 Markdown 报告文件
- **多语言支持**: 支持中文和英文报告
- **AI Commit Message 生成**: 根据代码变更自动生成规范的 commit message
- **代码变更摘要**: 分析指定范围的提交，生成详细的变更摘要报告

## 安装

### 从源码安装

```bash
cd vscode-daily-report
npm install
npm run compile
```

然后在 VSCode 中按 `F5` 启动调试，或者打包安装：

```bash
npm install -g @vscode/vsce
vsce package
```

生成的 `.vsix` 文件可以通过 VSCode 的"从 VSIX 安装"功能安装。

## 使用方法

1. 打开命令面板 (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. 搜索 "Daily Report" 相关命令：
   - `Daily Report: Generate Daily Report` - 生成今日日报
   - `Daily Report: Generate Weekly Report` - 生成本周周报
   - `Daily Report: Generate Custom Range Report` - 生成自定义日期范围报告
   - `Daily Report: AI Commit Message 生成` - 根据代码变更生成 commit message
   - `Daily Report: AI变更总结` - 生成代码变更摘要报告
   - `Daily Report: Configure Settings` - 打开配置页面

### SCM 面板按钮

在 Git 源代码管理面板顶部提供快捷按钮：
- ✨ **AI Commit Message 生成** - 分析暂存/未暂存的变更，生成规范的 commit message
- 📖 **AI变更总结** - 选择提交范围，生成详细的代码变更摘要

## 配置项

在 VSCode 设置中搜索 `dailyReport` 进行配置：

| 配置项                        | 说明                         | 默认值        |
| ----------------------------- | ---------------------------- | ------------- |
| `dailyReport.aiProvider`      | AI 提供商 (openai/anthropic) | `openai`      |
| `dailyReport.aiApiKey`        | AI API 密钥                  | -             |
| `dailyReport.aiModel`         | AI 模型名称                  | `gpt-4o-mini` |
| `dailyReport.outputDirectory` | 报告输出目录                 | `./reports`   |
| `dailyReport.authorFilter`    | 按作者过滤（邮箱或用户名）   | -             |
| `dailyReport.vcsType`         | 版本控制类型 (auto/git/svn)  | `auto`        |
| `dailyReport.language`        | 报告语言 (zh-CN/en)          | `zh-CN`       |

## 示例配置

```json
{
  "dailyReport.aiProvider": "openai",
  "dailyReport.aiApiKey": "sk-xxx",
  "dailyReport.aiModel": "gpt-4o-mini",
  "dailyReport.outputDirectory": "./reports",
  "dailyReport.authorFilter": "your-email@example.com",
  "dailyReport.language": "zh-CN"
}
```

## 生成的报告示例

```markdown
# 工作日报 - 2024 年 01 月 15 日

> 生成时间: 2024-01-15 18:00:00
> 统计周期: 2024-01-15
> 提交数量: 5

---

### 工作概述

今日主要完成了用户认证模块的优化和 Bug 修复工作。

### 完成事项

- **功能开发**

  - 实现了用户登录状态持久化
  - 添加了记住密码功能

- **Bug 修复**
  - 修复了登录超时问题
  - 解决了 Token 刷新失败的问题

### 技术细节

- 使用 localStorage 存储加密后的 Token
- 优化了 Token 刷新逻辑，避免并发请求问题

---

## 提交记录明细

| 时间        | ID      | 作者 | 提交信息               |
| ----------- | ------- | ---- | ---------------------- |
| 01-15 17:30 | abc1234 | John | feat: 添加记住密码功能 |
| 01-15 15:20 | def5678 | John | fix: 修复登录超时问题  |

...
```

## 无 AI 模式

如果未配置 AI API Key，插件会生成简单的提交记录汇总报告，不包含 AI 总结内容。

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 代码检查
npm run lint
```

## 许可证

MIT
