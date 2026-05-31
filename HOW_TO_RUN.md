# 如何运行 Cursor Browser Editor

## ⚠️ 重要提示

由于浏览器的安全限制，`cursor-browser-editor.html` 不能直接通过 `file://` 协议打开。
你需要通过本地服务器运行才能正常工作。

## 🚀 快速启动

### 方式 1：Python 3（推荐）

```bash
# 在项目目录下运行
python3 -m http.server 8000

# 然后在浏览器中访问
# http://localhost:8000/cursor-browser-editor.html
```

### 方式 2：Python 2

```bash
python -m SimpleHTTPServer 8000

# 然后访问
# http://localhost:8000/cursor-browser-editor.html
```

### 方式 3：Node.js

```bash
# 安装 http-server（首次需要）
npm install -g http-server

# 启动服务器
npx http-server -p 8000

# 或者
http-server -p 8000

# 然后访问
# http://localhost:8000/cursor-browser-editor.html
```

### 方式 4：PHP

```bash
php -S localhost:8000

# 然后访问
# http://localhost:8000/cursor-browser-editor.html
```

### 方式 5：VS Code Live Server

1. 安装 VS Code 扩展 "Live Server"
2. 右键点击 `cursor-browser-editor.html`
3. 选择 "Open with Live Server"

## 🎯 使用步骤

1. 启动本地服务器（选择上面任一方式）
2. 在浏览器中打开 `http://localhost:8000/cursor-browser-editor.html`
3. 点击"示例页面"按钮加载演示
4. 在左侧元素树中点击元素
5. 在右侧属性面板查看和编辑属性

## 🐛 常见问题

### Q: 为什么不能直接双击打开？

A: 浏览器的同源策略（CORS）限制了 `file://` 协议下的 iframe 访问。必须通过 HTTP 服务器运行。

### Q: 看到 "Unsafe attempt to load URL" 错误？

A: 这说明你是通过 `file://` 协议打开的。请使用上面的方法通过本地服务器运行。

### Q: 端口 8000 被占用？

A: 可以使用其他端口，例如：
```bash
python3 -m http.server 3000
# 然后访问 http://localhost:3000/cursor-browser-editor.html
```

## 📝 其他文件

如果你想使用不需要服务器的版本，可以使用：
- `html-editor.html` - 原始的独立版本（可以直接打开）
- `html-editor-v2.html` - V2 版本（可以直接打开）

这些文件功能较少，但可以直接通过 `file://` 协议打开。

## 🔗 相关文档

- [实现计划](CURSOR_BROWSER_IMPLEMENTATION.md)
- [功能路线图](CURSOR_BROWSER_ROADMAP.md)
- [GitHub 仓库](https://github.com/teze/html-visual-editor)
