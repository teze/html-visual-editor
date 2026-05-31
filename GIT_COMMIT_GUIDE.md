# Git 提交说明

## 提交信息

```
feat: 重构撤销/重做为命令模式，修复只能操作一次的bug

- 采用命令模式（Command Pattern）替代快照模式
- 修复关键bug：现在支持多次撤销/重做（之前只能操作一次）
- 性能提升：不再重新渲染iframe，只修改具体元素
- 内存优化：只保存操作命令，而非完整HTML快照
- 代码简化：删除isRestoring、bus.detach()等复杂保护逻辑
- 重新启用自动保存功能，与撤销/重做互不干扰

实现细节：
- 新增createCommandHistory函数和4种命令类型
- iframe中捕获旧值并创建命令对象
- 撤销时执行反向操作，重做时执行正向操作
- 使用元素路径（索引数组）定位元素

Co-Authored-By: Claude Sonnet 4 <noreply@anthropic.com>
```

## 修改的文件

1. **html-editor.html** (主要修改)
   - 添加 `createCommandHistory` 函数
   - 添加 `getElementPath` 和 `findElementByPath` 辅助函数
   - 修改 iframe 注入脚本的 `onMessage` 函数
   - 修改 `dispatchUpMessage` 函数
   - 修改 MessageBus handlers
   - 修改按钮事件监听器
   - 修改 `applyLoadedContent` 函数
   - 删除旧的快照模式代码

2. **README.md**
   - 更新撤销/重做说明，强调命令模式的优势

3. **CHANGELOG.md**
   - 添加版本 1.2.0 的更新日志
   - 标记版本 1.1.0 的快照模式为已废弃

## 新增的文件

1. **COMMAND_PATTERN_IMPLEMENTATION.md**
   - 详细的命令模式实现说明
   - 包含代码示例和技术细节

2. **test-command-undo.html**
   - 命令模式测试页面

3. **verify-command-pattern.sh**
   - 自动验证脚本

4. **IMPLEMENTATION_COMPLETE.md**
   - 实现总结文档

## 删除的代码

- `createHistoryManager` 函数
- `createSnapshot` 函数
- `saveHistorySnapshot` 函数
- `isRestoring` 标志
- `bus.detach()` / `attach()` 调用
- `historyManager.disable()` / `enable()` 调用

## 提交命令

```bash
cd /Volumes/teze/workspace-code/HTML-Editor

# 查看修改
git status
git diff html-editor.html

# 添加文件
git add html-editor.html
git add README.md
git add CHANGELOG.md
git add COMMAND_PATTERN_IMPLEMENTATION.md
git add test-command-undo.html
git add verify-command-pattern.sh
git add IMPLEMENTATION_COMPLETE.md

# 提交
git commit -m "$(cat <<'EOF'
feat: 重构撤销/重做为命令模式，修复只能操作一次的bug

- 采用命令模式（Command Pattern）替代快照模式
- 修复关键bug：现在支持多次撤销/重做（之前只能操作一次）
- 性能提升：不再重新渲染iframe，只修改具体元素
- 内存优化：只保存操作命令，而非完整HTML快照
- 代码简化：删除isRestoring、bus.detach()等复杂保护逻辑
- 重新启用自动保存功能，与撤销/重做互不干扰

实现细节：
- 新增createCommandHistory函数和4种命令类型
- iframe中捕获旧值并创建命令对象
- 撤销时执行反向操作，重做时执行正向操作
- 使用元素路径（索引数组）定位元素

Co-Authored-By: Claude Sonnet 4 <noreply@anthropic.com>
EOF
)"

# 查看提交
git log -1 --stat
```
