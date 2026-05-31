#!/bin/bash

# HTML 可视化编辑器 - 本地服务器启动脚本

echo "🚀 启动 HTML 可视化编辑器..."
echo ""

# 检查端口是否被占用
PORT=8000
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  端口 $PORT 已被占用，尝试使用端口 8001..."
    PORT=8001
fi

# 检查 Python 版本
if command -v python3 &> /dev/null; then
    echo "✓ 使用 Python 3 启动服务器"
    echo "📡 服务器地址: http://localhost:$PORT"
    echo ""
    echo "📄 可用页面:"
    echo "   - Cursor Browser Editor: http://localhost:$PORT/cursor-browser-editor.html"
    echo "   - 原始编辑器: http://localhost:$PORT/html-editor.html"
    echo "   - V2 编辑器: http://localhost:$PORT/html-editor-v2.html"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    echo "✓ 使用 Python 2 启动服务器"
    echo "📡 服务器地址: http://localhost:$PORT"
    echo ""
    echo "📄 可用页面:"
    echo "   - Cursor Browser Editor: http://localhost:$PORT/cursor-browser-editor.html"
    echo "   - 原始编辑器: http://localhost:$PORT/html-editor.html"
    echo "   - V2 编辑器: http://localhost:$PORT/html-editor-v2.html"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python -m SimpleHTTPServer $PORT
else
    echo "❌ 错误: 未找到 Python"
    echo ""
    echo "请安装 Python 或使用其他方式启动服务器："
    echo "  - Node.js: npx http-server -p 8000"
    echo "  - PHP: php -S localhost:8000"
    exit 1
fi
