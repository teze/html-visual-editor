// injected-script.js — 注入脚本交互逻辑（运行于 iframe 内部）
//
// 该模块的源码会在交付阶段（任务 12.1）被内联到 html-editor.html，并通过
// inject.js 的 .toString() 拼接为 <script id="__htmledit__"> 注入到用户 HTML 中，
// 在 sandbox iframe 内执行。因此本文件必须「自包含」：
//   - 不在运行期从其他 src/ 模块 import（注入后无模块系统可用）。
//   - 所有依赖（如颜色转换 rgbToHex）以本地副本内联在此处。
//
// 同时本文件以 ESM 形式导出各函数，便于在 jsdom 下对纯逻辑做属性/单元测试
// （任务 9.2 会 import getInfo / isEditable / isTextEditable 进行测试）。
//
// 本次（任务 9.1）实现：SKIP 集合、isEditable / isTextEditable、getInfo。
// 后续任务在文件末尾「事件处理」区追加：
//   - 9.3:  onMouseOver / onMouseOut / onClick（悬停高亮与单击选中）
//   - 9.7:  onDblClick / onInput / onBlur（双击内联编辑）
//   - 9.10: onMessage（update / delete 指令处理）
//
// 需求：3.4, 9.1, 9.2

// ----------------------------------------------------------------------------
// 常量
// ----------------------------------------------------------------------------

// 不可编辑（结构性 / 非可视）标签集合。
// 与需求 9 的术语表对齐：<html>/<head>/<style>/<script>/<meta>/<link>/<title>，
// 另加 <base>/<noscript> 等同样不可见的 head 级元素（设计文档的「等」）。
// 集合中标签一律以大写存储，比较时以 el.tagName（HTML 文档中本就为大写）匹配。
export const SKIP = new Set([
    'HTML',
    'HEAD',
    'META',
    'LINK',
    'TITLE',
    'STYLE',
    'SCRIPT',
    'BASE',
    'NOSCRIPT',
]);

// innerText 截断上限（字符数），避免超长文本撑爆消息通道与地址栏（设计 Data Models）。
const INNER_TEXT_CAP = 500;

// ----------------------------------------------------------------------------
// 颜色转换（本地副本，刻意与 src/color.js 重复）
//
// 注入脚本运行在 iframe 内、无模块系统，无法 import src/color.js，
// 故在此内联同一套 rgb()/rgba() → Hex 转换逻辑，保持与 color.js 完全一致的
// 转换行为以维持往返一致性（需求 6 / Property 1-3）。
// 维护提示：如修改 src/color.js 的 rgbToHex 行为，请同步更新此处副本。
// ----------------------------------------------------------------------------

// 匹配 rgb(...) / rgba(...)，容忍逗号/空白分隔。捕获组：1=r 2=g 3=b 4=alpha(可选)。
const RGB_PATTERN =
    /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*([0-9]*\.?[0-9]+)\s*)?\)$/i;

// 单个 0..255 通道整数 → 两位小写十六进制。
function channelToHex(n) {
    return n.toString(16).padStart(2, '0');
}

// 将 CSS rgb()/rgba() 字符串转换为 Hex_Color（与 src/color.js 行为一致）：
//   rgb(r,g,b)            → 6 位小写 #rrggbb
//   rgba(r,g,b,a) 且 a<1  → 8 位 #rrggbbaa（aa = Math.round(a*255) 两位十六进制）
//   rgba(r,g,b,a) 且 a>=1 → 6 位 #rrggbb
//   rgba(0,0,0,0)/"transparent" → 空串 ""（无背景色）
//   非法 / 通道越界 / alpha 越界 → null（可识别失败标记）
function rgbToHex(rgbString) {
    if (typeof rgbString !== 'string') {
        return null;
    }

    const input = rgbString.trim();

    if (input.toLowerCase() === 'transparent') {
        return '';
    }

    const match = input.match(RGB_PATTERN);
    if (!match) {
        return null;
    }

    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);

    if (r > 255 || g > 255 || b > 255) {
        return null;
    }

    const hasAlpha = match[4] !== undefined;
    const alpha = hasAlpha ? Number(match[4]) : 1;

    if (alpha < 0 || alpha > 1) {
        return null;
    }

    if (hasAlpha && alpha === 0 && r === 0 && g === 0 && b === 0) {
        return '';
    }

    const base = '#' + channelToHex(r) + channelToHex(g) + channelToHex(b);

    if (hasAlpha && alpha < 1) {
        const alphaByte = Math.round(alpha * 255);
        return base + channelToHex(alphaByte);
    }

    return base;
}

