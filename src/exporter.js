// exporter.js — 导出器：清理、序列化、下载、无内容处理与导出后重注入
//                （任务 8.1 + 8.2，需求 10.1–10.7）
//
// 职责：
//   1. 读取 iframe.contentDocument，移除 id="__htmledit__" 的注入脚本节点。
//   2. 还原带 data-saved-outline 标记节点的编辑态样式（清除/还原
//      outline、清除编辑器添加的 outline-offset 与 cursor）。
//   3. 序列化 '<!DOCTYPE html>\n' + documentElement.outerHTML，
//      生成 Blob 并触发 .html 文件下载。
//   4. 【8.2】无内容导出处理：未加载内容时取消导出、不下载并提示「无可导出内容」（需求 10.6）。
//   5. 【8.2】导出后 1 秒内重注入脚本，保留全部修改、恢复可继续编辑（需求 10.7）。
//   6. 【8.2】导出全流程以 try/catch 包裹，异常时经状态栏提示「导出出错」。
//
// 设计为可测试：把「清理 + 序列化」的纯逻辑（cleanAndSerialize）与浏览器
// 下载副作用（triggerDownload）拆开，前者可在 jsdom 下独立测试。导出编排
// （exportHtml）的所有外部依赖（内容判定 hasContent、重注入 reinject、状态栏
// onError/onStatus、计时器 setTimeoutFn）均以注入方式提供，便于确定性测试，
// 也使 exporter 不硬依赖 preview-frame（解耦）。
//
// 满足 Property 21（导出产物干净性）：对任意编辑状态的预览 DOM，
// cleanAndSerialize 产出的 HTML 文本不含 id="__htmledit__" 注入脚本，
// 也不含编辑器添加的 outline / outline-offset / cursor 编辑态样式。
// 支撑 Property 22（导出保真与可继续编辑）：导出后经 reinject 回调重注入脚本，
// 在保留全部修改的同时恢复可编辑状态。

// 注入脚本节点的 id（与 src/inject.js 的 INJECTED_SCRIPT_ID 一致）。
// 这里本地声明而非跨模块导入，保持 exporter.js 自包含、可独立测试，
// 并避免与正在并行开发的其他模块产生耦合。
export const INJECTED_SCRIPT_ID = '__htmledit__';

// 编辑器在注入脚本中给「曾被施加编辑态 outline 的元素」打的标记属性。
//
// data-saved-outline 契约（与 src/injected-script.js 的约定）：
//   - 当注入脚本为某元素施加编辑态 outline（悬停高亮 rgba(0,212,170,0.35)
//     或选中边框 #00d4aa）时，先把该元素「原始的内联 outline 值」写入
//     data-saved-outline 属性（原本没有内联 outline 时存为空串 ""），
//     随后再设置编辑态的 outline / outline-offset / cursor 内联样式。
//   - 导出清理时，对每个带 data-saved-outline 的元素：
//       * 还原 outline 为保存的原始值（保存值为空串时移除内联 outline）；
//       * 移除编辑器添加的 outline-offset 与 cursor 内联样式；
//       * 移除 data-saved-outline 标记属性本身。
//   - outline-offset 与 cursor 被视为「纯编辑器添加」的编辑态样式，清理时直接移除。
//     （若未来注入脚本需要保留这些属性的原始值，可扩展为额外的 data-saved-* 标记。）
export const SAVED_OUTLINE_ATTR = 'data-saved-outline';

// 清理时需要移除/还原的编辑态内联样式属性。
const EDITOR_STATE_STYLE_PROPS = ['outline', 'outline-offset', 'cursor'];

// 无可导出内容提示（需求 10.6）：Preview_Frame 未加载任何 HTML 内容时使用。
export const NO_CONTENT_MESSAGE = '无可导出内容';

// 导出异常兜底提示（设计「导出异常兜底」约定）：导出过程抛错时经状态栏提示。
// 实际提示会在该前缀后追加具体错误信息（若有），如「导出出错：xxx」。
export const EXPORT_ERROR_MESSAGE = '导出出错';

// 导出成功状态提示（可选，经 onStatus 回调下发）。
export const EXPORT_DONE_MESSAGE = '已导出';

// 导出后重注入的默认延迟（毫秒）。设为 0 表示尽快（下一个 tick）重注入，
// 远小于需求 10.7 要求的「1 秒内」。调用方可经 options.reinjectDelayMs 调整，
// 但应保持 < 1000 以满足 10.7。
export const DEFAULT_REINJECT_DELAY_MS = 0;

