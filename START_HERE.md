# 🚀 从这里开始

欢迎使用 HTML 可视化编辑器！这个文档会帮你快速上手。

## 📌 快速选择

### 我想快速编辑一个 HTML 文件

👉 **使用独立版**

```bash
# 直接双击打开
open html-editor.html

# 或在浏览器中打开
# file:///path/to/html-editor.html
```

### 我在 VS Code 中开发，想集成到工作流

👉 **使用 VS Code 插件版**

```bash
cd vscode-extension
npm install
npm run compile
npm run package
code --install-extension html-visual-editor-0.1.0.vsix
```

### 我不确定用哪个

👉 **查看版本对比**

阅读 [VERSION_COMPARISON.md](VERSION_COMPARISON.md) 了解两个版本的区别。

## 📚 文档导航

### 新手入门

1. **[README.md](README.md)** - 项目概述和功能介绍
2. **[VERSION_COMPARISON.md](VERSION_COMPARISON.md)** - 选择合适的版本
3. **[vscode-extension/QUICKSTART.md](vscode-extension/QUICKSTART.md)** - 5分钟快速上手

### 使用指南

1. **[vscode-extension/README.md](vscode-extension/README.md)** - 插件功能说明
2. **[vscode-extension/INSTALL.md](vscode-extension/INSTALL.md)** - 详细安装步骤
3. **[vscode-extension/EXAMPLES.md](vscode-extension/EXAMPLES.md)** - 实际使用示例

### 开发文档

1. **[vscode-extension/DEVELOPMENT.md](vscode-extension/DEVELOPMENT.md)** - 架构和 API
2. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - 项目总结
3. **[COMPLETION_REPORT.md](COMPLETION_REPORT.md)** - 完成报告

## 🎯 5分钟快速开始

### 使用独立版

1. 双击 `html-editor.html` 打开
2. 点击"打开文件"选择 HTML 文件
3. 在预览区域点击元素编辑
4. 点击"导出 HTML"保存

### 使用插件版

1. 安装插件（见上方命令）
2. 在 VS Code 中右键 `.html` 文件
3. 选择"用可视化编辑器打开"
4. 编辑后自动保存

## 💡 常见问题

### Q: 两个版本有什么区别？

A: 独立版是单个 HTML 文件，零依赖，适合快速编辑；插件版深度集成 VS Code，自动保存，适合日常开发。详见 [VERSION_COMPARISON.md](VERSION_COMPARISON.md)。

### Q: 插件如何安装？

A: 详细步骤见 [vscode-extension/INSTALL.md](vscode-extension/INSTALL.md)。

### Q: 如何编辑元素？

A: 点击预览中的元素，在右侧属性面板修改；或双击文字直接编辑。详见 [vscode-extension/EXAMPLES.md](vscode-extension/EXAMPLES.md)。

### Q: 支持哪些样式？

A: 支持文字、颜色、字体、尺寸、内边距、圆角等常用样式。详见功能列表。

### Q: 可以删除元素吗？

A: 可以。选中元素后，点击属性面板底部的"删除此元素"按钮。

## 🔗 快速链接

| 链接 | 说明 |
|------|------|
| [README.md](README.md) | 项目概述 |
| [VERSION_COMPARISON.md](VERSION_COMPARISON.md) | 版本对比 |
| [vscode-extension/QUICKSTART.md](vscode-extension/QUICKSTART.md) | 快速上手 |
| [vscode-extension/INSTALL.md](vscode-extension/INSTALL.md) | 安装指南 |
| [vscode-extension/EXAMPLES.md](vscode-extension/EXAMPLES.md) | 使用示例 |
| [vscode-extension/DEVELOPMENT.md](vscode-extension/DEVELOPMENT.md) | 开发指南 |

## 🎓 学习路径

### 初学者

1. 阅读 [README.md](README.md) 了解项目
2. 查看 [VERSION_COMPARISON.md](VERSION_COMPARISON.md) 选择版本
3. 按照 [QUICKSTART.md](vscode-extension/QUICKSTART.md) 快速上手
4. 参考 [EXAMPLES.md](vscode-extension/EXAMPLES.md) 学习使用

### 开发者

1. 阅读 [DEVELOPMENT.md](vscode-extension/DEVELOPMENT.md) 了解架构
2. 查看 [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) 了解实现
3. 研究源代码 `vscode-extension/src/`
4. 参考 [COMPLETION_REPORT.md](COMPLETION_REPORT.md) 了解细节

## 🆘 获取帮助

### 遇到问题？

1. 查看 [vscode-extension/INSTALL.md](vscode-extension/INSTALL.md) 的故障排除部分
2. 阅读 [vscode-extension/README.md](vscode-extension/README.md) 的常见问题
3. 提交 Issue 报告问题

### 想要贡献？

1. Fork 仓库
2. 阅读 [DEVELOPMENT.md](vscode-extension/DEVELOPMENT.md)
3. 创建特性分支
4. 提交 Pull Request

## 🎉 开始使用

选择你的方式，开始使用 HTML 可视化编辑器：

- 🚀 **快速编辑**：双击 `html-editor.html`
- 💻 **日常开发**：安装 VS Code 插件
- 📚 **深入学习**：阅读开发文档

**祝使用愉快！** 🎊

---

*有问题？查看文档或提交 Issue*