// 颜色读取的统一出口：把 rgbToHex 的 null（解析失败）归一为空串，
// 使 getInfo 的 color/backgroundColor 恒为「合法 Hex 或空串」（Property 8）。
function colorToHexOrEmpty(rgbString) {
    const hex = rgbToHex(rgbString);
    return hex == null ? '' : hex;
}

// ----------------------------------------------------------------------------
// DOM 工具
// ----------------------------------------------------------------------------

// 取得元素所属文档的视图并返回其 computed style；在 iframe 与 jsdom 下均可用。
// 无可用视图时返回 null，调用方需对各字段做空值兜底。
function computedStyleOf(el) {
    const view =
        (el && el.ownerDocument && el.ownerDocument.defaultView) ||
        (typeof window !== 'undefined' ? window : null);
    if (view && typeof view.getComputedStyle === 'function') {
        return view.getComputedStyle(el);
    }
    return null;
}

// 元素是否「直接」包含非空白文本（仅看直接子文本节点，不递归后代）。
function hasDirectText(el) {
    const children = el.childNodes || [];
    for (let i = 0; i < children.length; i++) {
        const node = children[i];
        // 3 === Node.TEXT_NODE
        if (node.nodeType === 3 && node.textContent && node.textContent.trim() !== '') {
            return true;
        }
    }
    return false;
}

// 生成用于地址栏展示的 CSS 选择器路径，例如 "body > div:nth-of-type(1) > p:nth-of-type(2)"。
// 规则：自底向上拼接；遇到带 id 的祖先则以 #id 截断（id 唯一，可省略上游）；
// 否则以同标签的 :nth-of-type 定位；到 <html> 为止（不含 html）。
function cssPath(el) {
    if (!el || el.nodeType !== 1) {
        return '';
    }
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node.tagName && node.tagName.toUpperCase() !== 'HTML') {
        const tagName = node.tagName.toLowerCase();
        if (node.id) {
            parts.unshift(tagName + '#' + node.id);
            break; // id 唯一，无需继续向上
        }
        let index = 1;
        let sibling = node.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === node.tagName) {
                index++;
            }
            sibling = sibling.previousElementSibling;
        }
        parts.unshift(tagName + ':nth-of-type(' + index + ')');
        node = node.parentElement;
    }
    return parts.join(' > ');
}

// ----------------------------------------------------------------------------
// 可编辑判定（需求 9.1 / 9.2 / 4.5）
// ----------------------------------------------------------------------------

// 是否为可编辑元素：是 Element 且其标签不在 SKIP 集合中。
export function isEditable(el) {
    if (!el || el.nodeType !== 1 || !el.tagName) {
        return false;
    }
    return !SKIP.has(el.tagName.toUpperCase());
}

// 是否为「文字类」可编辑元素：可编辑、非 <img>、且直接包含文本内容。
// 用于双击内联编辑（需求 4.5）：img 与不直接含文本的结构性容器不响应。
export function isTextEditable(el) {
    if (!isEditable(el)) {
        return false;
    }
    if (el.tagName.toUpperCase() === 'IMG') {
        return false;
    }
    return hasDirectText(el);
}

// ----------------------------------------------------------------------------
// 选中信息读取（需求 3.4，Property 8）
// ----------------------------------------------------------------------------

