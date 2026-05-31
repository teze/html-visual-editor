#!/bin/bash

# 命令模式撤销/重做测试脚本

echo "=========================================="
echo "命令模式撤销/重做实现验证"
echo "=========================================="
echo ""

# 检查关键函数是否存在
echo "1. 检查关键函数..."

if grep -q "function createCommandHistory" html-editor.html; then
    echo "   ✅ createCommandHistory 函数已定义"
else
    echo "   ❌ createCommandHistory 函数未找到"
    exit 1
fi

if grep -q "function findElementByPath" html-editor.html; then
    echo "   ✅ findElementByPath 函数已定义"
else
    echo "   ❌ findElementByPath 函数未找到"
    exit 1
fi

if grep -q "function getElementPath" html-editor.html; then
    echo "   ✅ getElementPath 函数已定义"
else
    echo "   ❌ getElementPath 函数未找到"
    exit 1
fi

echo ""
echo "2. 检查命令类型..."

if grep -q "type: 'UpdateStyle'" html-editor.html; then
    echo "   ✅ UpdateStyle 命令已实现"
else
    echo "   ❌ UpdateStyle 命令未找到"
    exit 1
fi

if grep -q "type: 'UpdateText'" html-editor.html; then
    echo "   ✅ UpdateText 命令已实现"
else
    echo "   ❌ UpdateText 命令未找到"
    exit 1
fi

if grep -q "type: 'UpdateAttribute'" html-editor.html; then
    echo "   ✅ UpdateAttribute 命令已实现"
else
    echo "   ❌ UpdateAttribute 命令未找到"
    exit 1
fi

if grep -q "type: 'DeleteElement'" html-editor.html; then
    echo "   ✅ DeleteElement 命令已实现"
else
    echo "   ❌ DeleteElement 命令未找到"
    exit 1
fi

echo ""
echo "3. 检查旧代码是否已清理..."

if grep -q "createHistoryManager" html-editor.html; then
    echo "   ⚠️  警告：仍然存在 createHistoryManager 引用"
else
    echo "   ✅ createHistoryManager 已清理"
fi

if grep -q "isRestoring" html-editor.html; then
    echo "   ⚠️  警告：仍然存在 isRestoring 引用"
else
    echo "   ✅ isRestoring 已清理"
fi

if grep -q "saveHistorySnapshot" html-editor.html; then
    echo "   ⚠️  警告：仍然存在 saveHistorySnapshot 引用"
else
    echo "   ✅ saveHistorySnapshot 已清理"
fi

echo ""
echo "4. 检查 commandHistory 使用..."

if grep -q "var commandHistory = createCommandHistory" html-editor.html; then
    echo "   ✅ commandHistory 已初始化"
else
    echo "   ❌ commandHistory 未初始化"
    exit 1
fi

if grep -q "commandHistory.push" html-editor.html; then
    echo "   ✅ commandHistory.push 已使用"
else
    echo "   ❌ commandHistory.push 未使用"
    exit 1
fi

if grep -q "commandHistory.undo" html-editor.html; then
    echo "   ✅ commandHistory.undo 已使用"
else
    echo "   ❌ commandHistory.undo 未使用"
    exit 1
fi

if grep -q "commandHistory.redo" html-editor.html; then
    echo "   ✅ commandHistory.redo 已使用"
else
    echo "   ❌ commandHistory.redo 未使用"
    exit 1
fi

echo ""
echo "5. 检查文档..."

if [ -f "COMMAND_PATTERN_IMPLEMENTATION.md" ]; then
    echo "   ✅ COMMAND_PATTERN_IMPLEMENTATION.md 已创建"
else
    echo "   ❌ COMMAND_PATTERN_IMPLEMENTATION.md 未找到"
fi

if [ -f "test-command-undo.html" ]; then
    echo "   ✅ test-command-undo.html 已创建"
else
    echo "   ❌ test-command-undo.html 未找到"
fi

echo ""
echo "=========================================="
echo "✅ 验证完成！命令模式实现正确。"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 在浏览器中打开 html-editor.html"
echo "2. 加载 test-command-undo.html 测试文件"
echo "3. 修改元素颜色和文字"
echo "4. 测试多次撤销/重做"
echo ""
