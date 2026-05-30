// property-panel.js — 属性面板（Property_Panel）
//
// 职责（参见 design.md「4. Property_Panel」与需求 3/5/6/7/8）：
//   - fillForm(info)：按字段把 SelectedElementInfo 回填到面板各控件（本任务 10.1）
//   - clearForm()：元素删除后清空面板，恢复空态（本任务 10.1）
//   - 控件可见性：<img> 显示并预填 src、隐藏文字区；<a> 显示并预填 href；
//     其他文字元素显示文字内容区（本任务 10.1，需求 7.1/7.4/8.2）
//   - onColorPick / onColorType：颜色控件双向联动（后续任务 10.3 追加）
//   - applyText / applyFontSize / ... / applySrc / applyHref：各属性 apply 入口、
//     输入校验与错误提示（后续任务 10.5 追加）
//
// 设计为可在 jsdom 下独立测试：本模块不直接耦合全局 document，所有 DOM 操作通过
// 一个「面板根节点（panel root）」定位控件。调用方可：
//   1) 直接传入根节点：fillForm(info, rootElement)
//   2) 预先缓存根节点：setupPanel(rootElement) 后续调用可省略 root 参数
//   3) 不传时回退到全局 document（运行于真实页面时的默认行为）
//
// 测试可使用 createPanelFragment(document) 构造一个包含全部约定控件 id 的 DOM 片段，
// 传入 fillForm/clearForm 进行断言（见 Property 9：属性面板回填一致性）。

// 颜色规范化复用 color.js（属性面板运行于父文档，可正常导入）：先 hexToRgb 解析并
// 把 3 位扩展为 6 位，再 rgbToHex 规范化为 6 位小写 #rrggbb，保证双向联动往返稳定。
import {
    hexToRgb,
    rgbToHex
} from './color.js';

// 输入校验（任务 10.5）：合法输入返回 { ok:true, value }（value 为含单位/规范化后的
// CSS 值），非法输入返回 { ok:false }。apply* 入口据此决定「发送 update / 拒绝并提示」。
import {
    validateFontSize,
    validateFontWeight,
    validateColor,
    validateTextAlign,
    validatePadding,
    validateBorderRadius,
    validateWidth,
    validateHeight,
    validateAddress,
    MAX_ADDRESS_LENGTH,
} from './input-validation.js';

// ---------------------------------------------------------------------------
// 控件 ID 契约（Control ID Contract）
//
// 下列 id 为属性面板各控件的约定标识。任务 12.1 在 html-editor.html 中内联面板
// 标记时必须使用这些 id，使本模块可在真实页面与 jsdom 测试中以相同方式定位控件。
// ---------------------------------------------------------------------------
export const PANEL_CONTROL_IDS = Object.freeze({
    // 容器与空态
    panelEmpty: 'panelEmpty', // 空态占位（未选中元素时显示）
    editForm: 'editForm', // 表单容器（选中元素时显示）
    elBadge: 'elBadge', // 标签徽章，显示形如 "<div>"

    // 文字内容
    grpText: 'grpText', // 文字内容分组容器（<img> 时隐藏）
    pText: 'pText', // 文字内容输入框（textarea）

    // 字体
    pFontSize: 'pFontSize', // 字体大小（number）
    pFontWeight: 'pFontWeight', // 字体粗细（select）

    // 颜色
    pColor: 'pColor', // 文字颜色选择器（input[type=color]）
    pColorTxt: 'pColorTxt', // 文字颜色 Hex 输入框（text）
    pBg: 'pBg', // 背景颜色选择器（input[type=color]）
    pBgTxt: 'pBgTxt', // 背景颜色 Hex 输入框（text）

    // 盒模型 / 尺寸
    pPad: 'pPad', // 内边距（number）
    pRadius: 'pRadius', // 圆角（number）
    pWidth: 'pWidth', // 宽度（text，px/%）
    pHeight: 'pHeight', // 高度（text）

    // 图片专属
    grpImg: 'grpImg', // 图片地址分组容器（仅 <img> 显示）
    pSrc: 'pSrc', // 图片 src 输入框（text）

    // 链接专属
    grpLink: 'grpLink', // 链接地址分组容器（仅 <a> 显示）
    pHref: 'pHref', // 链接 href 输入框（text）

    // 删除控件 / 共享提示区（任务 10.5，需求 8.1 / 8.5）
    pDelete: 'pDelete', // 删除元素按钮（button）
    panelNotice: 'panelNotice', // 面板级共享提示区（如「无可删除元素」）
});

// 错误提示元素 id 约定（Error-Display Convention，任务 10.5）：
//
// 每个可校验的输入控件配一个「字段级错误提示元素」，其 id 固定为「控件 id + 'Err'」
// （如 pFontSize → pFontSizeErr，pColorTxt → pColorTxtErr，pSrc → pSrcErr）。
// showFieldError(field, message) 把 message 写入对应错误元素的 textContent 并显示；
// 合法输入时由 apply* 调用 clearFieldError(field) 清空该提示。
//
// 这样错误提示就近显示在对应控件旁，jsdom 测试（任务 10.6）可断言
// `#${controlId}Err` 的 textContent 即非法输入的提示文案。
//
// 约定：errId(controlId) === controlId + 'Err'。createPanelFragment 会为每个可校验
// 控件生成对应的 `<div id="${controlId}Err">`，作为该契约的单一可执行来源。
export function errId(controlId) {
    return String(controlId) + 'Err';
}

