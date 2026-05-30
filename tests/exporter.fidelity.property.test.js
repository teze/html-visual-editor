// 属性测试：导出保真与可继续编辑（Property 22）
//
// 验证 src/exporter.js 的 cleanAndSerialize(doc) 在「剥离编辑器痕迹」的同时，
// 完整保留用户可见内容；并验证导出后经 src/inject.js 的
// injectInto(cleanHtml, buildEditorScript()) 重新注入脚本，可恢复可继续编辑
// 的状态（id="__htmledit__" 注入脚本恰好恢复一个）。
//
// 即：对任意经过若干次编辑的预览 DOM（含用户内容 + 注入脚本 + 编辑态样式），
//   1. cleanAndSerialize 产物中用户可见内容（已知元素/文本）被原样保留；
//   2. 产物中不含注入脚本（导出产物干净）；
//   3. 重新注入后，id="__htmledit__" 注入脚本恰好出现一次（恢复可继续编辑）；
//   4. 重新注入后用户可见内容仍被保留（整个往返保真）。
//
// 运行环境：vitest + jsdom。
//
// Validates: Requirements 10.1, 10.7

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';
import {
    cleanAndSerialize,
    INJECTED_SCRIPT_ID,
    SAVED_OUTLINE_ATTR,
} from '../src/exporter.js';
import {
    injectInto,
    buildEditorScript,
    countInjectedScripts,
} from '../src/inject.js';

// --- 生成器 -----------------------------------------------------------------

// 字母数字 token：避免 '<' / '>' / '&' / 引号等会被 HTML 序列化转义的字符，
// 从而可在序列化文本中直接子串断言其存在性。
const alnum = fc
    .string({
        minLength: 1,
        maxLength: 12
    })
    .map((s) => s.replace(/[^0-9a-zA-Z]/g, ''))
    .filter((s) => s.length > 0);

// 用户内容标签（可承载文本）。
const userTag = fc.constantFrom('div', 'p', 'span', 'h1', 'h2', 'section', 'article', 'li');

// 是否给该用户元素施加编辑态样式（模拟「曾被悬停/选中」的元素）。
const userElementSpec = fc.record({
    tag: userTag,
    token: alnum,
    edited: fc.boolean(),
    original: fc.constantFrom('', '', '1px dashed red', 'thin solid black'),
    editor: fc.constantFrom('2px solid #00d4aa', '2px solid rgba(0, 212, 170, 0.35)'),
});

const editedDocSpec = fc.record({
    // 至少 1 个用户元素，保证有可断言的用户可见内容。
    users: fc.array(userElementSpec, {
        minLength: 1,
        maxLength: 6
    }),
    numScripts: fc.integer({
        min: 1,
        max: 2
    }),
});

// 为数组内每个用户元素生成「文档内唯一」的 token（带索引前缀），便于精确断言。
function withUniqueTokens(users) {
    return users.map((u, i) => ({
        ...u,
        token: 'USERTOKEN' + i + '_' + u.token,
    }));
}

// 构造一个「经过若干次编辑」的独立预览文档。
function buildEditedDoc(users) {
    const doc = document.implementation.createHTMLDocument('fidelity-test');

    for (const u of users) {
        const el = doc.createElement(u.tag);
        el.textContent = u.token; // 用户可见文本（唯一 token）
        el.setAttribute('data-user', u.token); // 额外的用户可见属性
        if (u.edited) {
            // 模拟编辑器施加编辑态 outline：先保存原始 outline，再覆盖编辑态样式。
            el.setAttribute(SAVED_OUTLINE_ATTR, u.original);
            el.style.setProperty('outline', u.editor);
            el.style.setProperty('outline-offset', '1px');
            el.style.setProperty('cursor', 'pointer');
        }
        doc.body.appendChild(el);
    }

    return doc;
}

// --- 属性 -------------------------------------------------------------------

describe('Property 22: 导出保真与可继续编辑 (src/exporter.js)', () => {
    // Feature: html-visual-editor, Property 22: 导出保真与可继续编辑
    it('导出后用户可见内容被保留，且重注入后 id="__htmledit__" 注入脚本恰好恢复一个', () => {
        fc.assert(
            fc.property(editedDocSpec, (spec) => {
                const users = withUniqueTokens(spec.users);
                const doc = buildEditedDoc(users);

                // 注入脚本，模拟「编辑状态」。
                for (let i = 0; i < spec.numScripts; i++) {
                    const script = doc.createElement('script');
                    script.id = INJECTED_SCRIPT_ID;
                    script.textContent = '(function(){/* injected ' + i + ' */})()';
                    doc.body.appendChild(script);
                }

                // 导出：清理 + 序列化。
                const cleanHtml = cleanAndSerialize(doc);

                // 1) 用户可见内容（每个唯一 token 与 data-user 属性）被保留。
                for (const u of users) {
                    expect(cleanHtml).toContain(u.token);
                    expect(cleanHtml).toContain('data-user="' + u.token + '"');
                }

                // 2) 导出产物干净：不含注入脚本。
                expect(countInjectedScripts(cleanHtml)).toBe(0);
                expect(cleanHtml).not.toContain(INJECTED_SCRIPT_ID);

                // 3) 重注入脚本，恢复可继续编辑：注入脚本恰好一个。
                const reinjected = injectInto(cleanHtml, buildEditorScript());
                expect(countInjectedScripts(reinjected)).toBe(1);

                // 4) 整个往返保真：重注入后用户可见内容仍被保留。
                for (const u of users) {
                    expect(reinjected).toContain(u.token);
                    expect(reinjected).toContain('data-user="' + u.token + '"');
                }
            }), {
                numRuns: 200
            }
        );
    });
});