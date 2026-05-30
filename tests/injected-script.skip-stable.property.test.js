// 属性测试：不可交互目标的稳定性（Property 12）
//
// 验证 src/injected-script.js 的 onClick：在已存在 Selected_Element 的状态下，
// 单击 SKIP（结构性，如 STYLE/SCRIPT/META/TITLE）元素或非可编辑目标后：
//   - getSelectedEl() 保持不变；
//   - 选中元素的选中边框（SELECT_OUTLINE）保持不变；
//   - 不发送任何新的 'selected' 消息。
//
// 运行环境：vitest + jsdom。先单击一个可编辑元素建立选中，记录已发消息数，
// 再单击 SKIP/非可编辑目标，断言选中与消息均无变化。

import {
    describe,
    it,
    expect,
    beforeEach,
} from 'vitest';
import fc from 'fast-check';
import {
    onClick,
    resetState,
    setPostTarget,
    getSelectedEl,
    SELECT_OUTLINE,
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

// 初始选中用的可编辑标签。
const editableTag = fc.constantFrom('DIV', 'P', 'SPAN', 'H1', 'A', 'BUTTON', 'LI');

const safeText = fc.string({
    maxLength: 30
}).map((s) => s.replace(/[<>]/g, ''));

// SKIP（结构性）标签。
const skipTag = fc.constantFrom('STYLE', 'SCRIPT', 'META', 'TITLE', 'LINK', 'BASE', 'NOSCRIPT');

function evt(el) {
    return {
        target: el,
        preventDefault() {},
        stopPropagation() {},
    };
}

// 不可交互目标：SKIP 元素，或非元素目标（如 null / 文本节点 / document）。
const skipTarget = fc.oneof(
    skipTag.map((tag) => ({
        kind: 'skip',
        tag
    })),
    fc.constantFrom({
            kind: 'null'
        }, {
            kind: 'text'
        }, // 文本节点（nodeType 3，非可编辑）
        {
            kind: 'document'
        } // document（nodeType 9，非可编辑）
    )
);

function buildSkipTarget(desc) {
    switch (desc.kind) {
        case 'skip': {
            const el = document.createElement(desc.tag);
            document.body.appendChild(el);
            return el;
        }
        case 'null':
            return null;
        case 'text':
            return document.createTextNode('blank area');
        case 'document':
            return document;
        default:
            return null;
    }
}

const scenario = fc.record({
    initTag: editableTag,
    initText: safeText,
    skip: skipTarget,
});

// --- 属性 -------------------------------------------------------------------

describe('Property 12: 不可交互目标的稳定性 (src/injected-script.js)', () => {
    // Feature: html-visual-editor, Property 12: 不可交互目标的稳定性
    it('单击 SKIP/非可编辑目标：选中与边框不变，且不发送 selected 消息', () => {
        fc.assert(
            fc.property(scenario, ({
                initTag,
                initText,
                skip
            }) => {
                // 每轮迭代隔离模块状态与捕获消息（beforeEach 仅在 it 级运行一次）。
                resetState();
                captured.length = 0;
                document.body.innerHTML = '';

                // 建立初始选中。
                const selected = document.createElement(initTag);
                if (initText) {
                    selected.textContent = initText;
                }
                document.body.appendChild(selected);
                onClick(evt(selected));

                // 选中已建立：getSelectedEl 即该元素，且发了一条 selected。
                expect(getSelectedEl()).toBe(selected);
                const selectedBefore = getSelectedEl();
                const outlineBefore = selected.style.outline;
                const selectedMsgCountBefore = captured.filter(
                    (m) => m && m.type === 'selected'
                ).length;
                expect(selectedMsgCountBefore).toBe(1);

                // 单击不可交互目标。
                const target = buildSkipTarget(skip);
                onClick(evt(target));

                // 1) 选中元素引用不变。
                expect(getSelectedEl()).toBe(selectedBefore);
                // 2) 选中边框不变（仍为 #00d4aa）。
                expect(selected.style.outline).toBe(outlineBefore);
                expect(selected.style.outline).toBe(SELECT_OUTLINE);
                // 3) 未发送新的 selected 消息。
                const selectedMsgCountAfter = captured.filter(
                    (m) => m && m.type === 'selected'
                ).length;
                expect(selectedMsgCountAfter).toBe(selectedMsgCountBefore);
            }), {
                numRuns: 200
            }
        );
    });
});