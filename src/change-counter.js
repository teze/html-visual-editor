// change-counter.js — 修改计数与状态文本（需求 11）
//
// 维护 0..999999 的修改计数（ChangeCounter），渲染计数文本「N 处修改」，
// 并由 statusLabel 推导「就绪 / 已修改」状态指示。
//
// 设计约定（参见 design.md「6. Status_Bar & ChangeCounter」与需求 11）：
//   - reset()：文件加载时归零（需求 11.1），同时清空全部内联编辑会话去重标记。
//   - increment()：属性变更 / 单次内联编辑会话 / 删除元素 +1，上限 MAX_CHANGE_COUNT（需求 11.2）。
//   - 内联编辑会话去重：同一次编辑会话（从进入 contentEditable 到 blur 退出）内的多次
//     input 仅计 1（需求 4.4）。通过「会话标记 token」实现 increment-once-per-session 语义。
//   - render()：渲染为 "N 处修改"（需求 11.3）；纯文本计算由 formatCountText 提供，便于无 DOM 测试。
//   - statusLabel(count, hasError)：count==0 且无错误 → 「就绪」（需求 11.4）；
//     count>0 且无错误 → 「已修改」（需求 11.5）；处于错误状态时返回 null（由状态栏改显错误信息）。
//
// 本模块为框架无关的纯逻辑：核心计数与文本计算不依赖 DOM；render 可选地接受一个
// 目标元素（任意带可写 textContent 的对象），仅在提供时才进行 DOM 文本更新。

// Change_Count 取值上限（需求 11.2）。
export const MAX_CHANGE_COUNT = 999999;

// 状态指示文案常量（需求 11.4 / 11.5）。
export const STATUS_READY = '就绪';
export const STATUS_MODIFIED = '已修改';

/**
 * 计数文本纯函数：将计数 N 渲染为 "N 处修改"（需求 11.3）。
 *
 * 仅做文本格式化，不触碰 DOM，便于属性测试（Property 20）独立验证。
 * 入参会被规范化为非负整数并夹取到 [0, MAX_CHANGE_COUNT]，
 * 以保证任何调用都产出形如 "N 处修改" 的合法文本。
 *
 * @param {number} count 当前修改计数
 * @returns {string} 形如 "0 处修改" / "12 处修改" 的文本
 */
export function formatCountText(count) {
    return clampCount(count) + ' 处修改';
}

/**
 * 状态指示纯函数：根据计数与错误状态推导「就绪 / 已修改」（需求 11.4 / 11.5）。
 *
 * - hasError 为真：返回 null —— 处于错误状态，就绪/已修改指示不适用，
 *   调用方（Status_Bar）应改为显示具体错误信息。
 * - 无错误且 count == 0：返回「就绪」。
 * - 无错误且 count > 0：返回「已修改」。
 *
 * @param {number} count 当前修改计数
 * @param {boolean} [hasError=false] 编辑器是否处于错误状态
 * @returns {string|null} 「就绪」/「已修改」，或错误状态下的 null
 */
export function statusLabel(count, hasError = false) {
    if (hasError) {
        return null;
    }
    return clampCount(count) > 0 ? STATUS_MODIFIED : STATUS_READY;
}

// 将任意输入规范化为 [0, MAX_CHANGE_COUNT] 内的整数。
// 非数值 / NaN / 负数一律归零；超过上限夹取到上限。
function clampCount(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0) {
        return 0;
    }
    return n > MAX_CHANGE_COUNT ? MAX_CHANGE_COUNT : n;
}

/**
 * ChangeCounter — 修改计数器。
 *
 * 维护 0..999999 的累计修改次数，并提供内联编辑会话的「每会话仅计一次」语义。
 *
 * 典型用法：
 *
 *   const counter = new ChangeCounter();
 *
 *   // 文件加载成功：归零
 *   counter.reset();                       // count = 0
 *
 *   // 属性变更 / 删除元素：直接 +1
 *   counter.increment();                   // count = 1
 *
 *   // 内联编辑会话（同一会话多次 input 仅计 1）：
 *   const token = counter.beginEditSession('p#intro');  // 进入 contentEditable
 *   counter.markEditSessionChanged(token);              // 首次 input → +1
 *   counter.markEditSessionChanged(token);              // 同会话再次 input → 不计
 *   counter.endEditSession(token);                      // blur 退出，结束会话
 *
 *   // 便捷写法：每会话用唯一 id，一行完成「每会话仅计一次」
 *   const sid = counter.nextSessionId();
 *   counter.incrementOncePerSession(sid);  // 首次 → +1
 *   counter.incrementOncePerSession(sid);  // 同 id → 不计
 */
