// 属性测试：getInfo 结构完整性（Property 8）
//
// 验证 src/injected-script.js 的 getInfo(el)：对任意「可编辑元素」，返回的
// SelectedElementInfo 应包含全部约定字段，且：
//   - color / backgroundColor 为合法 Hex（#rrggbb / #rrggbbaa）或空串；
//   - fontSize 为整数；
//   - tag 为大写标签名。
//
// 运行环境：vitest + jsdom（全局 document 可用）。元素必须 append 到
// document.body 后 getComputedStyle 才能产出 computed 值，故每轮构造→断言→清理。

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';
import {
    getInfo,
    isEditable,
} from '../src/injected-script.js';

// --- 约定字段 ---------------------------------------------------------------

// SelectedElementInfo 的全部约定字段（设计 Data Models / Property 8）。
const EXPECTED_KEYS = [
    'tag',
    'innerText',
    'color',
    'backgroundColor',
    'fontSize',
    'fontWeight',
    'width',
    'height',
    'src',
    'href',
    'inlineStyle',
    'path',
];

// 合法 Hex（6 位 #rrggbb 或 8 位 #rrggbbaa，小写）或空串。
const HEX_OR_EMPTY = /^#([0-9a-f]{6}|[0-9a-f]{8})$/;

function isHexOrEmpty(value) {
    return value === '' || HEX_OR_EMPTY.test(value);
}

// --- 生成器 -----------------------------------------------------------------

// 可编辑标签（均不在 SKIP 集合中）。混合文字类、img、链接、按钮、容器。
const editableTag = fc.constantFrom(
    'DIV',
    'P',
    'SPAN',
    'H1',
    'H2',
    'H3',
    'A',
    'IMG',
    'BUTTON',
    'SECTION',
    'ARTICLE',
    'LABEL',
    'STRONG',
    'EM',
    'UL',
    'LI'
);

// 安全文本：去除 '<' / '>'，避免随机文本被当成 markup。
const safeText = fc.string({
    maxLength: 60
}).map((s) => s.replace(/[<>]/g, ''));

// 颜色值：rgb()/rgba()（更可能被 rgbToHex 转换）与 hex 字面量混合。
// 无论 jsdom 的 getComputedStyle 是否转换，结果都应为「合法 Hex 或空串」。
const channel = fc.integer({
    min: 0,
    max: 255
});
const colorValue = fc.oneof(
    fc.tuple(channel, channel, channel).map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`),
    fc
    .tuple(channel, channel, channel, fc.float({
        min: 0,
        max: 1,
        noNaN: true
    }))
    .map(([r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`),
    fc.constantFrom('#ff0000', '#00ff00', '#0000ff', '#123456', 'transparent')
);

// 尺寸值：px 或 %。
const sizeValue = fc.oneof(
    fc.integer({
        min: 0,
        max: 1000
    }).map((n) => `${n}px`),
    fc.integer({
        min: 0,
        max: 100
    }).map((n) => `${n}%`)
);

// 安全 URL：用于 <a href> 与 <img src>，非空、不含尖括号。
const safeUrl = fc
    .string({
        minLength: 1,
        maxLength: 50
    })
    .map((s) => s.replace(/[<>\s]/g, ''))
    .filter((s) => s.length > 0);

// 元素规格：随机标签、文本、可选内联样式、链接/图片地址。
const elementSpec = fc.record({
    tag: editableTag,
    text: safeText,
    color: fc.option(colorValue, {
        nil: undefined
    }),
    backgroundColor: fc.option(colorValue, {
        nil: undefined
    }),
    fontSize: fc.option(fc.integer({
        min: 1,
        max: 200
    }), {
        nil: undefined
    }),
    width: fc.option(sizeValue, {
        nil: undefined
    }),
    height: fc.option(sizeValue, {
        nil: undefined
    }),
    href: safeUrl,
    src: safeUrl,
});

// 依据规格构造真实 DOM 元素（已 append 到 document.body）。
function buildElement(spec) {
    const el = document.createElement(spec.tag);

    if (spec.text) {
        el.textContent = spec.text;
    }

    const styleParts = [];
    if (spec.color !== undefined) {
        styleParts.push(`color: ${spec.color}`);
    }
    if (spec.backgroundColor !== undefined) {
        styleParts.push(`background-color: ${spec.backgroundColor}`);
    }
    if (spec.fontSize !== undefined) {
        styleParts.push(`font-size: ${spec.fontSize}px`);
    }
    if (spec.width !== undefined) {
        styleParts.push(`width: ${spec.width}`);
    }
    if (spec.height !== undefined) {
        styleParts.push(`height: ${spec.height}`);
    }
    if (styleParts.length > 0) {
        el.setAttribute('style', styleParts.join('; '));
    }

    if (spec.tag === 'A') {
        el.setAttribute('href', spec.href);
    }
    if (spec.tag === 'IMG') {
        el.setAttribute('src', spec.src);
    }

    document.body.appendChild(el);
    return el;
}

// --- 属性 -------------------------------------------------------------------

describe('Property 8: getInfo 结构完整性 (src/injected-script.js)', () => {
    // Feature: html-visual-editor, Property 8: getInfo 结构完整性
    it('对任意可编辑元素，getInfo 返回全部约定字段，颜色为合法 Hex 或空串，fontSize 为整数', () => {
        fc.assert(
            fc.property(elementSpec, (spec) => {
                const el = buildElement(spec);
                try {
                    // 前置条件：构造的元素确实可编辑（标签不在 SKIP 中）。
                    expect(isEditable(el)).toBe(true);

                    const info = getInfo(el);

                    // 1) 结构完整性：全部约定字段存在。
                    for (const key of EXPECTED_KEYS) {
                        expect(info).toHaveProperty(key);
                    }

                    // 2) 颜色字段为合法 Hex 或空串。
                    expect(isHexOrEmpty(info.color)).toBe(true);
                    expect(isHexOrEmpty(info.backgroundColor)).toBe(true);

                    // 3) fontSize 为整数。
                    expect(Number.isInteger(info.fontSize)).toBe(true);

                    // 4) tag 为大写标签名。
                    expect(info.tag).toBe(spec.tag.toUpperCase());
                    expect(info.tag).toMatch(/^[A-Z0-9]+$/);
                } finally {
                    // 清理 DOM，保证各轮之间相互隔离。
                    document.body.removeChild(el);
                }
            }), {
                numRuns: 200
            }
        );
    });
});