// 各 apply* 入口（field 名）→ 关联控件 id 的映射。
// field 即 apply* 的语义字段名，showFieldError(field, message) 据此定位错误元素。
// 颜色字段使用各自的 Hex 文本框作为错误提示锚点。
export const FIELD_CONTROL_IDS = Object.freeze({
    text: 'pText',
    fontSize: 'pFontSize',
    fontWeight: 'pFontWeight',
    color: 'pColorTxt',
    backgroundColor: 'pBgTxt',
    textAlign: 'pText', // 对齐为按钮组，无独立输入框，提示就近落在文字区
    padding: 'pPad',
    borderRadius: 'pRadius',
    width: 'pWidth',
    height: 'pHeight',
    src: 'pSrc',
    href: 'pHref',
});

// 可校验控件 id 列表（createPanelFragment 据此为每个控件生成 `${id}Err` 错误元素）。
const ERROR_DISPLAY_CONTROL_IDS = Object.freeze([
    PANEL_CONTROL_IDS.pText,
    PANEL_CONTROL_IDS.pFontSize,
    PANEL_CONTROL_IDS.pFontWeight,
    PANEL_CONTROL_IDS.pColorTxt,
    PANEL_CONTROL_IDS.pBgTxt,
    PANEL_CONTROL_IDS.pPad,
    PANEL_CONTROL_IDS.pRadius,
    PANEL_CONTROL_IDS.pWidth,
    PANEL_CONTROL_IDS.pHeight,
    PANEL_CONTROL_IDS.pSrc,
    PANEL_CONTROL_IDS.pHref,
]);

// 字体粗细可选枚举（与 html-editor.html 中 select 选项保持一致，需求 5.3）。
const FONT_WEIGHT_OPTIONS = ['300', '400', '500', '600', '700', '900'];

// 6 位 Hex_Color 正则（颜色选择器 input[type=color] 仅接受 6 位 #rrggbb）。
const HEX6_PATTERN = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// 根节点解析（panel root resolution）
// ---------------------------------------------------------------------------

// 模块级缓存的面板根节点，由 setupPanel 设置。
let cachedRoot = null;

/**
 * 缓存面板根节点，后续 fillForm/clearForm 等调用可省略 root 参数。
 *
 * @param {ParentNode & { getElementById?: Function }} rootElement
 *        面板根节点。可为 document、document fragment 或任意包含面板控件的元素。
 * @returns {ParentNode} 传入的根节点
 */
export function setupPanel(rootElement) {
    cachedRoot = rootElement || null;
    return cachedRoot;
}

/**
 * 解析本次操作应使用的根节点：显式参数 > 缓存根 > 全局 document。
 *
 * @param {ParentNode} [root]
 * @returns {ParentNode|null}
 */
function resolveRoot(root) {
    if (root) return root;
    if (cachedRoot) return cachedRoot;
    if (typeof document !== 'undefined') return document;
    return null;
}

/**
 * 在给定根节点内按 id 查找控件，兼容 document（getElementById）与元素片段
 * （querySelector）两种根节点。找不到时返回 null（调用方需自行容错）。
 *
 * @param {ParentNode} root
 * @param {string} id
 * @returns {HTMLElement|null}
 */
