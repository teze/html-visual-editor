// Feature: html-visual-editor, Property 3: RGBA 到 Hex8 转换正确性
//
// 对任意 rgba(r, g, b, a)（r、g、b 为 0..255 整数，a 为 0..1，且 a<1）颜色字符串，
// rgbToHex 应输出 8 位 #rrggbbaa，其中前 6 位与对应 rgb(r,g,b) 一致，末两位 aa
// 等于 Math.round(a*255) 的两位十六进制表示。
//
// 注意：rgba(0,0,0,0) 依实现映射为空串（"无背景色"），该全零+alpha=0 的特例单独断言。
//
// Validates: Requirements 6.3

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';
import {
    rgbToHex
} from '../src/color.js';

const channel = fc.integer({
    min: 0,
    max: 255
});

// alpha ∈ [0, 1) 且十进制字符串无科学计数法（避免正则匹配失败）。
// n/1000 对 0..999 的整数恒为最多 3 位小数的常规十进制表示。
const alphaLessThanOne = fc.integer({
    min: 0,
    max: 999
}).map((n) => n / 1000);

function toHexByte(n) {
    return n.toString(16).padStart(2, '0');
}

describe('Property 3: RGBA 到 Hex8 转换正确性', () => {
    it('rgba(r,g,b,a<1) → 8 位 #rrggbbaa，前 6 位为 rgb，末两位为 round(a*255)', () => {
        fc.assert(
            fc.property(channel, channel, channel, alphaLessThanOne, (r, g, b, a) => {
                const hex = rgbToHex(`rgba(${r}, ${g}, ${b}, ${a})`);

                // 全零通道 + alpha 恰为 0 是"无背景色"特例，映射为空串。
                if (r === 0 && g === 0 && b === 0 && a === 0) {
                    expect(hex).toBe('');
                    return;
                }

                // 其余情况：必为 8 位小写 hex。
                expect(hex).toMatch(/^#[0-9a-f]{8}$/);

                const base = rgbToHex(`rgb(${r}, ${g}, ${b})`);
                const expectedAlpha = toHexByte(Math.round(a * 255));

                // 前 6 位与 rgb(r,g,b) 一致。
                expect(hex.slice(0, 7)).toBe(base);
                // 末两位为 round(a*255) 的两位十六进制。
                expect(hex.slice(7)).toBe(expectedAlpha);
            }), {
                numRuns: 200
            }
        );
    });

    it('覆盖通道为 0 与 255 的极值（alpha<1）', () => {
        // [r, g, b, a]
        const cases = [
            [0, 0, 0, 0.5],
            [255, 255, 255, 0.5],
            [0, 255, 0, 0.25],
            [255, 0, 255, 0.75],
            [0, 0, 0, 0.004], // round(0.004*255)=1 → "01"，非全透明特例
            [255, 255, 255, 0.999],
        ];
        for (const [r, g, b, a] of cases) {
            const hex = rgbToHex(`rgba(${r}, ${g}, ${b}, ${a})`);
            expect(hex).toMatch(/^#[0-9a-f]{8}$/);
            const base = rgbToHex(`rgb(${r}, ${g}, ${b})`);
            expect(hex.slice(0, 7)).toBe(base);
            expect(hex.slice(7)).toBe(toHexByte(Math.round(a * 255)));
        }

        // 全零 + alpha=0 的特例：映射为空串。
        expect(rgbToHex('rgba(0, 0, 0, 0)')).toBe('');
    });
});