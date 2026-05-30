// preview-frame.js — 预览框架渲染接线（任务 11.2，需求 2.1 / 2.5）
//
// 职责：把用户 HTML 拼接注入脚本后写入 <iframe srcdoc>，固定 sandbox，
// 并在 iframe load 后等待注入脚本回发 `ready` 消息（2 秒内）。
//
// 设计取舍（保持可测试 + 解耦）：
//   - 注入脚本的「编辑器函数体」由 src/injected-script.js 提供，但其形态
//     （ESM 命名导出 vs 单一可注入函数）是任务 12.1 的组装关注点。本模块
//     不直接依赖 injected-script.js，而是通过 `editorScriptProvider`
//     （一个零参工厂，返回编辑器函数或其源码字符串）注入，未配置时回退到
//     inject.js 内置占位函数。这样 preview-frame 可独立于其它 src/ 模块测试。
//   - 注入脚本的「拼接」复用 inject.js 的 buildEditorScript + injectInto，
//     幂等保证 id="__htmledit__" 的 <script> 恰好一个（Property 7）。
//   - 上行 `ready` 消息的「接收」属于 MessageBus（任务 11.3）。本模块只负责
//     在 load 后启动 2 秒计时器，并暴露 notifyReady() 供 MessageBus 在收到
//     ready 消息时回调，从而解析就绪 / 取消超时。职责边界清晰。
//
// 导出 API：
//   - SANDBOX：固定的 sandbox 属性值常量。
//   - RENDER_FAILED_MESSAGE / READY_TIMEOUT_MESSAGE：错误提示文案。
//   - DEFAULT_READY_TIMEOUT_MS：默认 ready 等待时长（2000ms）。
//   - isRenderable(rawHtml)：纯函数，判定 HTML 是否可渲染。
//   - buildSrcdoc(rawHtml, editorScriptProvider)：纯函数，返回注入后的 srcdoc 文本。
//   - createPreviewFrame(options)：有状态控制器（render / notifyReady / isReady / dispose）。

import {
    buildEditorScript,
    injectInto,
} from './inject.js';

// iframe 固定 sandbox（需求 2.2）：允许内部脚本执行并以 same-origin 读取
// contentDocument（导出序列化所需）。render 每次都会确保该值。
export const SANDBOX = 'allow-scripts allow-same-origin';

// 渲染失败提示（需求 2.5）：内容为空或无法解析为有效 HTML 文档时显示。
export const RENDER_FAILED_MESSAGE = '渲染失败：内容为空或无法解析为有效的 HTML 文档';

// 就绪超时提示（需求 2.3）：iframe load 后 2 秒内未收到注入脚本 ready 消息。
export const READY_TIMEOUT_MESSAGE = '渲染失败：注入脚本未在 2 秒内就绪';

// 默认等待 ready 的时长（毫秒）。
export const DEFAULT_READY_TIMEOUT_MS = 2000;

// ----------------------------------------------------------------------------
// isRenderable — HTML 可渲染性判定（需求 2.5）
//
// 启发式（纯函数、无需 DOM，便于属性/单元测试）：
//   1. 必须是字符串。
//   2. 去除首尾空白后非空（排除空内容与纯空白）。
//   3. 至少包含一个「标签样式」构造 `<...>`（排除纯文本 / 明显不是 HTML 文档的内容）。
//
// 说明：DOMParser 在 'text/html' 模式下极其宽容（几乎不会因语法错误抛出，
// 总会产出一个含 <html><head><body> 的文档），不能作为「有效文档」的强校验，
// 故采用上述可移植的轻量启发式。组装阶段（12.1）若需更严格校验，可在浏览器内
// 叠加基于 contentDocument 的检查，不影响本纯函数契约。
// ----------------------------------------------------------------------------
export function isRenderable(rawHtml) {
    if (typeof rawHtml !== 'string') {
        return false;
    }
    const trimmed = rawHtml.trim();
    if (trimmed === '') {
        return false;
    }
    // 至少出现一个标签：<tag ...> / </tag> / <!doctype ...> / 注释等。
    return /<[a-zA-Z!/][^>]*>/.test(trimmed);
}

// ----------------------------------------------------------------------------
// resolveEditorFn — 解析 editorScriptProvider 为「编辑器函数或源码字符串」
//
// 约定（消除歧义）：editorScriptProvider 是一个「零参工厂」。
//   - 为函数时：调用之，取其返回值（编辑器函数或源码字符串）。
//     ⇒ 若要直接传入编辑器函数本身，请包一层：() => editorFn。
//   - 为字符串时：当作编辑器源码直接使用。
//   - 为 null/undefined：返回 undefined，buildEditorScript 将使用内置占位函数。
// ----------------------------------------------------------------------------
function resolveEditorFn(editorScriptProvider) {
    if (editorScriptProvider == null) {
        return undefined;
    }
    if (typeof editorScriptProvider === 'function') {
        return editorScriptProvider();
    }
    return editorScriptProvider;
}

// ----------------------------------------------------------------------------
// buildSrcdoc — 纯函数：返回注入脚本后的 srcdoc 文本（不触碰 DOM）
//
// 复用 inject.js：buildEditorScript(editorFn) 生成 <script id="__htmledit__"> 文本，
// injectInto(rawHtml, scriptString) 优先在 </body> 前插入、无则追加末尾，且幂等。
// ----------------------------------------------------------------------------
export function buildSrcdoc(rawHtml, editorScriptProvider) {
    const html = typeof rawHtml === 'string' ? rawHtml : '';
    const editorFn = resolveEditorFn(editorScriptProvider);
    const scriptString = buildEditorScript(editorFn);
    return injectInto(html, scriptString);
}