export class ChangeCounter {
    constructor() {
        // 当前修改计数，取值范围 0..MAX_CHANGE_COUNT。
        this.count = 0;
        // 本会话内已计入修改的会话 token 集合（去重标记）。
        this._countedSessions = new Set();
        // 用于 nextSessionId 生成单调递增的唯一会话标识。
        this._sessionSeq = 0;
    }

    /**
     * 文件加载时归零（需求 11.1）。
     * 同时清空全部内联编辑会话去重标记，使新文件从干净状态开始计数。
     * @returns {number} 归零后的计数（恒为 0）
     */
    reset() {
        this.count = 0;
        this._countedSessions.clear();
        return this.count;
    }

    /**
     * 计数 +1，上限 MAX_CHANGE_COUNT（需求 11.2）。
     * 用于属性变更、删除元素，以及内联编辑会话的首次计入。
     * 达到上限后再次调用保持在上限，不会溢出。
     * @returns {number} 递增后的计数
     */
    increment() {
        if (this.count < MAX_CHANGE_COUNT) {
            this.count += 1;
        }
        return this.count;
    }

    /**
     * 生成一个唯一的内联编辑会话标识，供 incrementOncePerSession 使用。
     * 每次进入 contentEditable 编辑态时调用一次，确保不同会话互不串扰。
     * @returns {string} 形如 "s1"、"s2" 的唯一会话标识
     */
    nextSessionId() {
        this._sessionSeq += 1;
        return 's' + this._sessionSeq;
    }

    /**
     * 开始一次内联编辑会话（进入 contentEditable 时调用）。
     * 清除该 token 之前的计入标记，使「重新进入编辑同一元素」被视为新会话、可再次计 1。
     * @param {string} token 会话标记（如元素路径 / 唯一 id）
     * @returns {string} 传入的 token，便于链式使用
     */
    beginEditSession(token) {
        this._countedSessions.delete(token);
        return token;
    }

    /**
     * 标记本会话发生了一次文字变更（input 事件时调用），每会话仅计一次（需求 4.4）。
     * 首次调用使计数 +1 并记录该 token 已计入；同一 token 的后续调用为无操作。
     * 未显式 beginEditSession 时也可直接调用（首次自动计入）。
     * @param {string} token 会话标记
     * @returns {boolean} 本次是否实际计入（true=已 +1；false=本会话此前已计入）
     */
    markEditSessionChanged(token) {
        if (this._countedSessions.has(token)) {
            return false;
        }
        this._countedSessions.add(token);
        this.increment();
        return true;
    }

    /**
     * 结束一次内联编辑会话（blur 退出 contentEditable 时调用）。
     * 清除该 token 的计入标记，释放去重状态。
     * @param {string} token 会话标记
     */
    endEditSession(token) {
        this._countedSessions.delete(token);
    }

    /**
     * 便捷接口：对给定会话标识「每会话仅计一次」地递增。
     * 与「beginEditSession + markEditSessionChanged」等价的一行写法，
     * 要求每个独立会话使用唯一的 sessionId（可由 nextSessionId 生成）。
     * @param {string} sessionId 唯一会话标识
     * @returns {boolean} 本次是否实际计入
     */
    incrementOncePerSession(sessionId) {
        return this.markEditSessionChanged(sessionId);
    }

    /**
     * 渲染计数文本 "N 处修改"（需求 11.3）。
     * 可选地把文本写入目标元素的 textContent（保持核心可无 DOM 测试）。
     * @param {{ textContent: string }} [target] 任意带可写 textContent 的对象（如 DOM 元素）
     * @returns {string} 渲染出的文本，如 "3 处修改"
     */
    render(target) {
        const text = formatCountText(this.count);
        if (target && typeof target === 'object' && 'textContent' in target) {
            target.textContent = text;
        }
        return text;
    }

    /**
     * 取当前的状态指示「就绪 / 已修改」（需求 11.4 / 11.5）。
     * @param {boolean} [hasError=false] 编辑器是否处于错误状态
     * @returns {string|null} 「就绪」/「已修改」，或错误状态下的 null
     */
    statusLabel(hasError = false) {
        return statusLabel(this.count, hasError);
    }
}