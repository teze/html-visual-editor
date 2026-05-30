// 颜色转换：解析失败、透明特殊值与 hex 边界（单元测试）
//
// 覆盖 design.md「颜色模型与转换」与 Error Handling 的失败/特例分支：
//   - 非 rgb/rgba 输入返回失败标记 null（调用方据此显示"解析失败"提示）。
//   - rgba(0,0,0,0) 与 "transparent" 映射为空串 ""（无背景色）。
//   - hexToRgb 对非法 hex（长度错误、非十六进制字符）返回 null。
//
// Requirements: 6.1, 6.4

import {
    describe,
    it,
    expect
} from 'vitest';
import {
    rgbToHex,
    hexToRgb
} from '../src/color.js';

describe('rgbToHex 解析失败返回 null（可识别失败标记）', () => {
    it('非 rgb/rgba 字符串返回 null', () => {
        const invalid = [
            'red',
            '#ff0000',
            'hsl(0, 100%, 50%)',
            'rgb(255, 0)', // 通道不足
            'rgb()',
            'not a color',
            '',
            '   ',
        ];
        for (const v of invalid) {
            expect(rgbToHex(v)).toBeNull();
        }
    });

    it('通道越界（>255）返回 null', () => {
        expect(rgbToHex('rgb(256, 0, 0)')).toBeNull();
        expect(rgbToHex('rgb(0, 999, 0)')).toBeNull();
    });

    it('alpha 越界返回 null', () => {
        expect(rgbToHex('rgba(0, 0, 0, 2)')).toBeNull();
        expect(rgbToHex('rgba(0, 0, 0, -0.5)')).toBeNull();
    });

    it('非字符串输入返回 null', () => {
        expect(rgbToHex(null)).toBeNull();
        expect(rgbToHex(undefined)).toBeNull();
        expect(rgbToHex(123)).toBeNull();
    });
});

describe('透明特殊值映射为空串', () => {
    it('rgba(0,0,0,0) → ""', () => {
        expect(rgbToHex('rgba(0, 0, 0, 0)')).toBe('');
    });

    it('"transparent" → ""（大小写不敏感）', () => {
        expect(rgbToHex('transparent')).toBe('');
        expect(rgbToHex('TRANSPARENT')).toBe('');
        expect(rgbToHex('  transparent  ')).toBe('');
    });
});

describe('hexToRgb 非法输入返回 null', () => {
    it('长度错误返回 null', () => {
        expect(hexToRgb('#')).toBeNull();
        expect(hexToRgb('#12')).toBeNull();
        expect(hexToRgb('#1234')).toBeNull();
        expect(hexToRgb('#12345')).toBeNull();
        expect(hexToRgb('#1234567')).toBeNull();
        expect(hexToRgb('#12345678')).toBeNull(); // 8 位不被 hexToRgb 支持
    });

    it('非十六进制字符返回 null', () => {
        expect(hexToRgb('#gggggg')).toBeNull();
        expect(hexToRgb('#xyz')).toBeNull();
        expect(hexToRgb('#12g456')).toBeNull();
    });

    it('缺少 # 前缀返回 null', () => {
        expect(hexToRgb('abcdef')).toBeNull();
        expect(hexToRgb('fff')).toBeNull();
    });

    it('非字符串输入返回 null', () => {
        expect(hexToRgb(null)).toBeNull();
        expect(hexToRgb(undefined)).toBeNull();
        expect(hexToRgb(123456)).toBeNull();
    });
});