// ----------------------------------------------------------------------------
// createPreviewFrame — 有状态预览控制器
//
// options:
//   iframe                必填，目标 <iframe> 元素。
//   editorScriptProvider  可选，零参工厂（见 resolveEditorFn）；缺省用占位脚本。
//   onReady()             可选，在超时前收到 ready 时回调（进入可编辑态）。
//   onError(message)      可选，渲染失败或 ready 超时时回调（显示错误提示）。
//   onReadyTimeout(msg)   可选，ready 超时专用回调；未提供时回退到 onError。
//   readyTimeoutMs        可选，等待 ready 的毫秒数，默认 2000。
//   setTimeoutFn/clearTimeoutFn  可选，计时器注入点，便于测试确定性控制。
//
// 返回控制器：
//   render(rawHtml, overrideProvider?) -> boolean
//       不可渲染时调用 onError(RENDER_FAILED_MESSAGE) 并返回 false（不写入注入
//       srcdoc、不进入编辑态）；可渲染时确保 sandbox、写入注入 srcdoc，并在
//       load 后启动 ready 计时器，返回 true。
//   notifyReady()  供 MessageBus 在收到 ready 消息时调用，解析就绪、取消超时。
//   isReady()      当前是否已就绪。
//   dispose()      清理计时器与 load 监听，释放资源。
// ----------------------------------------------------------------------------
export function createPreviewFrame(options = {}) {
    const {
        iframe,
        editorScriptProvider,
        onReady,
        onError,
        onReadyTimeout,
        readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
        setTimeoutFn = (typeof setTimeout === 'function' ? setTimeout : null),
        clearTimeoutFn = (typeof clearTimeout === 'function' ? clearTimeout : null),
    } = options;

    if (!iframe) {
        throw new Error('createPreviewFrame: 需要提供 iframe 元素');
    }

    let readyTimer = null; // 当前 ready 等待计时器句柄
    let loadHandler = null; // 当前绑定的 load 监听器
    let ready = false; // 是否已收到 ready
    let awaitingReady = false; // 是否处于「已渲染、等待 ready」区间

    function clearReadyTimer() {
        if (readyTimer != null && typeof clearTimeoutFn === 'function') {
            clearTimeoutFn(readyTimer);
        }
        readyTimer = null;
    }

    function cleanupLoad() {
        if (loadHandler && typeof iframe.removeEventListener === 'function') {
            iframe.removeEventListener('load', loadHandler);
        }
        loadHandler = null;
    }

    function setSandbox() {
        // setAttribute 在浏览器与 jsdom 下均可靠；同时尝试属性赋值以兼容反射读取。
        if (typeof iframe.setAttribute === 'function') {
            iframe.setAttribute('sandbox', SANDBOX);
        }
        try {
            iframe.sandbox = SANDBOX;
        } catch (_) {
            // 某些环境下 sandbox 为只读 DOMTokenList，忽略——setAttribute 已生效。
        }
    }

    function startReadyTimer() {
        clearReadyTimer();
        if (typeof setTimeoutFn !== 'function') {
            return;
        }
        readyTimer = setTimeoutFn(() => {
            readyTimer = null;
            if (ready || !awaitingReady) {
                return;
            }
            awaitingReady = false;
            if (typeof onReadyTimeout === 'function') {
                onReadyTimeout(READY_TIMEOUT_MESSAGE);
            } else if (typeof onError === 'function') {
                onError(READY_TIMEOUT_MESSAGE);
            }
        }, readyTimeoutMs);
    }

    function attachLoadListener() {
        cleanupLoad();
        loadHandler = function onLoad() {
            // load 后才开始等待 ready（需求：load 后 2 秒内）。
            startReadyTimer();
        };
        if (typeof iframe.addEventListener === 'function') {
            iframe.addEventListener('load', loadHandler);
        }
    }

    function render(rawHtml, overrideProvider) {
        // 重置上一轮生命周期，避免多次 render 之间状态/计时器互相干扰。
        clearReadyTimer();
        cleanupLoad();
        ready = false;
        awaitingReady = false;

        // 需求 2.5：空内容或无法解析为有效文档 → 提示渲染失败，不注入、不进入编辑态。
        if (!isRenderable(rawHtml)) {
            if (typeof onError === 'function') {
                onError(RENDER_FAILED_MESSAGE);
            }
            return false;
        }

        // 需求 2.2：固定 sandbox。
        setSandbox();

        const provider = overrideProvider !== undefined ? overrideProvider : editorScriptProvider;
        const srcdoc = buildSrcdoc(rawHtml, provider);

        // 先挂载 load 监听，再写入 srcdoc，确保不漏掉 load 事件。
        awaitingReady = true;
        attachLoadListener();
        iframe.srcdoc = srcdoc;
        return true;
    }

    function notifyReady() {
        // 仅在「已渲染、等待 ready」区间内生效；幂等。
        if (ready || !awaitingReady) {
            return;
        }
        ready = true;
        awaitingReady = false;
        clearReadyTimer();
        if (typeof onReady === 'function') {
            onReady();
        }
    }

    function isReady() {
        return ready;
    }

    function dispose() {
        clearReadyTimer();
        cleanupLoad();
        ready = false;
        awaitingReady = false;
    }

    return {
        render,
        notifyReady,
        isReady,
        dispose,
    };
}