// history-manager.js — 撤销/重做历史管理
//
// 职责：
//   - 记录所有编辑操作的历史状态
//   - 支持撤销（undo）和重做（redo）
//   - 管理历史栈的大小限制
//   - 提供历史状态查询（canUndo / canRedo）
//
// 设计原则：
//   - 每次操作记录完整的 DOM 快照（简单但可靠）
//   - 历史栈限制为 50 条，避免内存溢出
//   - 撤销/重做时通过 postMessage 通知 iframe 恢复状态
//
// 导出 API：
//   - createHistoryManager(options)：创建历史管理器实例
//   - push(snapshot)：添加新的历史快照
//   - undo()：撤销到上一个状态
//   - redo()：重做到下一个状态
//   - canUndo()：是否可以撤销
//   - canRedo()：是否可以重做
//   - clear()：清空历史记录

// 历史栈最大长度
export const MAX_HISTORY_SIZE = 50;

/**
 * 创建历史快照对象
 *
 * @param {string} html - 当前 iframe 的完整 HTML
 * @param {object} selectedInfo - 当前选中元素的信息
 * @returns {object} 历史快照
 */
export function createSnapshot(html, selectedInfo = null) {
    return {
        html,
        selectedInfo,
        timestamp: Date.now()
    };
}

/**
 * 创建历史管理器
 *
 * @param {object} options - 配置选项
 * @param {function} options.onStateChange - 状态变化回调（通知 UI 更新按钮状态）
 * @param {function} options.onRestore - 恢复快照回调（通知 iframe 恢复状态）
 * @returns {object} 历史管理器实例
 */
export function createHistoryManager(options = {}) {
    const {
        onStateChange = () => {},
        onRestore = () => {}
    } = options;

    // 历史栈：[oldest, ..., current, ..., newest]
    let history = [];
    // 当前位置指针（指向 history 数组的索引）
    let currentIndex = -1;
    // 是否启用历史记录（加载文件时暂时禁用）
    let enabled = true;

    /**
     * 添加新的历史快照
     *
     * @param {object} snapshot - 历史快照
     */
    function push(snapshot) {
        if (!enabled) return;

        // 如果当前不在历史栈顶部，删除当前位置之后的所有记录
        if (currentIndex < history.length - 1) {
            history = history.slice(0, currentIndex + 1);
        }

        // 添加新快照
        history.push(snapshot);

        // 限制历史栈大小
        if (history.length > MAX_HISTORY_SIZE) {
            history.shift();
        } else {
            currentIndex++;
        }

        // 通知状态变化
        notifyStateChange();
    }

    /**
     * 撤销到上一个状态
     *
     * @returns {object|null} 恢复的快照，如果无法撤销则返回 null
     */
    function undo() {
        if (!canUndo()) return null;

        currentIndex--;
        const snapshot = history[currentIndex];

        // 通知恢复快照
        onRestore(snapshot);
        notifyStateChange();

        return snapshot;
    }

    /**
     * 重做到下一个状态
     *
     * @returns {object|null} 恢复的快照，如果无法重做则返回 null
     */
    function redo() {
        if (!canRedo()) return null;

        currentIndex++;
        const snapshot = history[currentIndex];

        // 通知恢复快照
        onRestore(snapshot);
        notifyStateChange();

        return snapshot;
    }

    /**
     * 是否可以撤销
     *
     * @returns {boolean}
     */
    function canUndo() {
        return enabled && currentIndex > 0;
    }

    /**
     * 是否可以重做
     *
     * @returns {boolean}
     */
    function canRedo() {
        return enabled && currentIndex < history.length - 1;
    }

    /**
     * 清空历史记录
     */
    function clear() {
        history = [];
        currentIndex = -1;
        notifyStateChange();
    }

    /**
     * 暂时禁用历史记录（用于加载文件时）
     */
    function disable() {
        enabled = false;
    }

    /**
     * 启用历史记录
     */
    function enable() {
        enabled = true;
    }

    /**
     * 获取当前历史状态信息（用于调试）
     *
     * @returns {object}
     */
    function getState() {
        return {
            size: history.length,
            currentIndex,
            canUndo: canUndo(),
            canRedo: canRedo(),
            enabled
        };
    }

    /**
     * 通知状态变化
     */
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
        disable,
        enable,
        getState
    };
}
