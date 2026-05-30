// 属性测试：双击编辑态进出往返（Property 14）
//
// 验证 src/injected-script.js 的 onDblClick / onBlur：
//   - 对任意「文字类可编辑元素」：onDblClick 后 contentEditable === 'true'；
//     随后 onBlur 后恢复为 'false'。
//   - 对任意 SKIP 或非文字元素（如 IMG、不直接含文本的空 DIV、STYLE/SCRIPT 等）：
//     onDblClick 不应把 contentEditable 设为 'true'。
//
// 运行环境：vitest + jsdom。

import {
    describe,
    it,
    expect,
    beforeEach,
} from 'vitest';
import fc from 'fast-check';
import {
    onDblClick,
    onBlur,
    resetState,
    setPostTarget,
    isTextEditable,
} from '../src/injected-script.js';

let captured = [];

beforeEach(() => {
    resetState();
    captured = [];
    setPostTarget({
        postMessage: (msg) => captured.push(msg),
    });
    document.body.innerHTML = '';
});

function evt(el) {
    return {
        target: el,
        preventDefault() {},
        stopPropagation() {},
    };
}

// --- 情形 1：文字类可编辑元素，进出往返 -------------------------------------

const textTag = fc.constantFrom('P', 'DIV', 'SPAN', 'H1', 'H2', 'A', 'BUTTON', 'LI', 'LABEL');
const initialText = fc
    .string({
        minLength: 1,
        maxLength: 30
    })
    .map((s) => s.replace(/[<>]/g, ''))
    .filter((s) => s.trim().length > 0);

const textSpec = fc.record({
    tag: textTag,
    text: initialText
});

// --- 情形 2：非文字 / SKIP 元素，双击不进入编辑态 ---------------------------

// 非文字目标：IMG、不直接含文本的空容器、仅含子元素的容器、SKIP 结构性元素。
const nonTextSpec = fc.oneof(
    // IMG（可编辑但非文字类）
    fc.record({
        kind: fc.constant('img')
    }),
    // 空的可编辑容器（不直接含文本）
    fc.record({
        kind: fc.constant('empty'),
        tag: fc.constantFrom('DIV', 'SECTION', 'ARTICLE', 'UL'),
    }),
    // 仅含子元素（无直接文本节点）的容器
    fc.record({
        kind: fc.constant('childOnly'),
        tag: fc.constantFrom('DIV', 'SECTION', 'UL'),
        childTag: fc.constantFrom('SPAN', 'IMG', 'LI'),
    }),
    // SKIP 结构性元素
    fc.record({
        kind: fc.constant('skip'),
        tag: fc.constantFrom('STYLE', 'SCRIPT', 'META', 'TITLE', 'LINK'),
    })
);

function buildNonText(spec) {
    if (spec.kind === 'img') {
        const el = document.createElement('img');
        document.body.appendChild(el);
        return el;
    }
    if (spec.kind === 'empty') {
        const el = document.createElement(spec.tag);
        document.body.appendChild(el);
        return el;
    }
    if (spec.kind === 'childOnly') {
        const el = document.createElement(spec.tag);
        el.appendChild(document.createElement(spec.childTag));
        document.body.appendChild(el);
        return el;
    }
    // skip
    const el = document.createElement(spec.tag);
    document.body.appendChild(el);
    return el;
}

// --- 属性 -------------------------------------------------------------------

describe('Property 14: 双击编辑态进出往返 (src/injected-script.js)', () => {
    // Feature: html-visual-editor, Property 14: 双击编辑态进出往返
    it('文字类元素 dblclick→true、blur→false；非文字/SKIP 元素 dblclick 不设 true', () => {
        fc.assert(
            fc.property(textSpec, nonTextSpec, (tSpec, nSpec) => {
                resetState();
                document.body.innerHTML = '';

                // --- 情形 1：文字类可编辑元素往返 ---
                const tEl = document.createElement(tSpec.tag);
                tEl.textContent = tSpec.text;
                document.body.appendChild(tEl);

                expect(isTextEditable(tEl)).toBe(true);

                onDblClick(evt(tEl));
                expect(tEl.contentEditable).toBe('true');

                onBlur(evt(tEl));
                expect(tEl.contentEditable).toBe('false');

                // --- 情形 2：非文字 / SKIP 元素，双击不进入编辑态 ---
                const nEl = buildNonText(nSpec);
                expect(isTextEditable(nEl)).toBe(false);

                onDblClick(evt(nEl));
                expect(nEl.contentEditable).not.toBe('true');
            }), {
                numRuns: 200
            }
        );
    });
});