// 返回完整的 SelectedElementInfo：
//   tag, innerText, color, backgroundColor, fontSize, fontWeight,
//   width, height, src, href, inlineStyle, path
// 约定：color/backgroundColor 为合法 Hex 或空串；fontSize 为 px 整数。
export function getInfo(el) {
    if (!el || el.nodeType !== 1) {
        // 防御性返回：保证字段齐全且类型符合契约（Property 8）。
        return {
            tag: '',
            innerText: '',
            color: '',
            backgroundColor: '',
            fontSize: 0,
            fontWeight: '',
            width: '',
            height: '',
            src: '',
            href: '',
            inlineStyle: '',
            path: '',
        };
    }

    const tag = el.tagName.toUpperCase();
    const computed = computedStyleOf(el);

    // innerText 在真实 iframe 可用；jsdom 不实现 innerText，退回 textContent。
    const rawText = (el.innerText != null ? el.innerText : el.textContent) || '';
    const innerText = rawText.slice(0, INNER_TEXT_CAP);

    // fontSize：自 computed 取整；无法解析时取 0，保证恒为整数。
    let fontSize = 0;
    if (computed) {
        const parsed = parseFloat(computed.fontSize);
        fontSize = Number.isFinite(parsed) ? Math.round(parsed) : 0;
    }

    return {
        tag,
        innerText,
        color: computed ? colorToHexOrEmpty(computed.color) : '',
        backgroundColor: computed ? colorToHexOrEmpty(computed.backgroundColor) : '',
        fontSize,
        fontWeight: computed ? String(computed.fontWeight || '') : '',
        // 宽高取内联 style（可能为空串）。
        width: el.style ? el.style.width || '' : '',
        height: el.style ? el.style.height || '' : '',
        // src 仅 <img>，href 仅 <a>，取属性原文；其余为空串。
        src: tag === 'IMG' ? el.getAttribute('src') || '' : '',
        href: tag === 'A' ? el.getAttribute('href') || '' : '',
        // 元素 style 属性原文。
        inlineStyle: el.getAttribute('style') || '',
        // 供地址栏展示的 CSS 选择器路径。
        path: cssPath(el),
    };
}

// ----------------------------------------------------------------------------
// 事件处理（后续任务在此区追加，勿在 9.1 实现）
//   - 9.3:  onMouseOver / onMouseOut / onClick
//   - 9.7:  onDblClick / onInput / onBlur
//   - 9.10: onMessage（update / delete）
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// 9.3 悬停高亮与单击选中（onMouseOver / onMouseOut / onClick）
//   需求：3.1, 3.2, 3.3, 3.6, 9.1, 9.2, 9.3, 9.4
//   覆盖 Property 10（悬停高亮进出还原）/ 11（单击选中唯一性）/ 12（不可交互稳定性）
// ----------------------------------------------------------------------------

// 编辑态 outline 取值（与原型 html-editor.html 保持一致）。
// 悬停：半透明 rgba(0,212,170,0.35)；选中：实线 #00d4aa。
export const HOVER_OUTLINE = '2px solid rgba(0,212,170,0.35)';
export const SELECT_OUTLINE = '2px solid #00d4aa';

// data-saved-outline 标记属性名。
// 必须与 src/exporter.js 的 SAVED_OUTLINE_ATTR ('data-saved-outline') 完全一致：
// 导出清理时，exporter 会遍历 [data-saved-outline] 节点，把 outline 还原为此处保存的
// 原始值、移除编辑器添加的 outline-offset/cursor，并删除该标记属性。
const SAVED_OUTLINE_ATTR = 'data-saved-outline';

// ----------------------------------------------------------------------------
// 模块级交互状态
// ----------------------------------------------------------------------------

// 当前选中元素（带 #00d4aa 选中边框）；无选中时为 null。
let selectedEl = null;
// 当前悬停元素（带半透明悬停边框）；无悬停时为 null。
let hoveredEl = null;

// 可注入的 postMessage 目标（便于 jsdom 测试捕获上行消息）。
// 未注入时回退到 parent / window（均带 typeof 守卫，避免测试环境崩溃）。
let _postTarget = null;

// 注入/替换 postMessage 目标；传入 null 可恢复默认（parent/window）回退行为。
export function setPostTarget(target) {
    _postTarget = target;
}

// 重置交互状态（仅供测试隔离使用）：清空选中/悬停/编辑引用，不触碰任何 DOM。
export function resetState() {
    selectedEl = null;
    hoveredEl = null;
    editingEl = null;
}

// 选中/悬停状态读取器，供 jsdom 测试断言（任务 9.5 / 9.6）。
export function getSelectedEl() {
    return selectedEl;
}

export function getHoveredEl() {
    return hoveredEl;
}

// 上行消息发送：注入脚本仅通过 postMessage 与 Editor 通信（需求 2.4 / 9.4）。
// 优先使用注入目标，其次 parent，最后 window；任一不可用时安全 no-op。
function post(msg) {
    if (_postTarget && typeof _postTarget.postMessage === 'function') {
        _postTarget.postMessage(msg, '*');
        return;
    }
    if (typeof parent !== 'undefined' && parent && typeof parent.postMessage === 'function') {
        parent.postMessage(msg, '*');
        return;
    }
    if (typeof window !== 'undefined' && window && typeof window.postMessage === 'function') {
        window.postMessage(msg, '*');
    }
}

