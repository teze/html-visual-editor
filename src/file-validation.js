// file-validation.js — 文件校验（需求 1）
// 校验扩展名与大小（validateFile），并从多文件列表中择一加载（pickFirstHtml）。

export const MAX_FILE_SIZE = 10485760; // 10 MB（10,485,760 字节）

// 合法 HTML 扩展名：.html / .htm（大小写不敏感）。
const HTML_EXT_RE = /\.html?$/i;

// 判断文件名扩展名是否为 .html / .htm。
function hasHtmlExtension(name) {
    return typeof name === 'string' && HTML_EXT_RE.test(name);
}

/**
 * validateFile(name, size)
 * 当且仅当「扩展名匹配 /\.html?$/i」且「size <= MAX_FILE_SIZE」时通过。
 *
 * 返回结构化结果：
 *   - 通过： { ok: true }
 *   - 拒绝： { ok: false, reason: 'unsupported_type' | 'too_large' }
 *
 * 决策说明（确定性）：当扩展名与大小同时不满足时，优先返回类型错误
 * （'unsupported_type'）。这是一个可预测的确定性选择——先做类型判定，
 * 再做大小判定。
 *
 * @param {string} name 文件名（含扩展名）
 * @param {number} size 文件大小（字节）
 * @returns {{ ok: true } | { ok: false, reason: 'unsupported_type' | 'too_large' }}
 */
export function validateFile(name, size) {
    // 1) 类型检查优先
    if (!hasHtmlExtension(name)) {
        return {
            ok: false,
            reason: 'unsupported_type'
        };
    }
    // 2) 大小检查（边界：10485760 通过，10485761 拒绝）
    if (!(typeof size === 'number' && size <= MAX_FILE_SIZE)) {
        return {
            ok: false,
            reason: 'too_large'
        };
    }
    return {
        ok: true
    };
}

/**
 * pickFirstHtml(files)
 * 从一个类数组的文件列表中，返回首个扩展名为 .html / .htm 的文件；
 * 若除该文件外列表中还存在其他文件，则附带「已忽略其余文件」标记。
 *
 * 返回结构化结果：
 *   - 命中： { file, ignoredOthers: boolean }
 *       ignoredOthers 为 true 当且仅当列表中除选中文件外还存在其他文件
 *       （即 files 长度 > 1）。
 *   - 未命中： { file: null }
 *
 * 注：此函数仅按扩展名择一（与设计「遍历 dataTransfer.files，仅取第一个
 * 扩展名合法的文件」一致）；大小校验由 validateFile 在加载流程中单独完成。
 *
 * @param {ArrayLike<{ name: string, size?: number }>} files 类数组的文件列表，每项含 name（可选 size）
 * @returns {{ file: object, ignoredOthers: boolean } | { file: null }}
 */
export function pickFirstHtml(files) {
    const list = files == null ? [] : Array.from(files);
    const first = list.find((f) => f && hasHtmlExtension(f.name));

    if (!first) {
        return {
            file: null
        };
    }

    // 除选中文件外还存在其他文件 ⇒ 标记已忽略其余文件。
    const ignoredOthers = list.length > 1;
    return {
        file: first,
        ignoredOthers
    };
}