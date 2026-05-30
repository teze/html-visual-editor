// tests/file-validation.validate.property.test.js
// Property test for validateFile (Property 5).
//
// Feature: html-visual-editor, Property 5: 文件类型与大小校验

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';

import {
    validateFile,
    MAX_FILE_SIZE
} from '../src/file-validation.js';

// 合法 HTML 扩展名判定（与被测实现一致），用于在测试侧独立推导期望结果，
// 避免直接复用实现的判定逻辑造成「自证」。
const HTML_EXT_RE = /\.html?$/i;

// 生成各类扩展名：合法（.html/.htm，含大小写混合）与非法（.txt/.png/无扩展名 等）。
const extensionArb = fc.constantFrom(
    '.html',
    '.htm',
    '.HTML', // 大写：仍合法（大小写不敏感）
    '.Htm', // 混合大小写：仍合法
    '.txt',
    '.png',
    '.htmlx', // 仅以 html 开头但非结尾：非法
    '.xhtml', // 以 html 结尾但前面不是 . ：/\.html?$/ 不匹配 → 非法
    '', // 无扩展名
);

// 随机文件名主干（可能为空、含点、含 Unicode）。
const baseNameArb = fc.string({
    minLength: 0,
    maxLength: 20
});

// 文件名 = 主干 + 扩展名。
const fileNameArb = fc
    .tuple(baseNameArb, extensionArb)
    .map(([base, ext]) => `${base}${ext}`);

// 大小生成：覆盖阈值两侧（0 到 max 附近、远超 max），并显式注入边界值
// 10485760（通过）与 10485761（拒绝）。
const sizeArb = fc.oneof(
    fc.integer({
        min: 0,
        max: MAX_FILE_SIZE * 2
    }),
    fc.constantFrom(
        0,
        1,
        MAX_FILE_SIZE - 1,
        MAX_FILE_SIZE, // 边界：通过
        MAX_FILE_SIZE + 1, // 边界：拒绝
        MAX_FILE_SIZE * 2,
    ),
);

describe('validateFile — Property 5: 文件类型与大小校验', () => {
    // Feature: html-visual-editor, Property 5: 文件类型与大小校验
    // 对任意文件名与大小组合，validateFile 当且仅当「扩展名匹配 .html/.htm」
    // 且「大小 <= 10485760」时返回通过；否则返回拒绝并给出对应错误类别。
    // 实现优先做类型判定，因此：扩展名非法 → 'unsupported_type'（无论大小），
    // 否则 size > max → 'too_large'，否则通过。
    it('returns ok iff valid extension AND size <= max, with type check prioritized', () => {
        fc.assert(
            fc.property(fileNameArb, sizeArb, (name, size) => {
                const result = validateFile(name, size);
                const extValid = HTML_EXT_RE.test(name);
                const sizeValid = size <= MAX_FILE_SIZE;

                if (!extValid) {
                    // 类型检查优先：扩展名非法时，无论大小都应是 unsupported_type。
                    expect(result).toEqual({
                        ok: false,
                        reason: 'unsupported_type'
                    });
                } else if (!sizeValid) {
                    expect(result).toEqual({
                        ok: false,
                        reason: 'too_large'
                    });
                } else {
                    expect(result).toEqual({
                        ok: true
                    });
                }

                // 充要条件：ok === true 当且仅当 扩展名合法 且 大小未超限。
                expect(result.ok).toBe(extValid && sizeValid);
            }), {
                numRuns: 300
            },
        );
    });

    it('covers the size boundary explicitly: 10485760 passes, 10485761 fails', () => {
        expect(validateFile('page.html', MAX_FILE_SIZE)).toEqual({
            ok: true
        });
        expect(validateFile('page.html', MAX_FILE_SIZE + 1)).toEqual({
            ok: false,
            reason: 'too_large',
        });
    });

    it('rejects unsupported extensions regardless of size (type check prioritized)', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('notes.txt', 'image.png', 'archive', 'photo.jpeg'),
                fc.integer({
                    min: 0,
                    max: MAX_FILE_SIZE * 2
                }),
                (name, size) => {
                    expect(validateFile(name, size)).toEqual({
                        ok: false,
                        reason: 'unsupported_type',
                    });
                },
            ), {
                numRuns: 100
            },
        );
    });
});