// ----------------------------------------------------------------------------
// outline 编辑态读写（维护 data-saved-outline 契约）
// ----------------------------------------------------------------------------

// 施加编辑态 outline（悬停或选中）。
// 契约：首次施加编辑态 outline 时，先把元素「原始内联 outline 值」存入
// data-saved-outline（原本无内联 outline 则存空串 ""），随后再写编辑态样式。
// 若元素已带 data-saved-outline 标记（说明已有编辑态 outline，如悬停→选中），
// 则不再覆盖已保存的原始值，仅更新可见 outline——避免把悬停 outline 误存为「原始」，
// 保证 exporter 始终能还原到真正的原始 outline。
export function applyOutline(el, value) {
    if (!el || !el.style) {
        return;
    }
    if (typeof el.hasAttribute === 'function' && !el.hasAttribute(SAVED_OUTLINE_ATTR)) {
        el.setAttribute(SAVED_OUTLINE_ATTR, el.style.outline || '');
    }
    el.style.outline = value;
    el.style.outlineOffset = '1px';
    el.style.cursor = 'pointer';
}

// 移除编辑态 outline，还原到 data-saved-outline 保存的原始值。
// 还原 outline（保存值为空串/缺失则清除内联 outline）、移除编辑器添加的
// outline-offset 与 cursor，并删除 data-saved-outline 标记属性。
export function restoreOutline(el) {
    if (!el || !el.style) {
        return;
    }
    const saved =
        typeof el.getAttribute === 'function' ? el.getAttribute(SAVED_OUTLINE_ATTR) : null;
    // 保存值非空 → 写回原始 outline；空串/缺失 → 清除内联 outline。
    el.style.outline = saved || '';
    el.style.outlineOffset = '';
    el.style.cursor = '';
    if (typeof el.removeAttribute === 'function') {
        el.removeAttribute(SAVED_OUTLINE_ATTR);
    }
}

// ----------------------------------------------------------------------------
// 事件处理器
// ----------------------------------------------------------------------------

// 悬停进入：非 SKIP 且非当前选中元素时显示半透明悬停边框（需求 3.1 / 9.1）。
// 当 target 为当前选中元素时直接返回，避免覆盖其 #00d4aa 选中边框与 saved-outline。
export function onMouseOver(e) {
    const el = e && e.target;
    if (!isEditable(el)) {
        return; // SKIP / 非元素：不显示悬停高亮（需求 9.1）
    }
    if (el === selectedEl) {
        return; // 不触碰选中元素，保留其 #00d4aa 边框
    }
    // 切换悬停目标前，先还原上一个悬停元素（除非它是选中元素）。
    if (hoveredEl && hoveredEl !== selectedEl) {
        restoreOutline(hoveredEl);
    }
    hoveredEl = el;
    applyOutline(hoveredEl, HOVER_OUTLINE);
}

// 悬停移出：移除悬停边框；若该悬停元素同时是选中元素则保留 #00d4aa（需求 3.2 / 9.1）。
export function onMouseOut(e) {
    if (hoveredEl && hoveredEl !== selectedEl) {
        restoreOutline(hoveredEl);
        hoveredEl = null;
    }
}

// 单击选中：单击可编辑元素则选中并发送 selected 消息（需求 3.3 / 3.4 / 3.6）。
// 单击 SKIP/空白（非可编辑）则不改变状态、不发送任何消息（需求 9.2 / 9.3 / 9.4）。
export function onClick(e) {
    const el = e && e.target;
    if (!isEditable(el)) {
        return; // SKIP / 空白：保持选中与面板不变，且不发送任何消息（需求 9.x）
    }

    if (typeof e.preventDefault === 'function') {
        e.preventDefault();
    }
    if (typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }

    // 移除旧选中元素的选中边框（需求 3.6）。重复单击同一元素时跳过，避免误删其 saved-outline。
    if (selectedEl && selectedEl !== el) {
        restoreOutline(selectedEl);
        // 退出旧选中元素可能残留的内联编辑态（完整编辑生命周期见任务 9.7）。
        if (selectedEl.contentEditable === 'true') {
            selectedEl.contentEditable = 'false';
        }
    }

    // 选中新元素并施加 #00d4aa 边框。
    // 若该元素此前处于悬停态（已带 saved-outline 标记），applyOutline 会保留其原始值，
    // 仅把可见 outline 切换为选中色。
    selectedEl = el;
    applyOutline(selectedEl, SELECT_OUTLINE);

    // 上行发送选中信息（携带 getInfo），供 Editor 回填属性面板（需求 3.4）。
    post({
        type: 'selected',
        info: getInfo(selectedEl)
    });
}

