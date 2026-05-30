// 任务 4.2：字体粗细与对齐枚举逐值单元测试
//
// 对 6 个字体粗细枚举值 {300,400,500,600,700,900}（数字与字符串两种输入）逐一断言通过，
// 对 3 个文字对齐枚举值 {left,center,right} 逐一断言通过，并验证非枚举值被拒绝。
// _Requirements: 5.3, 5.6_

import {
    describe,
    it,
    expect
} from 'vitest';
import {
    validateFontWeight,
    validateTextAlign,
    FONT_WEIGHTS,
    TEXT_ALIGNS,
} from '../src/input-validation.js';

describe('validateFontWeight（字体粗细枚举逐值）', () => {
    // Requirements: 5.3
    const validWeights = [300, 400, 500, 600, 700, 900];

    it('导出的 FONT_WEIGHTS 常量恰好为 6 个合法值', () => {
        expect(FONT_WEIGHTS).toEqual(['300', '400', '500', '600', '700', '900']);
    });

    it.each(validWeights)('数字输入 %d 通过校验并规范化为字符串', (weight) => {
        const result = validateFontWeight(weight);
        expect(result.ok).toBe(true);
        expect(result.value).toBe(String(weight));
    });

    it.each(validWeights.map(String))('字符串输入 "%s" 通过校验', (weight) => {
        const result = validateFontWeight(weight);
        expect(result.ok).toBe(true);
        expect(result.value).toBe(weight);
    });

    it.each([100, 200, 800, 'bold', '', 'abc'])(
        '非枚举值 %p 被拒绝',
        (value) => {
            expect(validateFontWeight(value).ok).toBe(false);
        }
    );

    it('非数字/字符串类型（null/undefined/对象）被拒绝', () => {
        expect(validateFontWeight(null).ok).toBe(false);
        expect(validateFontWeight(undefined).ok).toBe(false);
        expect(validateFontWeight({}).ok).toBe(false);
    });
});

describe('validateTextAlign（文字对齐枚举逐值）', () => {
    // Requirements: 5.6
    const validAligns = ['left', 'center', 'right'];

    it('导出的 TEXT_ALIGNS 常量恰好为 3 个合法值', () => {
        expect(TEXT_ALIGNS).toEqual(['left', 'center', 'right']);
    });

    it.each(validAligns)('对齐值 "%s" 通过校验', (align) => {
        const result = validateTextAlign(align);
        expect(result.ok).toBe(true);
        expect(result.value).toBe(align);
    });

    it.each(['justify', 'top', ''])('非枚举值 %p 被拒绝', (value) => {
        expect(validateTextAlign(value).ok).toBe(false);
    });

    it('非字符串类型（数字/null/undefined）被拒绝', () => {
        expect(validateTextAlign(0).ok).toBe(false);
        expect(validateTextAlign(null).ok).toBe(false);
        expect(validateTextAlign(undefined).ok).toBe(false);
    });
});