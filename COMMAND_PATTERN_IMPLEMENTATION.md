# 命令模式撤销/重做实现说明

## 实现时间
2026-05-31

## 问题背景

原有的快照模式（snapshot-based）撤销/重做存在严重问题：
- 每次撤销/重做都需要重新渲染整个 iframe（使用 `iframe.srcdoc`）
- iframe 重新加载会触发各种事件，导致历史栈被污染
- 即使使用 `isRestoring` 标志、断开 MessageBus、禁用历史管理器等保护措施，仍然只能撤销/重做一次

## 解决方案：命令模式（Command Pattern）

### 核心思想
- 不保存完整的 HTML 快照
- 只记录每次的具体操作（修改颜色、修改文字、删除元素等）
- 每个命令都是可逆的（有正向和反向操作）
- 撤销时执行反向操作，重做时执行正向操作
- 不需要重新渲染 iframe，只需要修改具体的元素

### 命令类型

#### 1. UpdateStyle - 样式更新命令
```javascript
{
    type: 'UpdateStyle',
    elementPath: [0, 1, 2],  // 元素路径
    property: 'color',        // CSS 属性
    oldValue: '#333',         // 旧值
    newValue: '#ff0000',      // 新值
    timestamp: 1234567890
}
```

#### 2. UpdateText - 文字更新命令
```javascript
{
    type: 'UpdateText',
    elementPath: [0, 1, 2],
    oldText: '原始文字',
    newText: '修改后的文字',
    timestamp: 1234567890
}
```

#### 3. UpdateAttribute - 属性更新命令
```javascript
{
    type: 'UpdateAttribute',
    elementPath: [0, 1, 2],
    attribute: 'src',         // 属性名（src, href 等）
    oldValue: 'old.jpg',
    newValue: 'new.jpg',
    timestamp: 1234567890
}
```

#### 4. DeleteElement - 删除元素命令
```javascript
{
    type: 'DeleteElement',
    elementPath: [0, 1, 2],
    elementHTML: '<div>...</div>',  // 保存完整 HTML 用于恢复
    parentPath: [0, 1],              // 父元素路径
    indexInParent: 2,                // 在父元素中的索引
    timestamp: 1234567890
}
```

## 实现细节

### 1. iframe 注入脚本修改

#### 添加辅助函数
```javascript
// 根据路径查找元素
function findElementByPath(path) {
    if (!path || path.length === 0) return null;
    var el = document.body;
    for (var i = 0; i < path.length; i++) {
        if (!el || !el.children) return null;
        el = el.children[path[i]];
    }
    return el;
}

// 获取元素路径
function getElementPath(element, root) {
    var path = [];
    var current = element;
    root = root || document.body;
    
    while (current && current !== root && current.parentElement) {
        var parent = current.parentElement;
        var index = Array.prototype.indexOf.call(parent.children, current);
        if (index === -1) break;
        path.unshift(index);
        current = parent;
    }
    
    return path;
}
```

#### 添加命令消息处理
```javascript
function onMessage(e) {
    var data = e && e.data;
    if (!data) return;

    // 处理撤销/重做的命令消息
    if (data.type === 'updateStyle') {
        var el = findElementByPath(data.elementPath);
        if (el && el.style) {
            el.style[data.property] = data.value;
        }
        return;
    }

    if (data.type === 'updateText') {
        var el = findElementByPath(data.elementPath);
        if (el) {
            el.textContent = data.text;
        }
        return;
    }

    // ... 其他命令类型处理
}
```

#### 修改 update 消息处理，捕获旧值并创建命令
```javascript
// 原有的 update 消息处理
if (data.type !== 'update') return;
if (!selectedEl) return;

var prop = data.prop;
var val = data.val == null ? '' : data.val;
var path = getElementPath(selectedEl, document.body);

if (prop === 'text') {
    var oldValue = selectedEl.textContent;
    selectedEl.textContent = String(val);
    post({
        type: 'changed',
        command: {
            type: 'UpdateText',
            elementPath: path,
            oldText: oldValue,
            newText: String(val)
        }
    });
} else if (prop === 'color') {
    var oldValue = selectedEl.style.color || '';
    selectedEl.style.color = val;
    post({
        type: 'changed',
        command: {
            type: 'UpdateStyle',
            elementPath: path,
            property: 'color',
            oldValue: oldValue,
            newValue: val
        }
    });
}
// ... 其他属性处理
```

### 2. 父窗口修改

#### 创建命令历史管理器
```javascript
var commandHistory = createCommandHistory({
    onStateChange: function(state) {
        undoBtn.disabled = !state.canUndo;
        redoBtn.disabled = !state.canRedo;
    },
    sendMessage: function(message) {
        iframe.contentWindow.postMessage(message, '*');
    }
});
```

#### 修改 MessageBus 的 dispatchUpMessage
```javascript
function dispatchUpMessage(message, handlers) {
    // ...
    switch (type) {
        case 'changed':
            fn(message.command);  // 传递命令对象
            break;
        case 'deleted':
            fn(message.command);  // 传递命令对象
            break;
        // ...
    }
}
```

#### 修改 MessageBus handlers
```javascript
var bus = createMessageBus({
    iframe: iframe,
    handlers: {
        onChanged: function(command) {
            // 推送命令到历史记录
            if (command) {
                commandHistory.push(command);
            }
            // ... 其他处理
        },
        onDeleted: function(command) {
            // 推送命令到历史记录
            if (command) {
                commandHistory.push(command);
            }
            // ... 其他处理
        }
    }
});
```