// ----------------------------------------------------------------------------
// 9.7 双击内联编辑（onDblClick / onInput / onBlur）
//   需求：4.1, 4.2, 4.3, 4.5, 4.6
//   覆盖 Property 13（内联编辑文字同步保真）/ 14（双击编辑态进出往返）
// ----------------------------------------------------------------------------

// 当前处于 contentEditable 内联编辑态的元素；无编辑时为 null。
// 供 onInput / onBlur 在拿不到事件 target 时回退定位编辑目标，并供测试断言。
let editingEl = null;

// 编辑目标读取器，供 jsdom 测试断言（任务 9.8 / 9.9）。
export function getEditingEl() {
    return editingEl;
}

// 读取元素「当前完整文字」：真实 iframe 用 innerText，jsdom 不实现 innerText 时退回
// textContent。与 getInfo 的取文逻辑保持一致，确保同步给 Editor 的文字为元素真实文本。
function readFullText(el) {
    if (!el) {
        return '';
    }
    const text = el.innerText != null ? el.innerText : el.textContent;
    return text || '';
}

// 双击进入内联编辑（需求 4.1 / 4.5）。
// 仅文字类可编辑元素（isTextEditable：可编辑、非 <img>、且直接含文本）响应：
// 设 contentEditable='true' 并 focus() 获得输入焦点；img 与结构性/非文字元素不响应
// （不设置 contentEditable，保持非编辑态）。
export function onDblClick(e) {
    const el = e && e.target;
    if (!isTextEditable(el)) {
        return; // img / 结构性 / 不直接含文本：不响应双击（需求 4.5）
    }
    editingEl = el;
    el.contentEditable = 'true';
    if (typeof el.focus === 'function') {
        el.focus();
    }
    // 进入编辑会话：通知 Editor 以便其管理本次会话的修改计数去重（需求 4.4）。
    post({
        type: 'editing'
    });
}

// contentEditable 元素文字变更（需求 4.2 / 4.3）。
// 浏览器原生即时反映输入文字（需求 4.2）；此处在 input 时（latency bound 200ms 内，
// 同步发送即满足）通过 postMessage 把元素「当前完整文字」同步给 Editor。
// 读取顺序：优先事件 target，其次回退到 editingEl。
export function onInput(e) {
    const el = (e && e.target) || editingEl;
    if (!el) {
        return; // 无可定位的编辑目标：安全 no-op
    }
    post({
        type: 'textInput',
        text: readFullText(el)
    });
}

// 失去焦点退出内联编辑（需求 4.6）：恢复 contentEditable='false'。
// 读取顺序：优先事件 target，其次回退到 editingEl；并清空编辑目标引用。
export function onBlur(e) {
    const el = (e && e.target) || editingEl;
    if (el && el.contentEditable === 'true') {
        el.contentEditable = 'false';
    }
    // 退出的若是当前编辑目标（含 target 缺失时回退到 editingEl 的情形），清空编辑引用。
    if (el === editingEl) {
        editingEl = null;
    }
}