/**
 * 移除文档中所有 id="__htmledit__" 的注入脚本节点（需求 10.3）。
 * 使用 querySelectorAll 以兼容（理论上不应出现的）重复 id 情况，逐一移除。
 *
 * @param {Document} doc 目标文档（iframe.contentDocument）
 */
function removeInjectedScript(doc) {
    const nodes = doc.querySelectorAll('#' + INJECTED_SCRIPT_ID);
    nodes.forEach((node) => {
        if (node && typeof node.remove === 'function') {
            node.remove();
        } else if (node && node.parentNode) {
            node.parentNode.removeChild(node);
        }
    });
}

/**
 * 还原单个带 data-saved-outline 标记节点的编辑态样式（需求 10.4）。
 * 还原 outline 为保存的原始值，移除编辑器添加的 outline-offset 与 cursor，
 * 并清除标记属性；若清理后 style 属性为空则一并移除空的 style="" 属性。
 *
 * @param {Element} el 带 data-saved-outline 标记的元素
 */
function restoreEditorOutline(el) {
    const saved = el.getAttribute(SAVED_OUTLINE_ATTR);

    if (el.style) {
        // 还原原始内联 outline：非空则写回原值，空串/缺失则移除内联 outline。
        if (saved) {
            el.style.setProperty('outline', saved);
        } else {
            el.style.removeProperty('outline');
        }
        // 移除编辑器添加的 outline-offset 与 cursor 编辑态样式。
        el.style.removeProperty('outline-offset');
        el.style.removeProperty('cursor');
    }

    // 移除标记属性本身，避免残留在导出产物中。
    el.removeAttribute(SAVED_OUTLINE_ATTR);

    // 清理后若 style 属性变为空串，移除空的 style="" 以保持产物整洁。
    if (el.getAttribute('style') === '') {
        el.removeAttribute('style');
    }
}

/**
 * 清理文档中所有编辑器添加的编辑态 outline/outline-offset/cursor 样式（需求 10.4）。
 * 仅作用于带 data-saved-outline 标记的元素（见 SAVED_OUTLINE_ATTR 契约）。
 *
 * @param {Document} doc 目标文档
 */
function clearEditorStateStyles(doc) {
    const marked = doc.querySelectorAll('[' + SAVED_OUTLINE_ATTR + ']');
    marked.forEach(restoreEditorOutline);
}

/**
 * 清理并序列化文档为干净的 HTML 文本（纯逻辑，可在 jsdom 下测试）。
 *
 * 步骤（需求 10.1、10.3、10.4、10.5）：
 *   1. 移除 id="__htmledit__" 注入脚本节点。
 *   2. 还原带 data-saved-outline 标记节点的编辑态样式
 *      （还原/清除 outline，清除 outline-offset 与 cursor，移除标记属性）。
 *   3. 序列化为 '<!DOCTYPE html>\n' + documentElement.outerHTML。
 *
 * 说明：本函数会就地修改传入的文档（移除脚本、清理样式），这与导出流程一致
 * ——导出后由后续步骤（8.2）重新渲染/注入脚本以恢复可编辑状态。
 *
 * @param {Document} doc iframe.contentDocument
 * @returns {string} 干净的完整 HTML 文本（含 DOCTYPE）
 */