function byId(root, id) {
    if (!root) return null;
    if (typeof root.getElementById === 'function') {
        return root.getElementById(id);
    }
    if (typeof root.querySelector === 'function') {
        return root.querySelector('#' + id);
    }
    return null;
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

// 设置控件的 value（若控件存在）。
function setValue(el, value) {
    if (el) el.value = value;
}

// 设置元素 display 显隐（若元素存在）。
function setDisplay(el, display) {
    if (el) el.style.display = display;
}

/**
 * 回填一对颜色控件：Hex 文本框显示原始 hex（可能为 6 位、8 位或空串），
 * 颜色选择器仅当 hex 为合法 6 位 #rrggbb 时同步（input[type=color] 不接受 8 位/空值）。
 *
 * 该工具同时供后续任务 10.3 的颜色双向联动复用。
 *
 * @param {ParentNode} root
 * @param {string} pickerId 颜色选择器 id
 * @param {string} textId   Hex 文本框 id
 * @param {string} hex      要回填的 Hex_Color（小写），透明为空串
 */
function fillColorPair(root, pickerId, textId, hex) {
    const safeHex = hex || '';
    setValue(byId(root, textId), safeHex);
    if (HEX6_PATTERN.test(safeHex)) {
        setValue(byId(root, pickerId), safeHex);
    }
}

/**
 * 把 select 设为目标值；仅当存在匹配的 option 时生效，否则清空为 ''。
 *
 * @param {HTMLSelectElement|null} select
 * @param {string} value
 */
function setSelectValue(select, value) {
    if (!select) return;
    const target = String(value);
    if (FONT_WEIGHT_OPTIONS.indexOf(target) >= 0) {
        select.value = target;
    } else {
        select.value = '';
    }
}

// ---------------------------------------------------------------------------
// 回填与控件可见性（任务 10.1）
// ---------------------------------------------------------------------------

/**
 * 按字段把 SelectedElementInfo 回填到属性面板全部控件，并依据标签类型调整
 * 控件可见性（需求 3.5 / 7.1 / 7.4）。
 *
 * SelectedElementInfo 字段：
 *   tag, innerText, color, backgroundColor, fontSize, fontWeight,
 *   width, height, src, href, inlineStyle, path
 *
 * 控件可见性规则：
 *   - <img>：显示图片地址分组（grpImg）并预填 src，隐藏文字内容分组（grpText）
 *   - <a>  ：显示链接地址分组（grpLink）并预填 href
 *   - 其他文字元素：显示文字内容分组（grpText）
 *
 * @param {Object} info SelectedElementInfo
 * @param {ParentNode} [root] 面板根节点（缺省使用缓存根或全局 document）
 */
export function fillForm(info, root) {
    const r = resolveRoot(root);
    if (!r || !info) return;

    const tag = String(info.tag || '').toUpperCase();
    const isImg = tag === 'IMG';
    const isA = tag === 'A';

    // 切换为表单态：隐藏空态、显示表单。
    setDisplay(byId(r, PANEL_CONTROL_IDS.panelEmpty), 'none');
    setDisplay(byId(r, PANEL_CONTROL_IDS.editForm), 'block');

    // 标签徽章，如 "<div>"。
    const badge = byId(r, PANEL_CONTROL_IDS.elBadge);
    if (badge) badge.textContent = '<' + tag.toLowerCase() + '>';

    // 文字内容。
    setValue(byId(r, PANEL_CONTROL_IDS.pText), info.innerText || '');

    // 字体大小（数值控件显示对应整数；缺省为空）。
    const fs = info.fontSize;
    setValue(
        byId(r, PANEL_CONTROL_IDS.pFontSize),
        typeof fs === 'number' && Number.isFinite(fs) ? String(fs) : ''
    );

    // 字体粗细（仅匹配枚举选项）。
    setSelectValue(byId(r, PANEL_CONTROL_IDS.pFontWeight), info.fontWeight);

    // 颜色控件（文字色 / 背景色）。
    fillColorPair(r, PANEL_CONTROL_IDS.pColor, PANEL_CONTROL_IDS.pColorTxt, info.color || '');
    fillColorPair(r, PANEL_CONTROL_IDS.pBg, PANEL_CONTROL_IDS.pBgTxt, info.backgroundColor || '');

    // 内边距 / 圆角不属于 SelectedElementInfo，回填时清空（避免残留上一个元素的值）。
    setValue(byId(r, PANEL_CONTROL_IDS.pPad), '');
    setValue(byId(r, PANEL_CONTROL_IDS.pRadius), '');

    // 宽 / 高（取自内联 style，可能为空串）。
    setValue(byId(r, PANEL_CONTROL_IDS.pWidth), info.width || '');
    setValue(byId(r, PANEL_CONTROL_IDS.pHeight), info.height || '');

    // 控件可见性 + 专属控件预填。
    setDisplay(byId(r, PANEL_CONTROL_IDS.grpImg), isImg ? 'block' : 'none');
    setDisplay(byId(r, PANEL_CONTROL_IDS.grpLink), isA ? 'block' : 'none');
    setDisplay(byId(r, PANEL_CONTROL_IDS.grpText), isImg ? 'none' : 'block');

    if (isImg) setValue(byId(r, PANEL_CONTROL_IDS.pSrc), info.src || '');
    if (isA) setValue(byId(r, PANEL_CONTROL_IDS.pHref), info.href || '');
}

/**
 * 清空属性面板，恢复空态（元素删除后调用，需求 8.2）。
 * 仅切换容器显隐，不主动清空各输入框的值——下一次 fillForm 会整体覆盖。
 *
 * @param {ParentNode} [root] 面板根节点（缺省使用缓存根或全局 document）
 */
export function clearForm(root) {
    const r = resolveRoot(root);
    if (!r) return;
    setDisplay(byId(r, PANEL_CONTROL_IDS.panelEmpty), 'flex');
    setDisplay(byId(r, PANEL_CONTROL_IDS.editForm), 'none');
}

// ---------------------------------------------------------------------------
// 测试辅助：构造包含全部约定控件 id 的面板 DOM 片段
//
// 该函数仅用于在 jsdom 下独立测试本模块（如 Property 9）。它产出的结构与
// html-editor.html 中的面板控件 id 一一对应，是控件 ID 契约的单一可执行来源。
// ---------------------------------------------------------------------------

/**
 * 构造一个包含全部面板控件的根元素（detached <div>），供测试传入 fillForm/clearForm。
 *
 * @param {Document} [doc] 用于创建元素的 document（jsdom 测试可显式传入）
 * @returns {HTMLElement} 面板根元素
 */
export function createPanelFragment(doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) {
        throw new Error('createPanelFragment 需要一个可用的 document');
    }

    const root = d.createElement('div');
    const fontWeightOptions = ['<option value="">粗细</option>']
        .concat(FONT_WEIGHT_OPTIONS.map((w) => `<option value="${w}">${w}</option>`))
        .join('');

    // 字段级错误提示元素（id = 控件 id + 'Err'）。见 errId / 错误提示约定。
    const err = (controlId) => `<div id="${errId(controlId)}"></div>`;

    root.innerHTML = [
        // 空态占位
        `<div id="${PANEL_CONTROL_IDS.panelEmpty}" style="display:flex"></div>`,
        // 表单容器
        `<div id="${PANEL_CONTROL_IDS.editForm}" style="display:none">`,
        `  <div id="${PANEL_CONTROL_IDS.elBadge}"></div>`,
        // 文字内容分组
        `  <div id="${PANEL_CONTROL_IDS.grpText}">`,
        `    <textarea id="${PANEL_CONTROL_IDS.pText}"></textarea>`,
        `    ${err(PANEL_CONTROL_IDS.pText)}`,
        `  </div>`,
        // 字体
        `  <input id="${PANEL_CONTROL_IDS.pFontSize}" type="number">`,
        `  ${err(PANEL_CONTROL_IDS.pFontSize)}`,
        `  <select id="${PANEL_CONTROL_IDS.pFontWeight}">${fontWeightOptions}</select>`,
        `  ${err(PANEL_CONTROL_IDS.pFontWeight)}`,
        // 颜色
        `  <input id="${PANEL_CONTROL_IDS.pColor}" type="color">`,
        `  <input id="${PANEL_CONTROL_IDS.pColorTxt}" type="text">`,
        `  ${err(PANEL_CONTROL_IDS.pColorTxt)}`,
        `  <input id="${PANEL_CONTROL_IDS.pBg}" type="color">`,
        `  <input id="${PANEL_CONTROL_IDS.pBgTxt}" type="text">`,
        `  ${err(PANEL_CONTROL_IDS.pBgTxt)}`,
        // 盒模型 / 尺寸
        `  <input id="${PANEL_CONTROL_IDS.pPad}" type="number">`,
        `  ${err(PANEL_CONTROL_IDS.pPad)}`,
        `  <input id="${PANEL_CONTROL_IDS.pRadius}" type="number">`,
        `  ${err(PANEL_CONTROL_IDS.pRadius)}`,
        `  <input id="${PANEL_CONTROL_IDS.pWidth}" type="text">`,
        `  ${err(PANEL_CONTROL_IDS.pWidth)}`,
        `  <input id="${PANEL_CONTROL_IDS.pHeight}" type="text">`,
        `  ${err(PANEL_CONTROL_IDS.pHeight)}`,
        // 图片专属
        `  <div id="${PANEL_CONTROL_IDS.grpImg}" style="display:none">`,
        `    <input id="${PANEL_CONTROL_IDS.pSrc}" type="text">`,
        `    ${err(PANEL_CONTROL_IDS.pSrc)}`,
        `  </div>`,
        // 链接专属
        `  <div id="${PANEL_CONTROL_IDS.grpLink}" style="display:none">`,
        `    <input id="${PANEL_CONTROL_IDS.pHref}" type="text">`,
        `    ${err(PANEL_CONTROL_IDS.pHref)}`,
        `  </div>`,
        // 删除控件与面板级共享提示区
        `  <button id="${PANEL_CONTROL_IDS.pDelete}" type="button">删除元素</button>`,
        `  <div id="${PANEL_CONTROL_IDS.panelNotice}"></div>`,
        `</div>`,
    ].join('\n');

    return root;
}