// ----------------------------------------------------------------------------
// 事件处理（后续任务在此区追加，勿在 9.7 实现）
//   - 9.10: onMessage（update / delete 指令处理）
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// 9.10 message 更新与删除处理（onMessage）
//   需求：5.1, 8.1, 8.4
//   覆盖 Property 18（删除移除子树并清除选中），并支撑 Property 15（合法数值
//   样式输入被应用）/ Property 17（src/href 应用保真）的 iframe 侧落地。
// ----------------------------------------------------------------------------
//
// 下行消息契约（DownMessage，Editor → Injected_Script）：
//   { type:'update', prop, val }
//     - type 必须为 'update'，否则静默忽略（防御来自其他来源的消息，设计 Error Handling）。
//     - prop ∈ { 'text' | 'src' | 'href' | 'delete' | 任意 CSS 样式属性(camelCase) }
//     - val 为 string | boolean。
//
// 作用目标：恒为「当前选中元素」selectedEl（由 onClick 选中；测试可用 setSelectedEl 注入）。
// 设计数据流为 editor → iframe 的 update 指令施加于 Selected_Element。
//
// 上行回发约定（决定 Editor 侧的 Change_Count 递增，见设计交互流程与 Property 19）：
//   - 'text' / 'src' / 'href' / 任意样式属性  成功更新后 → 回发 { type:'changed' }
//   - 'delete'                                成功删除后 → 回发 { type:'deleted' }
//     （删除仅回发 'deleted'、不回发 'changed'；Editor 将 deleted 映射为 +1 计数，
//       避免一次删除被重复计数。）
//
// 防御与边界：
//   - 无 selectedEl 时，update / delete 均为 no-op 且不回发任何消息（无目标可施加）。
//   - prop 缺失/非字符串时（delete 之外）为 no-op、不回发，避免误写。
//   - val 缺失（null/undefined）时按空串处理，避免写入 "undefined"。

// 设置当前选中元素（仅供测试注入选中目标，等价于 onClick 选中后的状态）。
// 不施加任何 outline、不发送消息，仅切换模块级 selectedEl 引用。
export function setSelectedEl(el) {
    selectedEl = el;
}

// 接收并处理来自 Editor 的下行 update / delete 指令。
// 严格校验 e.data.type === 'update' 后再处理，未知类型静默忽略（设计 Error Handling：
// postMessage 消息校验）。所有修改均作用于当前 selectedEl。
export function onMessage(e) {
    const data = e && e.data;
    // 校验消息结构与类型：仅处理 { type:'update', ... }，其余一律静默忽略。
    if (!data || data.type !== 'update') {
        return;
    }

    // 无选中元素：update / delete 均无目标可施加，no-op 且不回发任何消息（需求 8.4 的延伸）。
    if (!selectedEl) {
        return;
    }

    const prop = data.prop;
    // val 兜底：缺失按空串处理，避免把 undefined/null 字面写入样式/属性/文字。
    const val = data.val == null ? '' : data.val;

    // 删除：移除选中元素及其全部后代子树（需求 8.1），随后清除选中状态（需求 8.4），
    // 使后续 update 不再作用于已删除节点；回发 { type:'deleted' }。
    if (prop === 'delete') {
        const target = selectedEl;
        // 优先经父节点 removeChild 移除整棵子树；缺失父节点时回退到 element.remove()。
        if (target.parentNode && typeof target.parentNode.removeChild === 'function') {
            target.parentNode.removeChild(target);
        } else if (typeof target.remove === 'function') {
            target.remove();
        }
        // 清除选中/悬停/编辑引用中指向已删除节点的部分，确保不存在 Selected_Element。
        selectedEl = null;
        if (hoveredEl === target) {
            hoveredEl = null;
        }
        if (editingEl === target) {
            editingEl = null;
        }
        post({
            type: 'deleted'
        });
        return;
    }

    // 非删除指令要求 prop 为非空字符串，否则无从定位修改目标：no-op、不回发。
    if (typeof prop !== 'string' || prop === '') {
        return;
    }

    if (prop === 'text') {
        // 文字内容更新（需求 5.1）：用 textContent 写入，反映面板文字编辑。
        selectedEl.textContent = String(val);
    } else if (prop === 'src') {
        // 图片地址更新（需求 7.2）：写入 <img> 的 src 属性。
        if (typeof selectedEl.setAttribute === 'function') {
            selectedEl.setAttribute('src', String(val));
        }
    } else if (prop === 'href') {
        // 链接地址更新（需求 7.5）：写入 <a> 的 href 属性。
        if (typeof selectedEl.setAttribute === 'function') {
            selectedEl.setAttribute('href', String(val));
        }
    } else {
        // 其余 prop 视为 CSS 样式属性（camelCase，如 fontSize/backgroundColor/borderRadius/
        // textAlign/padding/width/height/color），直接写入内联 style（需求 5.x、Property 15）。
        if (selectedEl.style) {
            selectedEl.style[prop] = val;
        }
    }

    // 一次成功的样式/文字/属性更新：回发 changed，供 Editor 递增 Change_Count。
    post({
        type: 'changed'
    });
}