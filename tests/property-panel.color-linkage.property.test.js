// 属性测试：颜色控件双向联动往返（Property 4）
//
// 对任意合法 Hex_Color（3 位 #rgb 或 6 位 #rrggbb，大小写不限），在 Hex 文本框中
// 输入后同步到颜色选择器（onColorType），再由颜色选择器同步回 Hex 文本框
// （onColorPick），最终两个控件表示的颜色应一致：
//   - 文本框为规范化的 6 位小写 #rrggbb（以 normalizeHex 为预言/oracle）
//   - 选择器值与文本框值相等
//
// Feature: html-visual-editor, Property 4: 颜色控件双向联动往返
//
// Validates: Requirements 5.11, 5.12

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';
import {
    createPanelFragment,
    onColorPick,
    onColorType,
    normalizeHex
} from '../src/property-panel.js';

// --- 生成器 -----------------------------------------------------------------

// 任意大小写十六进制位。
const hexDigit = fc.constantFrom(...'0123456789abcdefABCDEF'.split(''));

// 6 位 #rrggbb（大小写混合）。
const hex6 = fc
    .tuple(hexDigit, hexDigit, hexDigit, hexDigit, hexDigit, hexDigit)
    .map((d) => '#' + d.join(''));

// 3 位 #rgb（大小写混合）。
const hex3 = fc
    .tuple(hexDigit, hexDigit, hexDigit)
    .map((d) => '#' + d.join(''));

const anyValidHex = fc.oneof(hex6, hex3);

// 待验证的颜色控件对（文字色 / 背景色）。
const pairArb = fc.constantFrom({
    picker: 'pColor',
    text: 'pColorTxt',
    prop: 'color'
}, {
    picker: 'pBg',
    text: 'pBgTxt',
    prop: 'backgroundColor'
}, );

// --- 属性 -------------------------------------------------------------------

describe('Property 4: 颜色控件双向联动往返 (src/property-panel.js)', () => {
    // Feature: html-visual-editor, Property 4: 颜色控件双向联动往返
    it('输入框 →(onColorType) 选择器 →(onColorPick) 输入框，两控件收敛为同一 6 位小写 Hex', () => {
        fc.assert(
            fc.property(anyValidHex, pairArb, (hex, pair) => {
                const root = createPanelFragment(document);
                const textEl = root.querySelector('#' + pair.text);
                const pickerEl = root.querySelector('#' + pair.picker);

                // 预言：规范化后的 6 位小写 #rrggbb。
                const expected = normalizeHex(hex);
                expect(expected).toMatch(/^#[0-9a-f]{6}$/);

                // 1) 在 Hex 文本框输入原始 hex。
                textEl.value = hex;

                // 2) 文本框 → 选择器。
                const typed = onColorType(pair.text, pair.picker, pair.prop, root);
                expect(typed).toBe(expected);
                expect(pickerEl.value).toBe(expected);

                // 3) 选择器 → 文本框。
                const picked = onColorPick(pair.picker, pair.text, pair.prop, root);
                expect(picked).toBe(expected);
                expect(textEl.value).toBe(expected);

                // 往返终态：两控件相等且为规范化 6 位小写 Hex。
                expect(textEl.value).toBe(pickerEl.value);
                expect(textEl.value).toBe(expected);
            }), {
                numRuns: 200
            }
        );
    });
});