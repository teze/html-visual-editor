// tests/change-counter.text.property.test.js
// 属性测试：状态栏计数文本（Property 20）
//
// 验证 src/change-counter.js 的 formatCountText：对任意 0..999999 范围内的
// 整数 N，渲染为精确的 "N 处修改" 文本（需求 11.3）。
//
// Feature: html-visual-editor, Property 20: 状态栏计数文本

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';

import {
    formatCountText,
    MAX_CHANGE_COUNT,
} from '../src/change-counter.js';

// --- 属性 -------------------------------------------------------------------

describe('Property 20: 状态栏计数文本 (src/change-counter.js)', () => {
    // Feature: html-visual-editor, Property 20: 状态栏计数文本
    // 对任意 0..999999 范围内的整数 N，formatCountText(N) 应渲染为 "N 处修改"。
    it('对任意 0..999999 的整数 N，formatCountText(N) === "N 处修改"', () => {
        fc.assert(
            fc.property(
                fc.integer({
                    min: 0,
                    max: MAX_CHANGE_COUNT
                }),
                (n) => {
                    expect(formatCountText(n)).toBe(`${n} 处修改`);
                },
            ), {
                numRuns: 200
            },
        );
    });

    // Feature: html-visual-editor, Property 20: 状态栏计数文本
    // 显式覆盖边界值 0 与上限 999999。
    it('覆盖边界：0 → "0 处修改"，999999 → "999999 处修改"', () => {
        expect(formatCountText(0)).toBe('0 处修改');
        expect(formatCountText(MAX_CHANGE_COUNT)).toBe('999999 处修改');
    });
});