// ---------------------------------------------------------------------------
// 颜色控件双向联动（任务 10.3，需求 5.11 / 5.12）
//
// 两个控件：颜色选择器 input[type=color]（仅接受 6 位 #rrggbb）与 Hex 文本框
// （接受 # 后 3 或 6 位）。联动需保证 Property 4 往返稳定：
//   输入框 --onColorType--> 选择器 --onColorPick--> 输入框
// 结束时两控件表示同一颜色，且输入框为规范化的 6 位小写 #rrggbb。
//
// 规范化策略（复用 color.js）：normalizeHex(hex) = rgbToHex(hexToRgb(hex))。
//   - hexToRgb 把 3 位 #rgb 按通道复制扩展为 6 位（#abc ≡ #aabbcc）并解析为整数三元组；
//   - rgbToHex 再输出 6 位小写 #rrggbb。
// 这样 3 位与 6 位输入都收敛到同一 6 位小写形式，往返幂等。
// ---------------------------------------------------------------------------

/**
 * 将合法 Hex_Color（# 后接 3 或 6 位十六进制，大小写不限）规范化为 6 位小写
 * #rrggbb；非法输入返回 null。3 位按通道复制扩展（#abc → #aabbcc）。
 *
 * @param {string} hex 形如 "#abc" / "#AABBCC"
 * @returns {string|null} 6 位小写 #rrggbb，或 null（非法）
 */
