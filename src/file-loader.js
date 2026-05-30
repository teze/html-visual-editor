// file-loader.js — 文件加载器 DOM 接线（任务 11.1，需求 1.1/1.2/1.4/1.6/1.7）
//
// 职责：
//   - openFile(input)：由 <input type="file"> 的 change 事件触发，读取所选文件。
//   - handleDrop(event)：由 canvas / dropzone 的 drop 事件触发，处理（可能多个）拖入文件。
//   - loadFile(file)：核心「校验 + FileReader 读取文本」流程。
//
// 设计为可测试、低耦合（参见 design.md「1. File_Loader」与本仓库其他模块的风格）：
//   - 本模块不直接依赖 preview-frame / status-bar / topbar 等其他模块（它们由并行任务开发）。
//     而是通过一个「回调依赖对象（deps）」与外部协作，真正的接线在任务 12.1 完成。
//   - 校验逻辑复用 src/file-validation.js 的 validateFile / pickFirstHtml（不重复实现）。
//   - 文本读取使用 FileReader.readAsText（UTF-8）；为便于 jsdom 测试，可经 deps 注入
//     自定义 FileReader 实现（FileReaderImpl），默认使用全局 FileReader。
//
// ─────────────────────────────────────────────────────────────────────────
// 回调契约（deps）—— 供任务 12.1 接线：
//   onLoad(text, filename)   读取成功：text 为文件文本内容，filename 为完整文件名（含扩展名）。
//                            调用方据此 render(text) 到 Preview_Frame 并刷新状态栏。
//   setFilename(filename)    加载成功时在顶栏显示完整文件名（含扩展名）（需求 1.4）。
//   onError(message)         校验/读取失败：经状态栏显示错误提示；调用方须保持
//                            Preview_Frame 现有内容不变（需求 1.3/1.5/1.6）。
//   onNotice(message)        非阻塞提示（如多文件「已忽略其余文件」）（需求 1.7）。
//   FileReaderImpl           可选，注入的 FileReader 构造器（默认 globalThis.FileReader）。
//
// 说明：onLoad 触发后由调用方负责把文本送入 Preview_Frame（render）并把
// 文件名、状态栏、修改计数等接好；本模块只关心「拿到合法文本 / 报告失败」。
// ─────────────────────────────────────────────────────────────────────────

import {
    validateFile,
    pickFirstHtml
} from './file-validation.js';

// ---------------------------------------------------------------------------
// 提示文案常量（统一中文提示，供任务 12.1 复用，便于测试断言）
// ---------------------------------------------------------------------------

// 文件类型不受支持（需求 1.3）。
export const ERR_UNSUPPORTED_TYPE = '文件类型不受支持，请选择 .html 或 .htm 文件';
// 文件超出大小限制（需求 1.5；上限 10 MB / 10,485,760 字节）。
export const ERR_TOO_LARGE = '文件超出大小限制（最大 10 MB）';
// 文件读取失败（需求 1.6，FileReader.onerror）。
export const ERR_READ_FAILED = '文件读取失败，请重试';
// 一次拖入多个文件时，仅加载首个 HTML 并忽略其余（需求 1.7）。
export const NOTICE_IGNORED_OTHERS = '已忽略其余文件，仅加载第一个 HTML 文件';

// 校验失败原因 → 错误文案映射（与 validateFile 的 reason 对应）。
const REASON_MESSAGE = {
    unsupported_type: ERR_UNSUPPORTED_TYPE,
    too_large: ERR_TOO_LARGE,
};

// 空操作占位，确保未提供的回调不会导致崩溃。
const NOOP = () => {};

/**
 * 规范化 deps：为缺失的回调提供空实现，并解析 FileReader 构造器。
 * @param {object} [deps]
 * @returns {{ onLoad: Function, setFilename: Function, onError: Function, onNotice: Function, FileReaderImpl: (Function|null) }}
 */
function normalizeDeps(deps) {
    const d = deps || {};
    const FileReaderImpl =
        d.FileReaderImpl ||
        (typeof FileReader !== 'undefined' ? FileReader : null);
    return {
        onLoad: typeof d.onLoad === 'function' ? d.onLoad : NOOP,
        setFilename: typeof d.setFilename === 'function' ? d.setFilename : NOOP,
        onError: typeof d.onError === 'function' ? d.onError : NOOP,
        onNotice: typeof d.onNotice === 'function' ? d.onNotice : NOOP,
        FileReaderImpl,
    };
}

/**
 * 核心校验 + 读取流程（需求 1.1/1.2/1.4/1.6）。
 *
 * 流程：
 *   1) validateFile(name, size) 校验扩展名与大小：
 *        - unsupported_type → onError(类型不受支持)，保持预览不变（需求 1.3）。
 *        - too_large        → onError(超出大小限制)，保持预览不变（需求 1.5）。
 *   2) 校验通过后用 FileReader.readAsText 读取文本：
 *        - onload  → setFilename(完整文件名) + onLoad(text, filename)（需求 1.1/1.2/1.4）。
 *        - onerror → onError(读取失败)，保持预览不变（需求 1.6）。
 *
 * 任意失败路径都不调用 onLoad，从而保持 Preview_Frame 现有内容不变。
 *
 * @param {File} file 待加载的文件（需含 name、size，并可被 FileReader 读取）
 * @param {object} [deps] 回调依赖对象（见文件头「回调契约」）
 */
