# VS Code 插件开发指南

## 项目结构

```
vscode-extension/
├── src/
│   ├── extension.ts              # 插件入口
│   └── htmlVisualEditorProvider.ts  # 自定义编辑器提供者
├── media/                        # 静态资源（编辑器 HTML）
├── scripts/
│   └── adapt-editor.js          # 编辑器适配脚本
├── out/                         # 编译输出（自动生成）
├── package.json                 # 插件配置
├── tsconfig.json               # TypeScript 配置
└── README.md                   # 用户文档
```

## 开发环境设置

### 1. 安装依赖

```bash
cd vscode-extension
npm install
```

### 2. 编译 TypeScript

```bash
npm run compile
```

或者启用监听模式：

```bash
npm run watch
```

### 3. 调试插件

1. 在 VS Code 中打开 `vscode-extension` 目录
2. 按 `F5` 启动调试
3. 在新打开的 VS Code 窗口中测试插件

## 核心概念

### CustomTextEditorProvider

插件使用 VS Code 的 `CustomTextEditorProvider` API 实现自定义编辑器：

- **resolveCustomTextEditor**: 当用户打开 HTML 文件时被调用
- **webview**: 提供一个 webview 容器来显示编辑器 UI
- **document**: 代表正在编辑的文本文档

### 消息通信

编辑器和 VS Code 之间通过 `postMessage` 进行通信：

#### VS Code → Webview

```typescript
webviewPanel.webview.postMessage({
    type: 'init',
    content: document.getText()
});
```

#### Webview → VS Code

```javascript
vscode.postMessage({
    type: 'update',
    content: html
});
```

### 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| `ready` | Webview → VS Code | Webview 已就绪 |
| `init` | VS Code → Webview | 发送初始内容 |
| `update` | Webview → VS Code | 保存编辑内容 |
| `documentChanged` | VS Code → Webview | 文档在外部被修改 |
| `error` | Webview → VS Code | 错误报告 |

## 集成原理

### 1. 编辑器适配

原始的 `html-editor.html` 是一个独立的单文件应用，需要适配才能在 VS Code webview 中运行：

- 移除文件打开/保存按钮（由 VS Code 处理）
- 注入 `acquireVsCodeApi()` 调用
- 添加消息监听和发送逻辑
- 暴露必要的接口（`loadHTMLContent`, `getCurrentHTML`）

### 2. 文件操作流程

**打开文件**:
```
用户打开 .html 文件
  ↓
VS Code 调用 resolveCustomTextEditor
  ↓
创建 webview 并加载编辑器 HTML
  ↓
Webview 发送 'ready' 消息
  ↓
VS Code 发送 'init' 消息（包含文件内容）
  ↓
编辑器加载并显示内容
```

**保存文件**:
```
用户在编辑器中修改内容
  ↓
编辑器发送 'update' 消息
  ↓
VS Code 更新文档内容
  ↓
VS Code 自动保存文件
```

### 3. 自动保存

插件实现了两种保存机制：

1. **手动保存**: 用户点击"导出"按钮时立即保存
2. **自动保存**: 内容变化后 2 秒自动保存

## 打包发布

### 1. 安装打包工具

```bash
npm install -g @vscode/vsce
```

### 2. 打包插件

```bash
npm run package
```

这会生成一个 `.vsix` 文件。

### 3. 本地安装

```bash
code --install-extension html-visual-editor-0.1.0.vsix
```

### 4. 发布到市场

1. 注册 [Visual Studio Marketplace](https://marketplace.visualstudio.com/) 账号
2. 创建 Personal Access Token
3. 登录：
   ```bash
   vsce login <publisher-name>
   ```
4. 发布：
   ```bash
   vsce publish
   ```

## 常见问题

### Q: Webview 显示空白？

A: 检查以下几点：
- 确保 `html-editor.html` 路径正确
- 检查浏览器控制台是否有错误
- 确认 webview 的 `enableScripts` 选项已启用

### Q: 内容无法保存？

A: 检查：
- Webview 是否正确发送 'update' 消息
- VS Code 是否正确接收消息
- 文档是否有写入权限

### Q: 如何调试 webview？

A: 
1. 在调试窗口中按 `Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows/Linux)
2. 输入 "Developer: Open Webview Developer Tools"
3. 选择对应的 webview

## 扩展功能建议

- [ ] 支持多文件编辑
- [ ] 添加撤销/重做功能
- [ ] 支持代码和可视化视图切换
- [ ] 添加组件库
- [ ] 支持 CSS 外部样式表编辑
- [ ] 添加响应式预览模式

## 参考资源

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
