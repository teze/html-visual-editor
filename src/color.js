// color.js — 颜色读取与转换
//
// 负责 rgb()/rgba() ↔ Hex 的相互转换，保证往返一致性（需求 6）。
//
// 设计约定（参见 design.md「颜色模型与转换」）：
//   - getComputedStyle 返回 rgb(r, g, b) 或 rgba(r, g, b, a)，r/g/b ∈ [0,255]，a ∈ [0,1]。
//   - rgb → hex：每通道 n.toString(16).padStart(2,'0')，结果为小写 6 位 #rrggbb。
//   - rgba(a<1) → hex8：在 6 位基础上追加 Math.round(a*255).toString(16).padStart(2,'0')。
//   - hex 解析：3 位 #rgb 按通道复制扩展为 6 位（#abc ≡ #aabbcc）；6 位 #rrggbb 直接解析。
//   - 透明特殊值 rgba(0,0,0,0) / transparent 视为「无背景色」，回填为空串 ""。
//   - 解析失败返回 null 作为可识别的失败标记，调用方据此显示「解析失败」提示。

// 匹配 rgb(...) 或 rgba(...)，容忍逗号/空白分隔与多余空白。
// 捕获组：1=r, 2=g, 3=b, 4=alpha（可选）。
const RGB_PATTERN =
    /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*([0-9]*\.?[0-9]+)\s*)?\)$/i;

// 单个 0..255 通道整数 → 两位小写十六进制。
function channelToHex(n) {
    return n.toString(16).padStart(2, '0');
}

/**
 * 将 CSS rgb()/rgba() 颜色字符串转换为 Hex_Color。
 *
 * - rgb(r,g,b)            → 6 位小写 #rrggbb
 * - rgba(r,g,b,a) 且 a<1  → 8 位小写 #rrggbbaa（aa = Math.round(a*255) 两位十六进制）
 * - rgba(r,g,b,a) 且 a>=1 → 等价于不透明，输出 6 位 #rrggbb
 * - rgba(0,0,0,0) / "transparent" → 空串 ""（无背景色）
 * - 无法解析为合法 rgb/rgba（含通道越界）→ null（可识别失败标记）
 *
 * @param {string} rgbString 形如 "rgb(255, 0, 0)" 或 "rgba(0, 0, 0, 0.5)" 的字符串
 * @returns {string|null} Hex_Color（小写）、空串（透明），或 null（解析失败）
 */
export function rgbToHex(rgbString) {
    if (typeof rgbString !== 'string') {
        return null;
    }

    const input = rgbString.trim();

    // 透明关键字视为无背景色。
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

    // 通道必须落在 [0,255]，否则视为非法颜色。
    if (r > 255 || g > 255 || b > 255) {
        return null;
    }

    const hasAlpha = match[4] !== undefined;
    const alpha = hasAlpha ? Number(match[4]) : 1;

    // alpha 必须落在 [0,1]，否则视为非法。
    if (alpha < 0 || alpha > 1) {
        return null;
    }

    // rgba(0,0,0,0) 等价于「无背景色」。
    if (hasAlpha && alpha === 0 && r === 0 && g === 0 && b === 0) {
        return '';
    }

    const base = '#' + channelToHex(r) + channelToHex(g) + channelToHex(b);

    // alpha < 1 时追加 8 位透明度分量；a >= 1 视为不透明，保持 6 位。
    if (hasAlpha && alpha < 1) {
        const alphaByte = Math.round(alpha * 255);
        return base + channelToHex(alphaByte);
    }

    return base;
}

/**
 * 将 Hex_Color 解析为 RGB 整数三元组。
 *
 * - 3 位 #rgb     → 按通道复制扩展为 6 位（#abc ≡ #aabbcc）再解析
 * - 6 位 #rrggbb  → 直接解析
 * - 大小写均接受，内部规范化为小写
 * - 其他长度或含非十六进制字符 → null（可识别失败标记）
 *
 * @param {string} hex 形如 "#abc" 或 "#aabbcc"（大小写不限）
 * @returns {{r: number, g: number, b: number}|null} RGB 整数三元组或 null（解析失败）
 */
export function hexToRgb(hex) {
    if (typeof hex !== 'string') {
        return null;
    }

    const input = hex.trim().toLowerCase();

    // 必须以 # 开头。
    if (input[0] !== '#') {
        return null;
    }

    let digits = input.slice(1);

    // 3 位简写按通道复制扩展为 6 位。
    if (digits.length === 3) {
        digits = digits[0] + digits[0] + digits[1] + digits[1] + digits[2] + digits[2];
    } else if (digits.length !== 6) {
        // 仅支持 3 位与 6 位 Hex。
        return null;
    }

    // 校验全部为十六进制字符。
    if (!/^[0-9a-f]{6}$/.test(digits)) {
        return null;
    }

    return {
        r: parseInt(digits.slice(0, 2), 16),
        g: parseInt(digits.slice(2, 4), 16),
        b: parseInt(digits.slice(4, 6), 16),
    };
}