export function normalizeHex(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    // rgbToHex(rgb(r,g,b)) 始终输出 6 位小写 #rrggbb。
    return rgbToHex('rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')');
}

/**
 * 颜色选择器变更 → 同步 Hex 文本框（需求 5.11）。
 *
 * input[type=color] 的 value 恒为 6 位 #rrggbb，规范化为 6 位小写后写入文本框。
 * 选择器值无法解析时（极少见）保持文本框不变并返回 null。
 *
 * @param {string} pickerId 颜色选择器控件 id
 * @param {string} hexInputId Hex 文本框控件 id
 * @param {string} [prop] 关联的样式属性（'color'/'backgroundColor'），供任务 10.5 应用样式时使用；本步联动不需要
 * @param {ParentNode} [root] 面板根节点（缺省使用缓存根或全局 document）
 * @returns {string|null} 写入文本框的 6 位小写 Hex，或 null（选择器值无法解析）
 */
export function onColorPick(pickerId, hexInputId, prop, root) {
    const r = resolveRoot(root);
    if (!r) return null;

    const picker = byId(r, pickerId);
    if (!picker) return null;

    const normalized = normalizeHex(picker.value);
    if (!normalized) return null;

    setValue(byId(r, hexInputId), normalized);
    return normalized;
}

/**
 * Hex 文本框合法输入 → 同步颜色选择器（需求 5.12）。
 *
 * 仅当文本框内容为合法 Hex（# 后接 3 或 6 位十六进制）时同步：把（含 3 位扩展后的）
 * 颜色规范化为 6 位 #rrggbb 写入选择器（input[type=color] 仅接受 6 位）。非法输入时
 * 不修改选择器（no-op），返回 null —— 完整的无效输入错误提示交由任务 10.5 处理。
 *
 * @param {string} hexInputId Hex 文本框控件 id
 * @param {string} pickerId 颜色选择器控件 id
 * @param {string} [prop] 关联的样式属性（'color'/'backgroundColor'），供任务 10.5 应用样式时使用；本步联动不需要
 * @param {ParentNode} [root] 面板根节点（缺省使用缓存根或全局 document）
 * @returns {string|null} 写入选择器的 6 位小写 Hex，或 null（输入非法，未同步）
 */
export function onColorType(hexInputId, pickerId, prop, root) {
    const r = resolveRoot(root);
    if (!r) return null;

    const hexInput = byId(r, hexInputId);
    if (!hexInput) return null;

    const normalized = normalizeHex(hexInput.value);
    // 非法输入：保持选择器不变（不同步），错误提示由任务 10.5 负责。
    if (!normalized) return null;

    setValue(byId(r, pickerId), normalized);
    return normalized;
}

// ===========================================================================
// 各属性 apply 入口、校验与错误提示（任务 10.5）
//
// 需求：5.1, 5.3, 5.4, 5.5, 5.6, 5.10, 5.13, 5.14, 7.2, 7.3, 7.5, 7.6, 8.1, 8.5
// 覆盖 Property 16（非法输入被拒绝且无副作用）与 Property 17（地址属性应用保真，
// 与注入脚本的 update 处理共同满足）。
//
// 数据流与职责边界（参见 design.md「交互与编辑流程」）：
//   - 合法输入：经 input-validation.js 校验通过后，调用注入的 send(message) 把
//     DownMessage { type:'update', prop, val } 下发给 iframe；预览侧应用样式后回发
//     { type:'changed' }，由编辑器侧的 ChangeCounter.increment() 计数（需求 5.10）。
//     ⇒ apply* 本身「不」直接递增 Change_Count；计数由 'changed' 上行消息驱动。
//   - 非法输入：保持选中元素相关样式/属性不变（即「不发送任何 update」，预览 DOM 因此
//     不变），不计数，并调用 showFieldError(field, message) 在对应控件旁显示无效提示。
//
// 依赖注入（便于在 jsdom 下独立测试）：
//   - setSender(fn)：缓存「下行发送函数」。apply*/deleteElement 通过它发送 update/delete。
//     约定 fn 接收单个 DownMessage 对象。任务 11.3 会把它接到 MessageBus.send
//     （内部 iframe.contentWindow.postMessage(msg,'*')），并把上行 'changed' 路由到
//     ChangeCounter.increment()。未注入 sender 时 send 为安全 no-op。
//   - setHasSelection(bool)：缓存「当前是否存在选中元素」。deleteElement 据此决定
//     发送 delete 还是提示无可删除元素（需求 8.5）。面板自身不拥有选中状态，故由编辑器
//     在选中（fillForm 后）调用 setHasSelection(true)、在清空/删除（clearForm/deleted）
//     后调用 setHasSelection(false) 来同步。
// ===========================================================================

// ---------------------------------------------------------------------------
// 依赖注入：下行发送函数 与 选中状态标记
// ---------------------------------------------------------------------------

// 模块级缓存的下行发送函数；未注入时为 null（send 安全 no-op）。
let _sender = null;

// 模块级缓存的「是否存在选中元素」标记；默认 false。
let _hasSelection = false;

