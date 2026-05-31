// command-history.js — 基于命令模式的撤销/重做
//
// 设计思路：
//   - 不保存完整的 HTML 快照，而是记录每次的具体操作
//   - 每个操作都是可逆的（有 execute 和 undo 方法）
//   - 撤销时执行反向操作，不需要重新渲染整个 iframe
//
// 支持的操作类型：
//   - UpdateStyle: 修改元素样式
//   - UpdateText: 修改元素文字
//   - UpdateAttribute: 修改元素属性
//   - DeleteElement: 删除元素

export const MAX_HISTORY_SIZE = 50;

/**
 * 创建样式更新命令
 */
export function createUpdateStyleCommand(elementPath, property, oldValue, newValue) {
    return {
        type: 'UpdateStyle',
        elementPath: elementPath,
        property: property,
        oldValue: oldValue,
        newValue: newValue,
        timestamp: Date.now()
    };
}

/**
 * 创建文字更新命令
 */
export function createUpdateTextCommand(elementPath, oldText, newText) {
    return {
        type: 'UpdateText',
        elementPath: elementPath,
        oldText: oldText,
        newText: newText,
        timestamp: Date.now()
    };
}

/**
 * 创建属性更新命令
 */
export function createUpdateAttributeCommand(elementPath, attribute, oldValue, newValue) {
    return {
        type: 'UpdateAttribute',
        elementPath: elementPath,
        attribute: attribute,
        oldValue: oldValue,
        newValue: newValue,
        timestamp: Date.now()
    };
}

/**
 * 创建删除元素命令
 */
export function createDeleteElementCommand(elementPath, elementHTML, parentPath, indexInParent) {
    return {
        type: 'DeleteElement',
        elementPath: elementPath,
        elementHTML: elementHTML,
        parentPath: parentPath,
        indexInParent: indexInParent,
        timestamp: Date.now()
    };
}

/**
 * 创建基于命令的历史管理器
 */
export function createCommandHistory(options = {}) {
    const {
        onStateChange = () => {},
        sendMessage = () => {}  // 向 iframe 发送消息的函数
    } = options;

    let history = [];
    let currentIndex = -1;

    function push(command) {
        // 如果不在栈顶，删除后面的历史
        if (currentIndex < history.length - 1) {
            history = history.slice(0, currentIndex + 1);
        }

        history.push(command);

        // 限制历史栈大小
        if (history.length > MAX_HISTORY_SIZE) {
            history.shift();
        } else {
            currentIndex++;
        }

        notifyStateChange();
    }

    function undo() {
        if (!canUndo()) return false;

        const command = history[currentIndex];
        currentIndex--;

        // 执行反向操作
        executeReverse(command);

        notifyStateChange();
        return true;
    }

    function redo() {
        if (!canRedo()) return false;

        currentIndex++;
        const command = history[currentIndex];

        // 执行正向操作
        executeForward(command);

        notifyStateChange();
        return true;
    }

    function executeReverse(command) {
        switch (command.type) {
            case 'UpdateStyle':
                // 恢复旧样式值
                sendMessage({
                    type: 'updateStyle',
                    elementPath: command.elementPath,
                    property: command.property,
                    value: command.oldValue
                });
                break;

            case 'UpdateText':
                // 恢复旧文字
                sendMessage({
                    type: 'updateText',
                    elementPath: command.elementPath,
                    text: command.oldText
                });
                break;

            case 'UpdateAttribute':
                // 恢复旧属性值
                sendMessage({
                    type: 'updateAttribute',
                    elementPath: command.elementPath,
                    attribute: command.attribute,
                    value: command.oldValue
                });
                break;

            case 'DeleteElement':
                // 恢复被删除的元素
                sendMessage({
                    type: 'restoreElement',
                    parentPath: command.parentPath,
                    elementHTML: command.elementHTML,
                    indexInParent: command.indexInParent
                });
                break;
        }
    }

    function executeForward(command) {
        switch (command.type) {
            case 'UpdateStyle':
                // 应用新样式值
                sendMessage({
                    type: 'updateStyle',
                    elementPath: command.elementPath,
                    property: command.property,
                    value: command.newValue
                });
                break;

            case 'UpdateText':
                // 应用新文字
                sendMessage({
                    type: 'updateText',
                    elementPath: command.elementPath,
                    text: command.newText
                });
                break;

            case 'UpdateAttribute':
                // 应用新属性值
                sendMessage({
                    type: 'updateAttribute',
                    elementPath: command.elementPath,
                    attribute: command.attribute,
                    value: command.newValue
                });
                break;

            case 'DeleteElement':
                // 重新删除元素
                sendMessage({
                    type: 'deleteElement',
                    elementPath: command.elementPath
                });
                break;
        }
    }

    function canUndo() {
        return currentIndex >= 0;
    }

    function canRedo() {
        return currentIndex < history.length - 1;
    }

    function clear() {
        history = [];
        currentIndex = -1;
        notifyStateChange();
    }

    function getState() {
        return {
            size: history.length,
            currentIndex: currentIndex,
            canUndo: canUndo(),
            canRedo: canRedo()
        };
    }

    function notifyStateChange() {
        onStateChange({
            canUndo: canUndo(),
            canRedo: canRedo()
        });
    }

    return {
        push,
        undo,
        redo,
        canUndo,
        canRedo,
        clear,
        getState
    };
}
