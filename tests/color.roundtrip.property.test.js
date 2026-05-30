// Feature: html-visual-editor, Property 1: Hex 颜色往返一致性
//
// 对任意合法的 Hex_Color 值（3 位 #rgb 或 6 位 #rrggbb），先 hexToRgb 转换为
// RGB 整数三元组、再 rgbToHex 转换回 Hex_Color，所得颜色的 R、G、B 三个通道整数值
// 应与原 Hex（3 位按通道复制扩展，如 #abc ≡ #aabbcc）的对应通道整数值相等。
//
// Validates: Requirements 6.5

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';
import {
    hexToRgb,
    rgbToHex
} from '../src/color.js';

// 随机十六进制字符（含大小写，验证规范化为小写）。
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

describe('Property 1: Hex 颜色往返一致性', () => {
    it('hexToRgb → rgbToHex 保持 R/G/B 三通道整数一致', () => {
        fc.assert(
            fc.property(anyValidHex, (hex) => {
                const rgb = hexToRgb(hex);
                // 生成器只产出合法 hex，解析必然成功。
                expect(rgb).not.toBeNull();

                const roundHex = rgbToHex(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
                const rgb2 = hexToRgb(roundHex);
                expect(rgb2).not.toBeNull();

                // 往返后三通道整数值应与原始解析一致。
                expect(rgb2.r).toBe(rgb.r);
                expect(rgb2.g).toBe(rgb.g);
                expect(rgb2.b).toBe(rgb.b);
            }), {
                numRuns: 200
            }
        );
    });

    it('覆盖通道为 0 与 255 的极值与 3 位简写扩展', () => {
        const cases = [
            '#000000',
            '#ffffff',
            '#FF0000',
            '#00ff00',
            '#0000FF',
            '#000',
            '#fff',
            '#abc', // ≡ #aabbcc
            '#ABC',
        ];
        for (const hex of cases) {
            const rgb = hexToRgb(hex);
            expect(rgb).not.toBeNull();
            const roundHex = rgbToHex(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
            const rgb2 = hexToRgb(roundHex);
            expect(rgb2).toEqual(rgb);
        }

        // #abc 必须等价于 #aabbcc。
        expect(hexToRgb('#abc')).toEqual(hexToRgb('#aabbcc'));
    });
});