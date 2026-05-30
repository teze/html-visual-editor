// 属性测试：悬停高亮进出还原（Property 10）
//
// 验证 src/injected-script.js 的 onMouseOver / onMouseOut：
//   - 对任意「可编辑元素」，触发 mouseover 后再 mouseout，元素的 outline
//     应还原为「悬停前」的值（无论原本为空串还是预置的内联 outline）。
//   - 若该元素同时是 Selected_Element（先经 onClick 选中），则 mouseover→mouseout
//     之后仍应保留 #00d4aa 实线 2px 选中边框（SELECT_OUTLINE）。
//
// 运行环境：vitest + jsdom。元素 append 到 document.body 后驱动事件处理器；
// 处理器仅读取 e.target，故以合成事件对象 { target: el, ... } 驱动。
// 每个 it() 前 resetState() 以隔离模块级选中/悬停状态。

import {
    describe,
    it,
    expect,
    beforeEach,
} from 'vitest';
import fc from 'fast-check';
import {
    onMouseOver,
    onMouseOut,
    onClick,
    resetState,
    setPostTarget,
    HOVER_OUTLINE,
    SELECT_OUTLINE,
} from '../src/injected-script.js';

// 捕获上行 postMessage（onClick 会发送 selected 消息）。
let captured = [];

beforeEach(() => {
    resetState();
    captured = [];
    setPostTarget({
        postMessage: (msg) => captured.push(msg),
    });
    document.body.innerHTML = '';
});

// --- 生成器 -----------------------------------------------------------------

// 可编辑标签（均不在 SKIP 集合中）。
const editableTag = fc.constantFrom(
    'DIV', 'P', 'SPAN', 'H1', 'H2', 'A', 'BUTTON', 'SECTION', 'ARTICLE', 'LI'
);

// 安全文本：去除尖括号，避免被当成 markup。
const safeText = fc.string({
    maxLength: 40
}).map((s) => s.replace(/[<>]/g, ''));

// 预置内联 outline：空串或几个可被 jsdom 原样回读的合法 outline 值。
const presetOutline = fc.constantFrom(
    '',
    '1px dashed red',
    '3px solid blue',
    '2px dotted green'
);

const elementSpec = fc.record({
    tag: editableTag,
    text: safeText,
    preset: presetOutline,
});

function buildElement(spec) {
    const el = document.createElement(spec.tag);
    if (spec.text) {
        el.textContent = spec.text;
    }
    if (spec.preset) {
        el.style.outline = spec.preset;
    }
    document.body.appendChild(el);
    return el;
}

// 合成事件对象。
function evt(el) {
    return {
        target: el,
        preventDefault() {},
        stopPropagation() {},
    };
}

// --- 属性 -------------------------------------------------------------------

describe('Property 10: 悬停高亮进出还原 (src/injected-script.js)', () => {
    // Feature: html-visual-editor, Property 10: 悬停高亮进出还原
    it('非选中元素 mouseover→mouseout 还原原始 outline；选中元素 mouseout 后保留 #00d4aa', () => {
        fc.assert(
            fc.property(elementSpec, (spec) => {
                resetState();
                document.body.innerHTML = '';

                // --- 情形 A：非选中元素，进出后还原到悬停前的值 ---
                const elA = buildElement(spec);
                const preHover = elA.style.outline; // 悬停前的真实回读值

                onMouseOver(evt(elA)); // 施加 HOVER_OUTLINE
                expect(elA.style.outline).toBe(HOVER_OUTLINE);

                onMouseOut(evt(elA)); // 还原
                expect(elA.style.outline).toBe(preHover);

                // --- 情形 B：选中元素，hover 进出后仍保留 SELECT_OUTLINE ---
                const elB = buildElement(spec);
                onClick(evt(elB)); // 选中 → SELECT_OUTLINE
                expect(elB.style.outline).toBe(SELECT_OUTLINE);

                onMouseOver(evt(elB)); // 选中元素：不覆盖其选中边框
                onMouseOut(evt(elB));
                expect(elB.style.outline).toBe(SELECT_OUTLINE);
            }), {
                numRuns: 200
            }
        );
    });
});