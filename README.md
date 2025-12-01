# Daily Report Generator

一个VSCode插件，用于从Git/SVN提交记录自动生成工作日报和周报。

## 功能特性

- **多版本控制支持**: 支持Git和SVN仓库
- **智能AI总结**: 使用OpenAI或Anthropic API智能总结工作内容
- **灵活的日期范围**: 支持日报、周报和自定义日期范围
- **Markdown输出**: 生成结构化的Markdown报告文件
- **多语言支持**: 支持中文和英文报告

## 安装

### 从源码安装

```bash
cd vscode-daily-report
npm install
npm run compile
```

然后在VSCode中按 `F5` 启动调试，或者打包安装：

```bash
npm install -g @vscode/vsce
vsce package
```

生成的 `.vsix` 文件可以通过VSCode的"从VSIX安装"功能安装。

## 使用方法

1. 打开命令面板 (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. 搜索 "Daily Report" 相关命令：
   - `Daily Report: Generate Daily Report` - 生成今日日报
   - `Daily Report: Generate Weekly Report` - 生成本周周报
   - `Daily Report: Generate Custom Range Report` - 生成自定义日期范围报告
   - `Daily Report: Configure Settings` - 打开配置页面

## 配置项

在VSCode设置中搜索 `dailyReport` 进行配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `dailyReport.aiProvider` | AI提供商 (openai/anthropic) | `openai` |
| `dailyReport.aiApiKey` | AI API密钥 | - |
| `dailyReport.aiModel` | AI模型名称 | `gpt-4o-mini` |
| `dailyReport.outputDirectory` | 报告输出目录 | `./reports` |
| `dailyReport.authorFilter` | 按作者过滤（邮箱或用户名） | - |
| `dailyReport.vcsType` | 版本控制类型 (auto/git/svn) | `auto` |
| `dailyReport.language` | 报告语言 (zh-CN/en) | `zh-CN` |

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
# 工作日报 - 2024年01月15日

> 生成时间: 2024-01-15 18:00:00
> 统计周期: 2024-01-15
> 提交数量: 5

---

### 工作概述
今日主要完成了用户认证模块的优化和Bug修复工作。

### 完成事项
- **功能开发**
  - 实现了用户登录状态持久化
  - 添加了记住密码功能

- **Bug修复**
  - 修复了登录超时问题
  - 解决了Token刷新失败的问题

### 技术细节
- 使用localStorage存储加密后的Token
- 优化了Token刷新逻辑，避免并发请求问题

---

## 提交记录明细

| 时间 | ID | 作者 | 提交信息 |
|------|-----|------|----------|
| 01-15 17:30 | abc1234 | John | feat: 添加记住密码功能 |
| 01-15 15:20 | def5678 | John | fix: 修复登录超时问题 |
...
```

## 无AI模式

如果未配置AI API Key，插件会生成简单的提交记录汇总报告，不包含AI总结内容。

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
