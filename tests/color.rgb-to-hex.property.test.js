// Feature: html-visual-editor, Property 2: RGB 到 Hex 转换正确性
//
// 对任意 rgb(r, g, b)（r、g、b 均为 0..255 整数）颜色字符串，rgbToHex 应输出匹配
// /^#[0-9a-f]{6}$/ 的 6 位小写 Hex，且解析回的每个通道整数等于原始 r、g、b。
//
// Validates: Requirements 6.2

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';
import {
    rgbToHex,
    hexToRgb
} from '../src/color.js';

const channel = fc.integer({
    min: 0,
    max: 255
});
const hex6Pattern = /^#[0-9a-f]{6}$/;

describe('Property 2: RGB 到 Hex 转换正确性', () => {
    it('rgb(r,g,b) → 6 位小写 hex 且解析回原通道', () => {
        fc.assert(
            fc.property(channel, channel, channel, (r, g, b) => {
                const hex = rgbToHex(`rgb(${r}, ${g}, ${b})`);

                // 输出必须为 6 位小写 hex。
                expect(hex).toMatch(hex6Pattern);

                // 解析回的通道应等于原始值。
                const rgb = hexToRgb(hex);
                expect(rgb).not.toBeNull();
                expect(rgb.r).toBe(r);
                expect(rgb.g).toBe(g);
                expect(rgb.b).toBe(b);
            }), {
                numRuns: 200
            }
        );
    });

    it('覆盖通道为 0 与 255 的极值', () => {
        const cases = [
            [0, 0, 0],
            [255, 255, 255],
            [0, 255, 0],
            [255, 0, 255],
            [0, 0, 255],
            [255, 128, 0],
        ];
        for (const [r, g, b] of cases) {
            const hex = rgbToHex(`rgb(${r}, ${g}, ${b})`);
            expect(hex).toMatch(hex6Pattern);
            expect(hexToRgb(hex)).toEqual({
                r,
                g,
                b
            });
        }
    });
});