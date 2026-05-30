// 属性测试：导出产物干净性（Property 21）
//
// 验证 src/exporter.js 的 cleanAndSerialize(doc)：对任意「处于编辑状态」的
// 预览 DOM —— 即含一个或多个 id="__htmledit__" 注入脚本，且若干元素带有
// data-saved-outline 标记并被施加了编辑态 outline / outline-offset / cursor
// 内联样式 —— 清理并序列化后产出的 HTML 文本中：
//   1. 不含 id="__htmledit__" 注入脚本（脚本节点被移除）；
//   2. 不含 data-saved-outline 标记属性（标记被清除）；
//   3. 不含编辑器添加的 outline-offset / cursor 编辑态内联样式；
//   4. 不含编辑器添加的选中/悬停 outline 颜色（#00d4aa / rgba(0,212,170,...)）。
//
// 运行环境：vitest + jsdom。每轮新建独立文档（document.implementation
// .createHTMLDocument），随机构造编辑态 DOM，序列化后断言其干净性。
//
// Validates: Requirements 10.3, 10.4, 10.5

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

// --- 生成器 -----------------------------------------------------------------

// 安全文本：去除 '<' / '>' 与引号，避免随机文本构成标签或破坏属性。
const safeText = fc
    .string({
        minLength: 0,
        maxLength: 30
    })
    .map((s) => s.replace(/[<>"']/g, ''));

// 可承载编辑态 outline 的普通标签。
const elementTag = fc.constantFrom(
    'div',
    'p',
    'span',
    'h1',
    'h2',
    'section',
    'article',
    'a',
    'button',
    'li'
);

// 编辑器添加的两类编辑态 outline：选中边框（#00d4aa）与悬停高亮（rgba(0,212,170,0.35)）。
const editorOutline = fc.constantFrom(
    '2px solid #00d4aa',
    '2px solid rgba(0, 212, 170, 0.35)'
);

// 元素「原始」内联 outline（在被编辑器覆盖前的值）。空串表示原本没有内联 outline。
const originalOutline = fc.constantFrom(
    '',
    '',
    '1px dashed red',
    '3px double #abcabc',
    'thin solid black'
);

// 一个带 data-saved-outline 标记、被施加编辑态样式的元素规格。
const savedOutlineElementSpec = fc.record({
    tag: elementTag,
    text: safeText,
    original: originalOutline,
    editor: editorOutline,
});

// 不含 __htmledit__ 与 data-saved-outline 的良性用户 markup 片段，
// 用作随机周边内容（不应被清理逻辑触及）。
const plainMarkup = fc.constantFrom(
    '<div class="box"><span>plain</span></div>',
    '<p>普通段落</p>',
    '<ul><li>一</li><li>二</li></ul>',
    '<img src="pic.png" alt="x">',
    '<a href="https://example.com">链接</a>',
    '<header><nav>菜单</nav></header>',
    '<!-- a comment -->',
    '<style>.c{color:red}</style>',
    ''
);

// 整体编辑态文档规格：
//  - scripts: 注入脚本数量（0~2，覆盖「重复 id」这种理论异常情况）；
//  - savedEls: 带 data-saved-outline 的编辑态元素列表；
//  - plain: 随机良性周边 markup 列表。
const editingStateSpec = fc.record({
    numScripts: fc.integer({
        min: 0,
        max: 2
    }),
    savedEls: fc.array(savedOutlineElementSpec, {
        minLength: 0,
        maxLength: 6
    }),
    plain: fc.array(plainMarkup, {
        minLength: 0,
        maxLength: 4
    }),
});

// 依据规格构造一个独立的编辑态文档（document.implementation.createHTMLDocument）。
function buildEditingDoc(spec) {
    const doc = document.implementation.createHTMLDocument('export-test');

    // 1) 随机良性周边 markup（先写入，作为非编辑器内容基底）。
    doc.body.innerHTML = spec.plain.join('');

    // 2) 带 data-saved-outline 标记的编辑态元素（通过 DOM API 设置，契约一致）：
    //    先把「原始内联 outline」存入 data-saved-outline（空串表示原本无 outline），
    //    再设置编辑器的 outline / outline-offset / cursor 编辑态内联样式。
    for (const elSpec of spec.savedEls) {
        const el = doc.createElement(elSpec.tag);
        if (elSpec.text) {
            el.textContent = elSpec.text;
        }
        el.setAttribute(SAVED_OUTLINE_ATTR, elSpec.original);
        el.style.setProperty('outline', elSpec.editor);
        el.style.setProperty('outline-offset', '1px');
        el.style.setProperty('cursor', 'pointer');
        doc.body.appendChild(el);
    }

    // 3) 注入脚本节点（编辑态特征）：id="__htmledit__"。
    for (let i = 0; i < spec.numScripts; i++) {
        const script = doc.createElement('script');
        script.id = INJECTED_SCRIPT_ID;
        script.textContent = '(function(){/* injected editor ' + i + ' */})()';
        doc.body.appendChild(script);
    }

    return doc;
}

// --- 属性 -------------------------------------------------------------------

describe('Property 21: 导出产物干净性 (src/exporter.js)', () => {
    // Feature: html-visual-editor, Property 21: 导出产物干净性
    it('cleanAndSerialize 产物不含注入脚本、data-saved-outline 标记，及编辑器添加的 outline-offset/cursor/编辑态 outline 颜色', () => {
        fc.assert(
            fc.property(editingStateSpec, (spec) => {
                const doc = buildEditingDoc(spec);

                // 前置条件自检：构造出的 DOM 确实处于编辑状态。
                if (spec.numScripts > 0) {
                    expect(
                        doc.querySelectorAll('#' + INJECTED_SCRIPT_ID).length
                    ).toBe(spec.numScripts);
                }
                if (spec.savedEls.length > 0) {
                    expect(
                        doc.querySelectorAll('[' + SAVED_OUTLINE_ATTR + ']').length
                    ).toBe(spec.savedEls.length);
                }

                const output = cleanAndSerialize(doc);

                // 1) 不含 id="__htmledit__" 注入脚本（及其 id 标记本身）。
                expect(output).not.toContain('id="' + INJECTED_SCRIPT_ID + '"');
                expect(output).not.toContain(INJECTED_SCRIPT_ID);

                // 2) data-saved-outline 标记已被移除。
                expect(output).not.toContain(SAVED_OUTLINE_ATTR);

                // 3) 编辑器添加的 outline-offset / cursor 编辑态样式已被清除。
                expect(output).not.toContain('outline-offset');
                expect(output).not.toContain('cursor');

                // 4) 编辑器添加的选中/悬停 outline 颜色不应残留。
                expect(output.toLowerCase()).not.toContain('#00d4aa');
                expect(output).not.toContain('rgba(0, 212, 170');
            }), {
                numRuns: 200
            }
        );
    });

    // Feature: html-visual-editor, Property 21: 导出产物干净性
    it('原本带内联 outline 的元素其原始 outline 被还原（非编辑态样式不被误删）', () => {
        // 聚焦「还原原始 outline」的子属性：当 data-saved-outline 非空时，
        // 清理后应保留该原始 outline 值，但仍不含编辑态的 offset/cursor。
        const nonEmptyOriginal = fc.record({
            tag: elementTag,
            text: safeText,
            original: fc.constantFrom(
                '1px dashed red',
                '3px double rgb(10, 20, 30)',
                'thin solid black'
            ),
            editor: editorOutline,
        });

        fc.assert(
            fc.property(nonEmptyOriginal, (elSpec) => {
                const doc = buildEditingDoc({
                    numScripts: 1,
                    savedEls: [elSpec],
                    plain: [],
                });

                const output = cleanAndSerialize(doc);

                // 原始 outline 被还原（出现在产物中）。
                expect(output).toContain('outline: ' + elSpec.original);
                // 但编辑态的 offset / cursor / 注入脚本仍被清除。
                expect(output).not.toContain('outline-offset');
                expect(output).not.toContain('cursor');
                expect(output).not.toContain(INJECTED_SCRIPT_ID);
            }), {
                numRuns: 100
            }
        );
    });
});