/**
 * 注入/替换下行发送函数。apply 入口与 deleteElement 通过它发送 DownMessage。
 *
 * 约定 fn 接收单个 DownMessage 对象：{ type:'update', prop, val }。
 *
 * @param {(message: object) => void} fn 下行发送函数
 * @returns {Function|null} 当前缓存的发送函数
 */
export function setSender(fn) {
    _sender = typeof fn === 'function' ? fn : null;
    return _sender;
}

/** 读取当前缓存的发送函数（主要供测试断言）。 */
export function getSender() {
    return _sender;
}

/**
 * 设置「当前是否存在选中元素」。供编辑器在选中/清空时同步，deleteElement 据此判断。
 *
 * @param {boolean} flag
 * @returns {boolean} 设置后的标记
 */
export function setHasSelection(flag) {
    _hasSelection = !!flag;
    return _hasSelection;
}

/** 读取当前选中状态标记。 */
export function hasSelection() {
    return _hasSelection;
}

/**
 * 内部下行发送：仅当已注入 sender 时调用，否则安全 no-op。
 * @param {{type:'update', prop:string, val?:string|boolean}} message
 * @returns {boolean} 是否实际发送
 */
function send(message) {
    if (_sender) {
        _sender(message);
        return true;
    }
    return false;
}

/** 发送一条 update 指令（prop/val）。 */
function sendUpdate(prop, val) {
    return send({
        type: 'update',
        prop,
        val
    });
}

// ---------------------------------------------------------------------------
// 错误提示与面板通知
// ---------------------------------------------------------------------------

// 各字段的无效提示文案（需求 5.13 / 5.14 / 7.3 / 7.6）。
const FIELD_ERROR_MESSAGES = Object.freeze({
    fontSize: '请输入 1 到 999 之间的整数',
    fontWeight: '请选择有效的字体粗细',
    color: '颜色值无效（应为 # 后接 3 或 6 位十六进制）',
    backgroundColor: '颜色值无效（应为 # 后接 3 或 6 位十六进制）',
    textAlign: '请选择有效的对齐方式',
    padding: '请输入 0 到 9999 之间的整数',
    borderRadius: '请输入 0 到 9999 之间的整数',
    width: '请输入有效的宽度（px: 0–99999，% : 0–100）',
    height: '请输入有效的高度（px: 0–99999，% : 0–100）',
    address: '地址不能为空',
});

// 无可删除选中元素的提示（需求 8.5）。
export const NO_SELECTION_NOTICE = '没有可删除的选中元素';

/**
 * 把字段 field（apply* 语义字段名，或直接为控件 id）解析为对应错误元素 id。
 * @param {string} field
 * @returns {string|null}
 */
function resolveErrorId(field) {
    const controlId = FIELD_CONTROL_IDS[field] || field;
    return controlId ? errId(controlId) : null;
}

/**
 * 显示字段级无效提示（需求 5.13 / 5.14 / 7.3 / 7.6）。
 * 把 message 写入「控件 id + 'Err'」错误元素的 textContent 并显示。
 *
 * @param {string} field apply* 字段名（如 'fontSize'/'color'/'src'）或控件 id
 * @param {string} message 提示文案
 * @param {ParentNode} [root] 面板根节点（缺省使用缓存根或全局 document）
 * @returns {HTMLElement|null} 写入的错误元素，或 null（未找到）
 */
export function showFieldError(field, message, root) {
    const r = resolveRoot(root);
    if (!r) return null;
    const id = resolveErrorId(field);
    if (!id) return null;
    const el = byId(r, id);
    if (!el) return null;
    el.textContent = message == null ? '' : String(message);
    el.style.display = 'block';
    return el;
}

/**
 * 清除字段级无效提示（合法输入应用后调用）。
 * @param {string} field apply* 字段名或控件 id
 * @param {ParentNode} [root]
 * @returns {HTMLElement|null}
 */
export function clearFieldError(field, root) {
    const r = resolveRoot(root);
    if (!r) return null;
    const id = resolveErrorId(field);
    if (!id) return null;
    const el = byId(r, id);
    if (!el) return null;
    el.textContent = '';
    el.style.display = 'none';
    return el;
}

/**
 * 显示面板级通知（如删除时无可删除元素，需求 8.5）。
 * @param {string} message
 * @param {ParentNode} [root]
 * @returns {HTMLElement|null}
 */
export function showNotice(message, root) {
    const r = resolveRoot(root);
    if (!r) return null;
    const el = byId(r, PANEL_CONTROL_IDS.panelNotice);
    if (!el) return null;
    el.textContent = message == null ? '' : String(message);
    el.style.display = 'block';
    return el;
}

/** 清除面板级通知。 */
export function clearNotice(root) {
    const r = resolveRoot(root);
    if (!r) return null;
    const el = byId(r, PANEL_CONTROL_IDS.panelNotice);
    if (!el) return null;
    el.textContent = '';
    el.style.display = 'none';
    return el;
}

