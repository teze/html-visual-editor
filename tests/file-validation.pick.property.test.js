// tests/file-validation.pick.property.test.js
// Property test for pickFirstHtml (Property 6).
//
// Feature: html-visual-editor, Property 6: 多文件择一加载

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';

import {
    pickFirstHtml
} from '../src/file-validation.js';

// 合法 HTML 扩展名判定（与被测实现一致），用于在测试侧独立推导期望结果。
const HTML_EXT_RE = /\.html?$/i;

// 合法 HTML 文件名（.html / .htm，含大小写变体）。
const htmlFileArb = fc
    .tuple(
        fc.string({
            minLength: 0,
            maxLength: 12
        }),
        fc.constantFrom('.html', '.htm', '.HTML', '.Htm'),
    )
    .map(([base, ext]) => ({
        name: `${base}${ext}`,
        size: 100
    }));

// 非 HTML 文件名（其它扩展名 / 无扩展名 / 近似但不匹配的扩展名）。
const nonHtmlFileArb = fc
    .tuple(
        fc.string({
            minLength: 0,
            maxLength: 12
        }),
        fc.constantFrom('.txt', '.png', '.jpeg', '.htmlx', '.xhtml', ''),
    )
    .map(([base, ext]) => ({
        name: `${base}${ext}`,
        size: 100
    }));

// 任意单个文件（HTML 或非 HTML）。
const anyFileArb = fc.oneof(htmlFileArb, nonHtmlFileArb);

describe('pickFirstHtml — Property 6: 多文件择一加载', () => {
    // Feature: html-visual-editor, Property 6: 多文件择一加载
    // 对任意文件列表，pickFirstHtml 返回首个 .html/.htm 文件；若除该文件外
    // 列表中还存在其他文件，则 ignoredOthers 为 true；无匹配时返回 { file: null }。
    it('returns the first html file and flags ignoredOthers when other files exist', () => {
        fc.assert(
            fc.property(fc.array(anyFileArb, {
                maxLength: 12
            }), (files) => {
                const result = pickFirstHtml(files);

                // 测试侧独立推导期望的首个匹配文件。
                const expectedFirst = files.find((f) => f && HTML_EXT_RE.test(f.name));

                if (!expectedFirst) {
                    expect(result).toEqual({
                        file: null
                    });
                } else {
                    // 返回的就是第一个按扩展名匹配的文件（同一引用）。
                    expect(result.file).toBe(expectedFirst);
                    // 除选中文件外还存在其他文件 ⇔ 列表长度 > 1。
                    expect(result.ignoredOthers).toBe(files.length > 1);
                }
            }), {
                numRuns: 300
            },
        );
    });

    it('always picks the FIRST matching html file even with leading/trailing non-html files', () => {
        fc.assert(
            fc.property(
                fc.array(nonHtmlFileArb, {
                    maxLength: 5
                }),
                htmlFileArb,
                fc.array(anyFileArb, {
                    maxLength: 5
                }),
                (leadingNonHtml, firstHtml, trailing) => {
                    // 构造：[非HTML...] + [首个HTML] + [任意...]
                    // 首个 HTML 一定是整个列表中第一个匹配的 HTML 文件。
                    const files = [...leadingNonHtml, firstHtml, ...trailing];
                    const result = pickFirstHtml(files);

                    expect(result.file).toBe(firstHtml);
                    expect(result.ignoredOthers).toBe(files.length > 1);
                },
            ), {
                numRuns: 200
            },
        );
    });

    it('returns { file: null } when no html file is present', () => {
        fc.assert(
            fc.property(fc.array(nonHtmlFileArb, {
                maxLength: 12
            }), (files) => {
                expect(pickFirstHtml(files)).toEqual({
                    file: null
                });
            }), {
                numRuns: 100
            },
        );
    });
});