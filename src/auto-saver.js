// auto-saver.js — 自动保存管理
//
// 职责：
//   - 定期自动保存编辑内容到 localStorage
//   - 在页面加载时恢复未保存的内容
//   - 提供手动保存和清除功能
//   - 显示保存状态提示
//
// 设计原则：
//   - 使用 localStorage 存储（浏览器本地，无需服务器）
//   - 防抖保存：修改后 2 秒无新修改才保存（避免频繁写入）
//   - 存储原始文件名和修改时间，便于恢复识别
//   - 保存成功后显示提示，3 秒后自动消失
//
// 导出 API：
//   - createAutoSaver(options)：创建自动保存器实例
//   - scheduleSave()：调度一次保存（防抖）
//   - saveNow()：立即保存
//   - restore()：恢复上次未保存的内容
//   - clear()：清除保存的内容
//   - hasSavedContent()：是否有保存的内容

// localStorage 键名
const STORAGE_KEY = 'html-editor-autosave';
const STORAGE_META_KEY = 'html-editor-autosave-meta';

// 自动保存延迟（毫秒）
export const AUTO_SAVE_DELAY = 2000;

// 保存提示显示时长（毫秒）
const SAVE_HINT_DURATION = 3000;

/**
 * 创建自动保存器
 *
 * @param {object} options - 配置选项
 * @param {function} options.getContent - 获取当前内容的函数，返回 {html, filename}
 * @param {function} options.onSaved - 保存成功回调
 * @param {function} options.onRestored - 恢复成功回调
 * @returns {object} 自动保存器实例
 */
export function createAutoSaver(options = {}) {
    const {
        getContent = () => ({ html: '', filename: '' }),
        onSaved = () => {},
        onRestored = () => {}
    } = options;

    let saveTimer = null;
    let lastSavedTime = null;

    /**
     * 调度一次保存（防抖）
     */
    function scheduleSave() {
        // 清除之前的定时器
        if (saveTimer) {
            clearTimeout(saveTimer);
        }

        // 设置新的定时器
        saveTimer = setTimeout(() => {
            saveNow();
        }, AUTO_SAVE_DELAY);
    }

    /**
     * 立即保存
     */
    function saveNow() {
        try {
            const { html, filename } = getContent();

            if (!html) {
                console.warn('[AutoSaver] 没有内容可保存');
                return false;
            }

            // 保存内容
            localStorage.setItem(STORAGE_KEY, html);

            // 保存元数据
            const meta = {
                filename: filename || '未命名文件',
                savedAt: Date.now(),
                size: html.length
            };
            localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));

            lastSavedTime = Date.now();

            // 通知保存成功
            onSaved(meta);

            console.log('[AutoSaver] 保存成功:', meta);
            return true;

        } catch (error) {
            console.error('[AutoSaver] 保存失败:', error);
            return false;
        }
    }

    /**
     * 恢复上次保存的内容
     *
     * @returns {object|null} 恢复的内容 {html, meta}，如果没有则返回 null
     */
    function restore() {
        try {
            const html = localStorage.getItem(STORAGE_KEY);
            const metaStr = localStorage.getItem(STORAGE_META_KEY);

            if (!html || !metaStr) {
                return null;
            }

            const meta = JSON.parse(metaStr);

            // 通知恢复成功
            onRestored({ html, meta });

            console.log('[AutoSaver] 恢复成功:', meta);
            return { html, meta };

        } catch (error) {
            console.error('[AutoSaver] 恢复失败:', error);
            return null;
        }
    }

    /**
     * 清除保存的内容
     */
    function clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_META_KEY);
            lastSavedTime = null;
            console.log('[AutoSaver] 已清除保存内容');
            return true;
        } catch (error) {
            console.error('[AutoSaver] 清除失败:', error);
            return false;
        }
    }

    /**
     * 是否有保存的内容
     *
     * @returns {boolean}
     */
    function hasSavedContent() {
        try {
            return !!localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取保存的元数据
     *
     * @returns {object|null}
     */
    function getSavedMeta() {
        try {
            const metaStr = localStorage.getItem(STORAGE_META_KEY);
            return metaStr ? JSON.parse(metaStr) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * 获取上次保存时间
     *
     * @returns {number|null} 时间戳
     */
    function getLastSavedTime() {
        return lastSavedTime;
    }

    /**
     * 停止自动保存（清除定时器）
     */
    function stop() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
    }

    return {
        scheduleSave,
        saveNow,
        restore,
        clear,
        hasSavedContent,
        getSavedMeta,
        getLastSavedTime,
        stop
    };
}

/**
 * 格式化保存时间为可读文本
 *
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化的时间文本
 */
export function formatSaveTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    // 小于 1 分钟
    if (diff < 60000) {
        return '刚刚';
    }

    // 小于 1 小时
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} 分钟前`;
    }

    // 小于 24 小时
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} 小时前`;
    }

    // 超过 24 小时，显示具体日期
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
