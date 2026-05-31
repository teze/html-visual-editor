# HTML 可视化编辑器

单文件、零依赖的 HTML 可视化编辑器，支持独立使用和 VS Code 插件两种模式。

> 💡 **快速选择**：
> - 想要快速编辑？→ 使用 [独立版](#1-独立版本html-editorhtml)（双击打开）
> - 日常开发使用？→ 使用 [VS Code 插件版](#2-vs-code-插件版)（深度集成）
> - 不确定？→ 查看 [版本对比](VERSION_COMPARISON.md)

## 📦 两个版本

### 1. 独立版本（html-editor.html）

**特点**：
- 单个 HTML 文件，零依赖
- 可通过 `file://` 协议直接在浏览器中打开
- 无需安装，开箱即用
- 适合快速编辑和演示

**使用方法**：
1. 双击 `html-editor.html` 在浏览器中打开
2. 点击"打开文件"或拖拽 HTML 文件到页面
3. 在预览区域点击元素进行编辑
4. 点击"导出 HTML"保存修改

### 2. VS Code 插件版本

**特点**：
- 深度集成 VS Code
- 自动保存到文件
- 支持外部修改检测
- 完整的编辑器体验

**快速安装**：
```bash
cd vscode-extension
npm install
npm run compile
npm run package
code --install-extension html-visual-editor-0.1.0.vsix
```

**详细文档**：
- 📖 [安装指南](vscode-extension/INSTALL.md) - 详细的安装步骤
- 🚀 [快速开始](vscode-extension/QUICKSTART.md) - 5分钟上手
- 🔧 [开发指南](vscode-extension/DEVELOPMENT.md) - 深入了解架构
- 📊 [版本对比](VERSION_COMPARISON.md) - 选择合适的版本

## ✨ 功能特性

- 📄 **可视化编辑**：在预览界面直接点击元素进行编辑
- 🎨 **属性面板**：修改文字、颜色、字体、尺寸等属性
- 🔄 **实时预览**：所见即所得的编辑体验
- ↶↷ **撤销/重做**：支持撤销和重做操作，最多保存 50 步历史记录
- 💾 **自动保存**：修改后 2 秒自动保存到本地存储，刷新页面可恢复
- 📤 **导出功能**：保存修改后的 HTML
- 🎯 **零依赖**：无需额外配置

## 🎯 编辑功能

### 选择元素
- 鼠标悬停：元素高亮显示
- 点击选中：显示属性面板

### 编辑文字
- **方式 1**：在属性面板的"文字内容"区域修改
- **方式 2**：在预览区域双击文字直接编辑

### 修改样式
在属性面板中可以修改：
- 文字大小和粗细
- 文字对齐方式（左/中/右）
- 文字颜色和背景颜色
- 内边距和圆角
- 宽度和高度

### 特殊元素
- **图片 (`<img>`)**：修改图片地址 (src)
- **链接 (`<a>`)**：修改链接地址 (href)

### 删除元素
选中元素后，点击属性面板底部的"删除此元素"按钮

### 撤销/重做
- **撤销**：点击顶栏的"↶ 撤销"按钮，或按 `Ctrl+Z`（Mac: `Cmd+Z`）
- **重做**：点击顶栏的"↷ 重做"按钮，或按 `Ctrl+Y`（Mac: `Cmd+Y`）
- 最多保存 50 步历史记录
- 按钮在无可用历史时自动禁用

### 自动保存
- 修改后 2 秒自动保存到浏览器本地存储
- 顶栏显示保存状态（"已保存 刚刚" / "已保存 X 分钟前"）
- 刷新页面时自动提示恢复未保存的内容
- 导出文件后自动清除保存记录

## 🏗️ 项目结构

```
HTML-Editor/
├── html-editor.html          # 独立版编辑器（单文件）
├── src/                      # 源代码模块
│   ├── auto-saver.js         # 自动保存管理
│   ├── change-counter.js     # 修改计数器
│   ├── color.js              # 颜色转换工具
│   ├── exporter.js           # HTML 导出
│   ├── file-loader.js        # 文件加载
│   ├── file-validation.js    # 文件验证
│   ├── history-manager.js    # 撤销/重做历史管理
│   ├── inject.js             # 脚本注入
│   ├── injected-script.js    # iframe 内注入脚本
│   ├── input-validation.js   # 输入验证
│   ├── message-bus.js        # 消息总线
│   ├── preview-frame.js      # 预览框架
│   └── property-panel.js     # 属性面板
├── tests/                    # 测试文件
├── vscode-extension/         # VS Code 插件
│   ├── src/
│   │   ├── extension.ts      # 插件入口
│   │   └── htmlVisualEditorProvider.ts
│   ├── scripts/
│   │   └── adapt-editor.js   # 编辑器适配脚本
│   ├── package.json
│   └── README.md
├── package.json              # 开发依赖
└── vitest.config.js          # 测试配置
```

## 🧪 开发与测试

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
npm test
```

### 开发模式

编辑 `src/` 目录下的模块文件，然后重新组装 `html-editor.html`。

## 🔧 技术架构

### 核心模块

1. **Preview Frame**：管理 iframe 预览框架
2. **Message Bus**：处理父窗口和 iframe 之间的消息通信
3. **Property Panel**：属性编辑面板
4. **Injected Script**：注入到 iframe 中的编辑脚本
5. **Change Counter**：跟踪修改次数
6. **Exporter**：导出清理后的 HTML

### 设计原则

- **模块化**：开发期模块化，便于测试和维护
- **单文件部署**：最终组装为单个 HTML 文件
- **零依赖**：不依赖任何外部库
- **沙箱隔离**：使用 iframe sandbox 确保安全性

## 📝 已知限制

- 不支持编辑结构性标签（`<html>`, `<head>`, `<script>` 等）
- 仅支持内联样式编辑
- 不支持外部 CSS 文件编辑

## 📚 文档导航

### 用户文档
- 📖 [版本对比](VERSION_COMPARISON.md) - 选择合适的版本
- 📖 [VS Code 插件 README](vscode-extension/README.md) - 插件功能说明
- 📖 [安装指南](vscode-extension/INSTALL.md) - 详细安装步骤

### 开发文档
- 🚀 [快速开始](vscode-extension/QUICKSTART.md) - 5分钟上手开发
- 🔧 [开发指南](vscode-extension/DEVELOPMENT.md) - 架构和 API
- 📝 [更新日志](vscode-extension/CHANGELOG.md) - 版本历史

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🔗 相关链接

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)

## ⭐ Star History

如果这个项目对你有帮助，请给它一个 Star！
