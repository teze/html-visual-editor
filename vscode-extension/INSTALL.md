# 安装指南

## 方式 1：从源码安装（推荐开发者）

### 前置要求

- Node.js 18.x 或更高版本
- npm 或 yarn
- Visual Studio Code 1.75.0 或更高版本

### 步骤

1. **克隆或下载项目**
   ```bash
   cd HTML-Editor/vscode-extension
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **编译代码**
   ```bash
   npm run compile
   ```

4. **打包插件**
   ```bash
   npm run package
   ```
   
   这会生成 `html-visual-editor-0.1.0.vsix` 文件。

5. **安装插件**
   
   **方式 A：命令行安装**
   ```bash
   code --install-extension html-visual-editor-0.1.0.vsix
   ```
   
   **方式 B：VS Code 界面安装**
   1. 打开 VS Code
   2. 按 `Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows/Linux)
   3. 输入 "Extensions: Install from VSIX..."
   4. 选择生成的 `.vsix` 文件

6. **重启 VS Code**
   
   安装完成后重启 VS Code 以激活插件。

## 方式 2：开发模式（推荐调试）

如果你想修改插件或调试，使用开发模式：

1. **安装依赖**
   ```bash
   cd vscode-extension
   npm install
   ```

2. **在 VS Code 中打开**
   ```bash
   code .
   ```

3. **启动调试**
   - 按 `F5` 键
   - 或点击菜单 Run > Start Debugging
   - 或点击侧边栏的调试图标，然后点击"运行插件"

4. **测试插件**
   
   在新打开的 VS Code 窗口（Extension Development Host）中测试插件。

## 方式 3：从 VSIX 文件安装（推荐最终用户）

如果你已经有 `.vsix` 文件：

1. **下载 VSIX 文件**
   
   从发布页面或其他来源获取 `html-visual-editor-x.x.x.vsix` 文件。

2. **安装**
   
   **方式 A：拖放安装**
   - 打开 VS Code
   - 打开扩展面板（`Cmd+Shift+X` / `Ctrl+Shift+X`）
   - 将 `.vsix` 文件拖放到扩展面板

   **方式 B：命令行安装**
   ```bash
   code --install-extension html-visual-editor-x.x.x.vsix
   ```

   **方式 C：界面安装**
   - 打开 VS Code
   - 打开扩展面板
   - 点击右上角的 "..." 菜单
   - 选择 "从 VSIX 安装..."
   - 选择 `.vsix` 文件

3. **重启 VS Code**

## 验证安装

安装成功后，验证插件是否正常工作：

1. **检查插件列表**
   - 打开扩展面板（`Cmd+Shift+X` / `Ctrl+Shift+X`）
   - 搜索 "HTML 可视化编辑器"
   - 应该看到已安装的插件

2. **测试功能**
   - 创建一个测试 HTML 文件
   - 右键点击文件
   - 应该看到 "用可视化编辑器打开" 选项
   - 点击后应该打开可视化编辑器

## 卸载

### 方式 1：VS Code 界面

1. 打开扩展面板
2. 找到 "HTML 可视化编辑器"
3. 点击齿轮图标
4. 选择 "卸载"

### 方式 2：命令行

```bash
code --uninstall-extension your-publisher-name.html-visual-editor
```

## 更新

### 从源码更新

1. 拉取最新代码
2. 重新编译和打包
   ```bash
   npm install
   npm run compile
   npm run package
   ```
3. 重新安装 VSIX 文件

### 从市场更新

如果插件已发布到市场：
1. VS Code 会自动检查更新
2. 或手动检查：扩展面板 > 插件 > 检查更新

## 故障排除

### 问题 1：编译失败

**错误**：`Cannot find module 'typescript'`

**解决**：
```bash
rm -rf node_modules package-lock.json
npm install
```

### 问题 2：插件无法加载

**错误**：插件在扩展列表中显示但无法使用

**解决**：
1. 检查 VS Code 版本是否 >= 1.75.0
2. 查看输出面板的错误信息（View > Output > Extension Host）
3. 尝试重启 VS Code
4. 重新安装插件

### 问题 3：Webview 显示空白

**错误**：打开编辑器后显示空白页面

**解决**：
1. 检查 `../html-editor.html` 文件是否存在
2. 打开 Webview Developer Tools 查看控制台错误
   - `Cmd+Shift+P` / `Ctrl+Shift+P`
   - 输入 "Developer: Open Webview Developer Tools"
3. 检查文件路径配置

### 问题 4：无法保存文件

**错误**：编辑后内容没有保存

**解决**：
1. 检查文件是否有写入权限
2. 查看 VS Code 输出面板的错误信息
3. 尝试手动保存（`Cmd+S` / `Ctrl+S`）

### 问题 5：右键菜单没有选项

**错误**：右键 HTML 文件时没有 "用可视化编辑器打开" 选项

**解决**：
1. 确认插件已正确安装并启用
2. 重启 VS Code
3. 检查文件扩展名是否为 `.html`

## 系统要求

### 最低要求

- **操作系统**：macOS 10.15+, Windows 10+, Linux (主流发行版)
- **VS Code**：1.75.0 或更高版本
- **Node.js**：18.x 或更高版本（仅开发时需要）
- **内存**：建议 4GB 以上

### 推荐配置

- **操作系统**：最新版本
- **VS Code**：最新稳定版
- **Node.js**：最新 LTS 版本
- **内存**：8GB 或以上

## 权限说明

插件需要以下权限：

- **文件系统访问**：读取和写入 HTML 文件
- **Webview**：显示可视化编辑器界面
- **命令注册**：注册自定义命令和菜单项

所有权限仅用于插件功能，不会收集或上传任何数据。

## 获取帮助

如果遇到问题：

1. 查看 [常见问题](README.md#常见问题)
2. 查看 [开发指南](DEVELOPMENT.md)
3. 查看 [快速开始](QUICKSTART.md)
4. 提交 Issue 报告问题

## 下一步

安装成功后：

1. 阅读 [README.md](README.md) 了解功能
2. 查看 [QUICKSTART.md](QUICKSTART.md) 快速上手
3. 探索 [DEVELOPMENT.md](DEVELOPMENT.md) 了解架构

祝使用愉快！🎉
