// input-validation.js — 属性面板输入校验（需求 5、7）
//
// 提供「校验 + 单位拼装」的纯函数：合法输入返回 { ok: true, value }（value 为
// 含单位的 CSS 值或规范化后的值），非法输入（空值/非数值/越界/格式错误）返回
// { ok: false }。这些函数被属性面板（任务 10.5）消费，并支撑设计文档中的
// Property 15（合法数值样式输入被应用）与 Property 16（非法输入被拒绝）。

// ---------------------------------------------------------------------------
// 枚举
// ---------------------------------------------------------------------------

// 字体粗细合法枚举。
export const FONT_WEIGHTS = ['300', '400', '500', '600', '700', '900'];
// 文字对齐合法枚举。
export const TEXT_ALIGNS = ['left', 'center', 'right'];
// 宽/高支持的单位。
export const LENGTH_UNITS = ['px', '%'];

// 各数值属性的取值范围（含上下界，均为整数）。
export const NUMBER_RANGES = {
    fontSize: {
        min: 1,
        max: 999
    },
    padding: {
        min: 0,
        max: 9999
    },
    borderRadius: {
        min: 0,
        max: 9999
    },
    // width/height 的范围取决于单位：px 0..99999，% 0..100。
    width: {
        px: {
            min: 0,
            max: 99999
        },
        '%': {
            min: 0,
            max: 100
        }
    },
    height: {
        px: {
            min: 0,
            max: 99999
        },
        '%': {
            min: 0,
            max: 100
        }
    },
};

// 地址（src/href）最大长度。
export const MAX_ADDRESS_LENGTH = 2048;

// 合法颜色：# 后接 3 或 6 位十六进制字符。
export const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

// 严格整数解析：接受 number 或 string。
// - number：必须是有限整数（拒绝 NaN/Infinity/小数）。
// - string：去除首尾空白后必须匹配 /^[+-]?\d+$/（拒绝小数、科学计数、含单位、空串）。
// 解析成功返回整数，失败返回 null。
function parseStrictInt(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!/^[+-]?\d+$/.test(trimmed)) return null;
        const n = Number.parseInt(trimmed, 10);
        return Number.isInteger(n) ? n : null;
    }
    return null;
}

// 在给定 [min, max]（含端点）内的整数校验。
function inRange(n, min, max) {
    return n >= min && n <= max;
}

// ---------------------------------------------------------------------------
// 数值校验（含单位拼装）
// ---------------------------------------------------------------------------

// 通用数值校验：kind 取 'fontSize'|'padding'|'borderRadius'|'width'|'height'。
// width/height 需提供 unit（'px' | '%'，默认 'px'）以确定取值范围与拼装单位；
// 其余 kind 固定使用 px。合法返回 { ok:true, value:'<n><unit>' }，否则 { ok:false }。
export function validateNumber(kind, value, unit = 'px') {
    const spec = NUMBER_RANGES[kind];
    if (!spec) return {
        ok: false
    };

    let range;
    let outUnit;
    if (kind === 'width' || kind === 'height') {
        if (!LENGTH_UNITS.includes(unit)) return {
            ok: false
        };
        range = spec[unit];
        outUnit = unit;
    } else {
        range = spec;
        outUnit = 'px';
    }

    const n = parseStrictInt(value);
    if (n === null) return {
        ok: false
    };
    if (!inRange(n, range.min, range.max)) return {
        ok: false
    };

    return {
        ok: true,
        value: `${n}${outUnit}`
    };
}

// 字体大小：1..999 整数（px）。
export function validateFontSize(value) {
    return validateNumber('fontSize', value);
}

// 内边距：0..9999 整数（px）。
export function validatePadding(value) {
    return validateNumber('padding', value);
}

// 圆角：0..9999 整数（px）。
export function validateBorderRadius(value) {
    return validateNumber('borderRadius', value);
}

// 宽度：px 0..99999 / % 0..100。
export function validateWidth(value, unit = 'px') {
    return validateNumber('width', value, unit);
}

// 高度：px 0..99999 / % 0..100。
export function validateHeight(value, unit = 'px') {
    return validateNumber('height', value, unit);
}

// ---------------------------------------------------------------------------
// 颜色校验
// ---------------------------------------------------------------------------

// 颜色：# 后接 3 或 6 位十六进制。合法返回 { ok:true, value:'#...' }（去首尾空白，
// 保留原大小写；规范化为 6 位小写在颜色转换/联动环节处理）。
export function validateColor(value) {
    if (typeof value !== 'string') return {
        ok: false
    };
    const trimmed = value.trim();
    if (!COLOR_PATTERN.test(trimmed)) return {
        ok: false
    };
    return {
        ok: true,
        value: trimmed
    };
}

// ---------------------------------------------------------------------------
// 地址校验（src / href）
// ---------------------------------------------------------------------------

// 地址：非空且长度 ≤ 2048 字符。纯空白视为空（非法）。
// 合法返回 { ok:true, value }（保留原始输入，按需由调用方决定是否裁剪）。
export function validateAddress(value) {
    if (typeof value !== 'string') return {
        ok: false
    };
    if (value.trim().length === 0) return {
        ok: false
    };
    if (value.length > MAX_ADDRESS_LENGTH) return {
        ok: false
    };
    return {
        ok: true,
        value
    };
}

// ---------------------------------------------------------------------------
// 枚举校验
// ---------------------------------------------------------------------------

// 字体粗细：必须为 {300,400,500,600,700,900} 之一（接受数字或字符串输入）。
export function validateFontWeight(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return {
        ok: false
    };
    const normalized = String(value).trim();
    if (!FONT_WEIGHTS.includes(normalized)) return {
        ok: false
    };
    return {
        ok: true,
        value: normalized
    };
}

// 文字对齐：必须为 {left,center,right} 之一。
export function validateTextAlign(value) {
    if (typeof value !== 'string') return {
        ok: false
    };
    const normalized = value.trim();
    if (!TEXT_ALIGNS.includes(normalized)) return {
        ok: false
    };
    return {
        ok: true,
        value: normalized
    };
}