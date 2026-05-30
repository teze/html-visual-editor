# 快速开始指南

## 5 分钟上手 VS Code 插件开发

### 第 1 步：安装依赖

```bash
cd vscode-extension
npm install
```

### 第 2 步：编译代码

```bash
npm run compile
```

### 第 3 步：启动调试

1. 在 VS Code 中打开 `vscode-extension` 目录
2. 按 `F5` 键（或点击菜单 Run > Start Debugging）
3. 等待新的 VS Code 窗口打开（标题栏显示 "[Extension Development Host]"）

### 第 4 步：测试插件

在新打开的 VS Code 窗口中：

1. 创建一个测试 HTML 文件：
   ```html
   <!DOCTYPE html>
   <html>
   <head>
       <title>测试页面</title>
   </head>
   <body>
       <h1>Hello World</h1>
       <p>这是一个测试段落</p>
   </body>
   </html>
   ```

2. 右键点击文件，选择 "用可视化编辑器打开"

3. 在预览区域点击元素进行编辑

4. 修改会自动保存到文件

### 第 5 步：查看效果

- 点击预览中的 "Hello World"，在右侧属性面板修改文字
- 修改颜色、字体大小等属性
- 双击文字直接编辑
- 点击"删除此元素"按钮删除元素

## 常用命令

```bash
# 编译（一次性）
npm run compile

# 监听模式（自动重新编译）
npm run watch

# 打包插件
npm run package

# 代码检查
npm run lint
```

## 调试技巧

### 1. 查看插件日志

在调试窗口中：
- 打开 "输出" 面板（View > Output）
- 选择 "Extension Host" 频道

### 2. 调试 Webview

在调试窗口中：
1. 按 `Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows/Linux)
2. 输入 "Developer: Open Webview Developer Tools"
3. 选择 "HTML 可视化编辑器"

### 3. 重新加载插件

在调试窗口中：
- 按 `Cmd+R` (Mac) 或 `Ctrl+R` (Windows/Linux)
- 或点击调试工具栏的重启按钮

## 修改插件

### 修改编辑器 UI

编辑器 UI 来自 `../html-editor.html`，修改后需要：

1. 重新启动调试（`F5`）
2. 或在调试窗口中重新加载（`Cmd+R` / `Ctrl+R`）

### 修改插件逻辑

编辑 `src/` 目录下的 TypeScript 文件：

- `extension.ts`：插件入口和命令注册
- `htmlVisualEditorProvider.ts`：编辑器提供者和消息处理

修改后：
1. 保存文件（如果运行了 `npm run watch`，会自动编译）
2. 在调试窗口中重新加载（`Cmd+R` / `Ctrl+R`）

## 打包安装

### 本地安装

```bash
# 1. 打包
npm run package

# 2. 安装
code --install-extension html-visual-editor-0.1.0.vsix
```

### 分享给他人

将生成的 `.vsix` 文件发送给他人，他们可以：

1. 在 VS Code 中打开扩展面板
2. 点击 "..." 菜单
3. 选择 "从 VSIX 安装..."
4. 选择 `.vsix` 文件

## 下一步

- 阅读 [开发指南](DEVELOPMENT.md) 了解详细架构
- 查看 [VS Code Extension API](https://code.visualstudio.com/api) 文档
- 探索 [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)

## 遇到问题？

### 编译错误

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
npm run compile
```

### 插件无法加载

1. 检查 `out/` 目录是否存在编译后的 `.js` 文件
2. 查看输出面板的错误信息
3. 确保 VS Code 版本 >= 1.75.0

### Webview 显示空白

1. 检查 `../html-editor.html` 文件是否存在
2. 打开 Webview Developer Tools 查看控制台错误
3. 确认路径配置正确

## 获取帮助

- 查看 [README.md](README.md)
- 阅读 [DEVELOPMENT.md](DEVELOPMENT.md)
- 提交 Issue 报告问题
