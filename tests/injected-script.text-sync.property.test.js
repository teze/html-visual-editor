// 属性测试：内联编辑文字同步保真（Property 13）
//
// 验证 src/injected-script.js 的 onDblClick / onInput：对任意「文字类可编辑元素」
// 与任意输入文字，进入 contentEditable 状态、设置元素文本后触发 input，
// 发送给 Editor 的 'textInput' 消息所携带的文字应等于该元素当前的完整文字
// （innerText || textContent；jsdom 无 innerText，退回 textContent）。
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
    onInput,
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

// --- 生成器 -----------------------------------------------------------------

// 文字类可编辑标签（非 img、可直接含文本）。
const textTag = fc.constantFrom('P', 'DIV', 'SPAN', 'H1', 'H2', 'A', 'BUTTON', 'LI', 'LABEL');

// 输入文字：去除尖括号避免被解析为 markup；允许空串与较长文本。
const inputText = fc.string({
    maxLength: 120
}).map((s) => s.replace(/[<>]/g, ''));

// 初始文本（双击前元素需「直接含文本」才被判为文字类可编辑），故非空。
const initialText = fc
    .string({
        minLength: 1,
        maxLength: 30
    })
    .map((s) => s.replace(/[<>]/g, ''))
    .filter((s) => s.trim().length > 0);

function evt(el) {
    return {
        target: el,
        preventDefault() {},
        stopPropagation() {},
    };
}

const scenario = fc.record({
    tag: textTag,
    initial: initialText,
    typed: inputText,
});

// 元素当前完整文字（与实现 readFullText 一致）。
function fullText(el) {
    return (el.innerText != null ? el.innerText : el.textContent) || '';
}

// --- 属性 -------------------------------------------------------------------

describe('Property 13: 内联编辑文字同步保真 (src/injected-script.js)', () => {
    // Feature: html-visual-editor, Property 13: 内联编辑文字同步保真
    it('input 后 textInput 携带的文字等于元素当前完整文字', () => {
        fc.assert(
            fc.property(scenario, ({
                tag,
                initial,
                typed
            }) => {
                resetState();
                captured.length = 0;
                document.body.innerHTML = '';

                const el = document.createElement(tag);
                el.textContent = initial; // 直接含文本 → 文字类可编辑
                document.body.appendChild(el);

                // 前置条件：元素为文字类可编辑。
                expect(isTextEditable(el)).toBe(true);

                // 进入内联编辑态。
                onDblClick(evt(el));
                expect(el.contentEditable).toBe('true');

                // 模拟用户编辑：设置元素当前文本，然后触发 input。
                el.textContent = typed;
                captured = []; // 仅关注 input 触发后的消息
                onInput(evt(el));

                // textInput 消息携带的文字等于元素当前完整文字。
                const textMsgs = captured.filter((m) => m && m.type === 'textInput');
                expect(textMsgs.length).toBe(1);
                expect(textMsgs[0].text).toBe(fullText(el));
            }), {
                numRuns: 200
            }
        );
    });
});