export function cleanAndSerialize(doc) {
    if (!doc || !doc.documentElement) {
        throw new Error('cleanAndSerialize: 需要一个有效的 Document');
    }

    // 1. 移除注入脚本节点。
    removeInjectedScript(doc);

    // 2. 清除/还原编辑态样式。
    clearEditorStateStyles(doc);

    // 3. 序列化为带 DOCTYPE 的完整 HTML 文本。
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

/**
 * 规范化下载文件名，确保以 .html 结尾（需求 10.2）。
 *
 * @param {string} [filename] 期望的文件名
 * @returns {string} 以 .html 结尾的文件名
 */
function normalizeHtmlFilename(filename) {
    const name = typeof filename === 'string' ? filename.trim() : '';
    if (!name) {
        return 'export.html';
    }
    return /\.html$/i.test(name) ? name : name + '.html';
}

/**
 * 由 HTML 文本生成 Blob 并触发浏览器 .html 文件下载（需求 10.2）。
 *
 * 这是与浏览器环境耦合的副作用部分；在非浏览器环境（缺少 document 或
 * URL.createObjectURL）下安全 no-op 并返回 false，便于在 jsdom 下不报错。
 *
 * @param {string} htmlString 要下载的 HTML 文本
 * @param {string} [filename] 下载文件名（自动补全 .html 扩展名）
 * @returns {boolean} 是否成功触发了下载
 */
export function triggerDownload(htmlString, filename) {
    // 环境守卫：非浏览器或缺少必要 API 时安全 no-op。
    if (
        typeof document === 'undefined' ||
        typeof URL === 'undefined' ||
        typeof URL.createObjectURL !== 'function' ||
        typeof Blob === 'undefined'
    ) {
        return false;
    }

    const name = normalizeHtmlFilename(filename);
    const blob = new Blob([String(htmlString)], {
        type: 'text/html;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);

    try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        // 始终释放对象 URL，避免内存泄漏。
        URL.revokeObjectURL(url);
    }

    return true;
}

/**
 * 判定 Preview_Frame 是否已加载可导出的 HTML 内容（需求 10.6）。
 *
 * 「已加载内容」的实务判定：iframe 拥有可访问的 contentDocument，且其
 * documentElement 下的 <body> 含有实际内容（子元素、非空白文字，或被注入的
 * __htmledit__ 脚本——后者本身即代表 render 已把用户 HTML 写入并注入）。
 *
 * 说明：检测「用户是否已加载文件」本质属于编辑器状态，最可靠的来源是调用方
 * （任务 12.1）。因此 exportHtml 优先采用调用方提供的 hasContent 依赖；仅当未
 * 提供时才回退到本启发式 DOM 检查。本函数对缺失 DOM/异常输入安全返回 false。
 *
 * @param {Document|null|undefined} doc iframe.contentDocument
 * @returns {boolean} 是否已加载内容
 */
export function hasLoadedContent(doc) {
    if (!doc || !doc.documentElement) {
        return false;
    }
    const body = doc.body;
    if (!body) {
        // 没有 body 但 documentElement 存在时，看是否有除 head 外的实际内容。
        const html = doc.documentElement.innerHTML;
        return typeof html === 'string' && html.trim() !== '';
    }
    // 有任何元素子节点即视为有内容（含注入脚本节点）。
    if (body.children && body.children.length > 0) {
        return true;
    }
    // 无子元素时，看是否有非空白文本内容。
    const text = typeof body.textContent === 'string' ? body.textContent : '';
    return text.trim() !== '';
}

/**
 * 解析 exportHtml 的第二个参数，兼容两种调用形态（向后兼容 + 可测试）：
 *   - 传入字符串：作为下载文件名（旧签名 exportHtml(iframe, filename)）。
 *   - 传入对象：作为 options（见 exportHtml 文档）。
 *
 * @param {string|object|undefined} arg
 * @returns {object} 规范化后的 options 对象
 */
function normalizeExportOptions(arg) {
    if (typeof arg === 'string') {
        return {
            filename: arg
        };
    }
    if (arg && typeof arg === 'object') {
        return arg;
    }
    return {};
}

/**
 * 导出编排：校验内容 → 清理+序列化 → 触发 .html 下载 → 1 秒内重注入脚本（需求 10.1–10.7）。
 *
 * 签名（向后兼容）：
 *   exportHtml(iframe, filename?)            // 旧形态：第二参为字符串文件名
 *   exportHtml(iframe, options?)             // 新形态：第二参为 options 对象
 *
 * options:
 *   filename       string   下载文件名（自动补全 .html 扩展名）。
 *   hasContent     ()=>boolean   可选。判定 Preview_Frame 是否已加载内容（编辑器状态，
 *                  最可靠来源）。未提供时回退到对 contentDocument 的 hasLoadedContent 启发式。
 *   reinject       ()=>void  可选。重新注入编辑器脚本以恢复可继续编辑的回调（需求 10.7）。
 *                  应由调用方（任务 12.1）接到 preview-frame 的 render(...)。导出成功后
 *                  在 1 秒内（默认下一个 tick）被调用一次。
 *   reinjectDelayMs number  可选。重注入延迟毫秒数，默认 0；应保持 < 1000 以满足 10.7。
 *   onError        (msg)=>void  可选。无内容（10.6）或导出异常时下发状态栏错误提示。
 *   onStatus       (msg)=>void  可选。导出成功后下发状态栏提示（如「已导出」）。
 *   setTimeoutFn   fn       可选。计时器注入点，便于测试确定性控制；默认全局 setTimeout，
 *                  缺失时同步调用 reinject。
 *
 * 行为契约：
 *   - 无内容（10.6）：调用 onError(NO_CONTENT_MESSAGE)，不下载、不重注入，返回 null。
 *   - 成功：清理并下载干净 HTML（10.1–10.5），随后安排重注入（10.7），返回干净 HTML 文本。
 *   - 异常兜底：全流程以 try/catch 包裹；任一步骤抛错时调用 onError(EXPORT_ERROR_MESSAGE[: 详情])，
 *     不重注入（避免在异常状态下进一步破坏），返回 null，并保持编辑器尽量可用。
 *
 * 重注入与可继续编辑（10.7）：cleanAndSerialize 会就地修改活动文档（移除 __htmledit__
 * 脚本、清除编辑态样式），用户的全部内容编辑仍保留在该文档中。重注入（reinject 回调，
 * 通常接 preview-frame.render 当前 DOM/原始 HTML）会重新写入注入脚本，从而在保留全部修改
 * 的同时恢复可编辑状态。
 *
 * @param {HTMLIFrameElement} iframe 预览 iframe
 * @param {string|object} [filenameOrOptions] 文件名字符串或 options 对象
 * @returns {string|null} 导出的干净 HTML 文本；无内容或异常时返回 null
 */
export function exportHtml(iframe, filenameOrOptions) {
    const options = normalizeExportOptions(filenameOrOptions);
    const {
        filename,
        hasContent,
        reinject,
        reinjectDelayMs = DEFAULT_REINJECT_DELAY_MS,
        onError,
        onStatus,
        setTimeoutFn = (typeof setTimeout === 'function' ? setTimeout : null),
    } = options;

    const reportError = (message) => {
        if (typeof onError === 'function') {
            onError(message);
        }
    };

    const doc =
        iframe && (iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document));

    // EXTENSION POINT (8.2): 无内容导出处理（需求 10.6）。
    // 优先采用调用方提供的 hasContent（编辑器状态最可靠来源），否则回退到 DOM 启发式。
    const contentLoaded =
        typeof hasContent === 'function' ? !!hasContent() : hasLoadedContent(doc);
    if (!contentLoaded || !doc || !doc.documentElement) {
        reportError(NO_CONTENT_MESSAGE);
        return null;
    }

    // EXTENSION POINT (8.2): 整体 try/catch 兜底 + 状态栏「导出出错」提示。
    let cleanHtml;
    try {
        cleanHtml = cleanAndSerialize(doc);
        triggerDownload(cleanHtml, filename);
    } catch (err) {
        const detail = err && err.message ? '：' + err.message : '';
        reportError(EXPORT_ERROR_MESSAGE + detail);
        // 异常时不安排重注入，避免在不确定状态下进一步操作；保持编辑器尽量可用。
        return null;
    }

    if (typeof onStatus === 'function') {
        onStatus(EXPORT_DONE_MESSAGE);
    }

    // EXTENSION POINT (8.2): 导出后 1 秒内重注入脚本，保留全部修改、恢复可继续编辑（需求 10.7）。
    // cleanAndSerialize 已就地移除 __htmledit__ 脚本，故此处通过 reinject 回调恢复注入。
    if (typeof reinject === 'function') {
        scheduleReinject(reinject, reinjectDelayMs, setTimeoutFn, reportError);
    }

    return cleanHtml;
}

/**
 * 安排导出后的重注入（需求 10.7）。在 1 秒内调用 reinject 恢复可编辑状态。
 * 计时器函数可注入（便于测试）；无可用计时器时同步调用，确保重注入一定发生。
 * reinject 自身抛错时经 onError 提示，但不影响已完成的导出/下载。
 *
 * @param {()=>void} reinject 重注入回调
 * @param {number} delayMs 延迟毫秒数（应 < 1000）
 * @param {Function|null} setTimeoutFn 计时器函数
 * @param {(msg:string)=>void} reportError 错误上报
 */
function scheduleReinject(reinject, delayMs, setTimeoutFn, reportError) {
    const run = () => {
        try {
            reinject();
        } catch (err) {
            const detail = err && err.message ? '：' + err.message : '';
            reportError(EXPORT_ERROR_MESSAGE + detail);
        }
    };

    if (typeof setTimeoutFn === 'function') {
        setTimeoutFn(run, delayMs);
    } else {
        // 无可用计时器（异常环境）时同步重注入，保证页面恢复可编辑。
        run();
    }
}

// 向后兼容别名：骨架曾导出 buildCleanHtml（语义同 cleanAndSerialize）。
// 保留以避免潜在导入失效；新代码请使用 cleanAndSerialize。
export const buildCleanHtml = cleanAndSerialize;