### 3. 命令历史管理器实现

```javascript
function createCommandHistory(options) {
    var history = [];
    var currentIndex = -1;

    function push(command) {
        // 如果不在栈顶，删除后面的历史
        if (currentIndex < history.length - 1) {
            history = history.slice(0, currentIndex + 1);
        }
        history.push(command);
        if (history.length > MAX_HISTORY_SIZE) {
            history.shift();
        } else {
            currentIndex++;
        }
        notifyStateChange();
    }

    function undo() {
        if (!canUndo()) return false;
        var command = history[currentIndex];
        currentIndex--;
        executeReverse(command);  // 执行反向操作
        notifyStateChange();
        return true;
    }

    function redo() {
        if (!canRedo()) return false;
        currentIndex++;
        var command = history[currentIndex];
        executeForward(command);  // 执行正向操作
        notifyStateChange();
        return true;
    }

    function executeReverse(command) {
        switch (command.type) {
            case 'UpdateStyle':
                sendMessage({
                    type: 'updateStyle',
                    elementPath: command.elementPath,
                    property: command.property,
                    value: command.oldValue  // 使用旧值
                });
                break;
            // ... 其他命令类型
        }
    }

    function executeForward(command) {
        switch (command.type) {
            case 'UpdateStyle':
                sendMessage({
                    type: 'updateStyle',
                    elementPath: command.elementPath,
                    property: command.property,
                    value: command.newValue  // 使用新值
                });
                break;
            // ... 其他命令类型
        }
    }

    return { push, undo, redo, canUndo, canRedo, clear, getState };
}
```

## 优势对比

### 快照模式（旧方案）
- ❌ 需要保存完整 HTML，内存占用大
- ❌ 撤销/重做需要重新渲染 iframe
- ❌ iframe 重新加载会触发事件，污染历史栈
- ❌ 只能撤销/重做一次
- ❌ 需要复杂的保护机制（isRestoring、bus.detach() 等）

### 命令模式（新方案）
- ✅ 只保存操作命令，内存占用小
- ✅ 撤销/重做只修改具体元素，不重新渲染
- ✅ 不会触发额外事件，历史栈保持干净
- ✅ 可以多次撤销/重做
- ✅ 实现简洁，不需要复杂的保护机制

## 测试步骤

1. 打开 `html-editor.html`
2. 加载 `test-command-undo.html` 测试文件
3. 选中第一段文字，修改颜色为红色
4. 修改文字内容
5. 点击"↶ 撤销"按钮或按 `Ctrl+Z`
   - 应该恢复文字内容
6. 再次点击"↶ 撤销"
   - 应该恢复颜色
7. 点击"↷ 重做"按钮或按 `Ctrl+Y`
   - 应该重新应用颜色修改
8. 再次点击"↷ 重做"
   - 应该重新应用文字修改
9. 验证可以多次撤销/重做

## 已修改的文件

1. `html-editor.html`
   - 添加 `createCommandHistory` 函数（替代 `createHistoryManager`）
   - 添加 `getElementPath` 辅助函数
   - 修改 iframe 注入脚本的 `onMessage` 函数
   - 修改 `dispatchUpMessage` 函数
   - 修改 MessageBus handlers
   - 修改按钮事件监听器
   - 修改 `applyLoadedContent` 函数
   - 删除 `isRestoring` 标志和相关逻辑
   - 删除 `saveHistorySnapshot` 函数

2. `test-command-undo.html`（新增）
   - 简单的测试页面

3. `COMMAND_PATTERN_IMPLEMENTATION.md`（本文件）
   - 实现说明文档

## 已删除的代码

- `createHistoryManager` 函数
- `createSnapshot` 函数
- `saveHistorySnapshot` 函数
- `isRestoring` 标志
- `historyManager.disable()` / `enable()` 调用
- `bus.detach()` / `attach()` 调用
- 所有与快照恢复相关的延迟和保护逻辑

## 注意事项

1. **元素路径的稳定性**
   - 元素路径基于子元素索引，如果 DOM 结构发生变化（如插入/删除其他元素），路径可能失效
   - 当前实现假设撤销/重做期间 DOM 结构相对稳定
   - 如果需要支持更复杂的场景，可以考虑使用元素 ID 或其他稳定标识符

2. **innerHTML 的安全性**
   - 在 `restoreElement` 中使用了 `innerHTML`，存在 XSS 风险
   - 由于恢复的是用户自己编辑的内容，风险相对可控
   - 未来可以考虑使用 DOMPurify 等库进行清理

3. **自动保存已重新启用**
   - 命令模式不会触发 iframe 重新加载，因此可以安全地启用自动保存
   - 自动保存和撤销/重做可以同时工作，互不干扰

## 未来改进方向

1. **命令合并**
   - 连续的相同类型操作可以合并为一个命令
   - 例如：连续修改颜色多次，只保存最终结果

2. **命令持久化**
   - 将命令历史保存到 localStorage
   - 支持跨会话恢复历史记录

3. **更稳定的元素标识**
   - 使用元素 ID 或自定义属性作为标识符
   - 避免路径失效问题

4. **批量操作支持**
   - 支持将多个命令组合为一个宏命令
   - 一次撤销/重做可以影响多个元素

## 总结

命令模式成功解决了快照模式的所有问题，实现了可靠的多次撤销/重做功能。这是一个经典的设计模式应用案例，展示了如何通过改变数据结构和算法来解决看似无解的问题。