export function loadFile(file, deps) {
    const {
        onLoad,
        setFilename,
        onError,
        onNotice,
        FileReaderImpl
    } = normalizeDeps(deps);

    if (!file) {
        // 无文件可加载：静默返回（不属于错误场景，例如取消选择）。
        return;
    }

    // 1) 扩展名与大小校验。
    const result = validateFile(file.name, file.size);
    if (!result.ok) {
        onError(REASON_MESSAGE[result.reason] || ERR_UNSUPPORTED_TYPE);
        return;
    }

    // 2) 读取文本内容。
    if (!FileReaderImpl) {
        // 环境缺少 FileReader（非浏览器且未注入实现）：按读取失败处理，保持预览不变。
        onError(ERR_READ_FAILED);
        return;
    }

    let reader;
    try {
        reader = new FileReaderImpl();
    } catch (e) {
        onError(ERR_READ_FAILED);
        return;
    }

    reader.onload = (ev) => {
        const text = ev && ev.target ? ev.target.result : reader.result;
        // 加载成功：顶栏显示完整文件名（含扩展名），并把文本交给调用方渲染。
        setFilename(file.name);
        onLoad(typeof text === 'string' ? text : String(text == null ? '' : text), file.name);
    };

    reader.onerror = () => {
        // 读取失败：中止本次加载，保持 Preview_Frame 现有内容不变（需求 1.6）。
        onError(ERR_READ_FAILED);
    };

    try {
        reader.readAsText(file, 'UTF-8');
    } catch (e) {
        // readAsText 同步抛错（极少见）也按读取失败处理。
        onError(ERR_READ_FAILED);
    }

    // onNotice 在 handleDrop 的多文件场景中调用；此处保留引用避免未用告警。
    void onNotice;
}

/**
 * 由 <input type="file"> 的 change 事件触发（需求 1.1）。
 * 取所选的第一个文件交给 loadFile（input accept=".html,.htm" 已在 UI 层限制类型，
 * 但仍由 loadFile 经 validateFile 做权威校验）。
 *
 * @param {HTMLInputElement} input 触发 change 的文件输入元素
 * @param {object} [deps] 回调依赖对象
 */
export function openFile(input, deps) {
    const files = input && input.files;
    const file = files && files.length > 0 ? files[0] : null;
    if (!file) {
        // 未选择文件（例如用户取消对话框）：静默返回。
        return;
    }
    loadFile(file, deps);
}

/**
 * 由 canvas / dropzone 的 drop 事件触发（需求 1.2/1.7）。
 *
 * 处理流程：
 *   - 阻止浏览器默认打开文件行为（若 event 提供 preventDefault）。
 *   - 从 dataTransfer.files 中用 pickFirstHtml 取首个 .html/.htm 文件：
 *       * 无合法 HTML 文件 → onError(类型不受支持)，保持预览不变（需求 1.3）。
 *       * 存在其余文件（ignoredOthers）→ onNotice(已忽略其余文件)（需求 1.7）。
 *   - 将选中的文件交给 loadFile 做权威校验与读取。
 *
 * @param {DragEvent} event drop 事件
 * @param {object} [deps] 回调依赖对象
 */
export function handleDrop(event, deps) {
    const normalized = normalizeDeps(deps);

    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const dataTransfer = event && event.dataTransfer;
    const files = dataTransfer && dataTransfer.files;
    if (!files || files.length === 0) {
        // 没有文件被拖入（例如拖入的是文本/链接）：静默返回。
        return;
    }

    const picked = pickFirstHtml(files);
    if (!picked || !picked.file) {
        // 一个合法 HTML 文件都没有：提示类型不受支持，保持预览不变。
        normalized.onError(ERR_UNSUPPORTED_TYPE);
        return;
    }

    if (picked.ignoredOthers) {
        // 多文件择一：提示已忽略其余文件（需求 1.7）。
        normalized.onNotice(NOTICE_IGNORED_OTHERS);
    }

    // 选中文件仍需经 loadFile 做权威的扩展名/大小校验与读取。
    loadFile(picked.file, deps);
}

/**
 * createFileLoader(deps) — 工厂：绑定回调依赖，返回符合 design.md 中
 * FileLoader 接口（openFile(input) / handleDrop(event) / loadFile(file)）的实例。
 *
 * 任务 12.1 接线示例：
 *   const loader = createFileLoader({
 *     onLoad: (text, name) => previewFrame.render(text),  // 渲染到 Preview_Frame
 *     setFilename: (name) => { fileNameEl.textContent = name; },
 *     onError: (msg) => statusBar.showError(msg),          // 状态栏错误提示
 *     onNotice: (msg) => statusBar.setStatus(msg),         // 状态栏普通提示
 *   });
 *   fileInput.addEventListener('change', () => loader.openFile(fileInput));
 *   dropzone.addEventListener('drop', (e) => loader.handleDrop(e));
 *
 * @param {object} [deps] 回调依赖对象（见文件头「回调契约」）
 * @returns {{ openFile: (input: HTMLInputElement) => void, handleDrop: (event: DragEvent) => void, loadFile: (file: File) => void }}
 */
export function createFileLoader(deps) {
    return {
        openFile: (input) => openFile(input, deps),
        handleDrop: (event) => handleDrop(event, deps),
        loadFile: (file) => loadFile(file, deps),
    };
}