// ---------------------------------------------------------------------------
// 宽 / 高单位解析（width/height 支持 px 与 %）
//
// 输入框为自由文本，用户可输入如 "200"、"200px"、"50%"、" 50 % "。解析策略：
//   1) 去首尾空白；
//   2) 若以 '%' 结尾 → 单位为 '%'，数值为 '%' 之前的部分；
//   3) 否则若以 'px'（大小写不限）结尾 → 单位为 'px'，数值为 'px' 之前的部分；
//   4) 否则视为无单位 → 默认按 'px' 处理，数值为整串。
// 数值部分再交给 validateWidth/validateHeight（其内部以 parseStrictInt 严格校验整数，
// 并按单位选择取值范围：px 0..99999 / % 0..100）。这样既支持纯数字（默认 px），
// 也支持显式 px/% 单位，且把单位检测与范围校验解耦。
// ---------------------------------------------------------------------------

/**
 * 从宽/高输入串解析出 { numeric, unit }。numeric 为去掉单位、去空白后的字符串
 * （交给校验器做严格整数判断），unit 为 'px' 或 '%'。
 *
 * @param {string} raw 原始输入
 * @returns {{ numeric: string, unit: 'px'|'%' }}
 */
export function parseLengthInput(raw) {
    const s = (raw == null ? '' : String(raw)).trim();
    if (s.endsWith('%')) {
        return {
            numeric: s.slice(0, -1).trim(),
            unit: '%'
        };
    }
    const lower = s.toLowerCase();
    if (lower.endsWith('px')) {
        return {
            numeric: s.slice(0, -2).trim(),
            unit: 'px'
        };
    }
    return {
        numeric: s,
        unit: 'px'
    };
}

// ---------------------------------------------------------------------------
// apply* 入口
//
// 统一约定：合法 → sendUpdate(prop, val) + clearFieldError(field)，返回
// { ok:true, prop, val, sent }；非法 → showFieldError(field, message)，不发送、不计数，
// 返回 { ok:false }。返回值便于任务 10.6 的属性测试断言「是否发送 / 是否提示」。
// ---------------------------------------------------------------------------

/**
 * 应用文字内容（需求 5.1）。文字内容无格式约束，原样作为 update 下发（prop 'text'）。
 * @param {string} value
 * @param {ParentNode} [root]
 * @returns {{ok:boolean, prop?:string, val?:string, sent?:boolean}}
 */
export function applyText(value, root) {
    const val = value == null ? '' : String(value);
    clearFieldError('text', root);
    const sent = sendUpdate('text', val);
    return {
        ok: true,
        prop: 'text',
        val,
        sent
    };
}

/**
 * 应用字体大小（需求 5.2 / 5.13）。合法范围 1..999 整数（px）。
 * @returns {{ok:boolean, prop?:string, val?:string, sent?:boolean}}
 */
export function applyFontSize(value, root) {
    const res = validateFontSize(value);
    if (!res.ok) {
        showFieldError('fontSize', FIELD_ERROR_MESSAGES.fontSize, root);
        return {
            ok: false
        };
    }
    clearFieldError('fontSize', root);
    const sent = sendUpdate('fontSize', res.value);
    return {
        ok: true,
        prop: 'fontSize',
        val: res.value,
        sent
    };
}

/**
 * 应用字体粗细（需求 5.3 / 5.13）。合法枚举 {300,400,500,600,700,900}。
 */
export function applyFontWeight(value, root) {
    const res = validateFontWeight(value);
    if (!res.ok) {
        showFieldError('fontWeight', FIELD_ERROR_MESSAGES.fontWeight, root);
        return {
            ok: false
        };
    }
    clearFieldError('fontWeight', root);
    const sent = sendUpdate('fontWeight', res.value);
    return {
        ok: true,
        prop: 'fontWeight',
        val: res.value,
        sent
    };
}

/**
 * 应用文字颜色（需求 5.4 / 5.14）。合法 Hex（# 后接 3/6 位十六进制），
 * 下发前规范化为 6 位小写 #rrggbb（与颜色控件联动保持一致）。
 */
export function applyColor(value, root) {
    const res = validateColor(value);
    if (!res.ok) {
        showFieldError('color', FIELD_ERROR_MESSAGES.color, root);
        return {
            ok: false
        };
    }
    clearFieldError('color', root);
    const val = normalizeHex(res.value) || res.value;
    const sent = sendUpdate('color', val);
    return {
        ok: true,
        prop: 'color',
        val,
        sent
    };
}

/**
 * 应用背景颜色（需求 5.5 / 5.14）。规则同 applyColor，prop 为 'backgroundColor'。
 */
export function applyBackground(value, root) {
    const res = validateColor(value);
    if (!res.ok) {
        showFieldError('backgroundColor', FIELD_ERROR_MESSAGES.backgroundColor, root);
        return {
            ok: false
        };
    }
    clearFieldError('backgroundColor', root);
    const val = normalizeHex(res.value) || res.value;
    const sent = sendUpdate('backgroundColor', val);
    return {
        ok: true,
        prop: 'backgroundColor',
        val,
        sent
    };
}

/**
 * 应用文字对齐（需求 5.6）。合法枚举 {left,center,right}。
 */
export function applyTextAlign(value, root) {
    const res = validateTextAlign(value);
    if (!res.ok) {
        showFieldError('textAlign', FIELD_ERROR_MESSAGES.textAlign, root);
        return {
            ok: false
        };
    }
    clearFieldError('textAlign', root);
    const sent = sendUpdate('textAlign', res.value);
    return {
        ok: true,
        prop: 'textAlign',
        val: res.value,
        sent
    };
}

/**
 * 应用内边距（需求 5.7 / 5.13）。合法范围 0..9999 整数（px）。
 */
export function applyPadding(value, root) {
    const res = validatePadding(value);
    if (!res.ok) {
        showFieldError('padding', FIELD_ERROR_MESSAGES.padding, root);
        return {
            ok: false
        };
    }
    clearFieldError('padding', root);
    const sent = sendUpdate('padding', res.value);
    return {
        ok: true,
        prop: 'padding',
        val: res.value,
        sent
    };
}

/**
 * 应用圆角（需求 5.8 / 5.13）。合法范围 0..9999 整数（px），prop 为 'borderRadius'。
 */
export function applyRadius(value, root) {
    const res = validateBorderRadius(value);
    if (!res.ok) {
        showFieldError('borderRadius', FIELD_ERROR_MESSAGES.borderRadius, root);
        return {
            ok: false
        };
    }
    clearFieldError('borderRadius', root);
    const sent = sendUpdate('borderRadius', res.value);
    return {
        ok: true,
        prop: 'borderRadius',
        val: res.value,
        sent
    };
}

/**
 * 应用宽度（需求 5.9 / 5.13）。从输入串解析 px/% 单位后按对应范围校验。
 */
export function applyWidth(value, root) {
    const {
        numeric,
        unit
    } = parseLengthInput(value);
    const res = validateWidth(numeric, unit);
    if (!res.ok) {
        showFieldError('width', FIELD_ERROR_MESSAGES.width, root);
        return {
            ok: false
        };
    }
    clearFieldError('width', root);
    const sent = sendUpdate('width', res.value);
    return {
        ok: true,
        prop: 'width',
        val: res.value,
        sent
    };
}

/**
 * 应用高度（需求 5.9 / 5.13）。规则同 applyWidth，prop 为 'height'。
 */
export function applyHeight(value, root) {
    const {
        numeric,
        unit
    } = parseLengthInput(value);
    const res = validateHeight(numeric, unit);
    if (!res.ok) {
        showFieldError('height', FIELD_ERROR_MESSAGES.height, root);
        return {
            ok: false
        };
    }
    clearFieldError('height', root);
    const sent = sendUpdate('height', res.value);
    return {
        ok: true,
        prop: 'height',
        val: res.value,
        sent
    };
}

/**
 * 应用图片地址（需求 7.2 / 7.3）。非空且 ≤ 2048 字符方可下发（prop 'src'）；
 * 空值保留原值并提示「地址不能为空」（需求 7.3）。
 */
export function applySrc(value, root) {
    const res = validateAddress(value);
    if (!res.ok) {
        showFieldError('src', addressErrorMessage(value), root);
        return {
            ok: false
        };
    }
    clearFieldError('src', root);
    const sent = sendUpdate('src', res.value);
    return {
        ok: true,
        prop: 'src',
        val: res.value,
        sent
    };
}

/**
 * 应用链接地址（需求 7.5 / 7.6）。规则同 applySrc，prop 为 'href'。
 */
export function applyHref(value, root) {
    const res = validateAddress(value);
    if (!res.ok) {
        showFieldError('href', addressErrorMessage(value), root);
        return {
            ok: false
        };
    }
    clearFieldError('href', root);
    const sent = sendUpdate('href', res.value);
    return {
        ok: true,
        prop: 'href',
        val: res.value,
        sent
    };
}

// 地址无效提示文案：空/纯空白 → 「地址不能为空」（需求 7.3 / 7.6）；
// 超长 → 「地址超出长度限制」。
function addressErrorMessage(value) {
    const s = typeof value === 'string' ? value : '';
    if (s.trim().length === 0) {
        return FIELD_ERROR_MESSAGES.address; // 地址不能为空
    }
    return `地址超出长度限制（最多 ${MAX_ADDRESS_LENGTH} 字符）`;
}

// ---------------------------------------------------------------------------
// 删除元素（需求 8.1 / 8.5）
// ---------------------------------------------------------------------------

/**
 * 删除选中元素：
 *   - 有选中元素（hasSelection() 为真）：下发 { type:'update', prop:'delete' } 指令，
 *     由注入脚本移除元素子树并回发 'deleted'/'changed'（计数由编辑器侧处理，需求 8.1/8.3）。
 *   - 无选中元素：不下发任何指令（不改 DOM、不计数），显示「没有可删除的选中元素」（需求 8.5）。
 *
 * @param {ParentNode} [root]
 * @returns {{ok:boolean, deleted:boolean, sent?:boolean}}
 */
export function deleteElement(root) {
    if (!hasSelection()) {
        showNotice(NO_SELECTION_NOTICE, root);
        return {
            ok: false,
            deleted: false
        };
    }
    clearNotice(root);
    const sent = sendUpdate('delete', true);
    return {
        ok: true,
        deleted: true,
        sent
    };
}