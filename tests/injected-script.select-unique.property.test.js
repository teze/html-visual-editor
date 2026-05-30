// 属性测试：单击选中唯一性（Property 11）
//
// 验证 src/injected-script.js 的 onClick：对任意可编辑元素序列的连续单击，
//   - 任一时刻带有 #00d4aa 选中边框（SELECT_OUTLINE）的元素至多为一个；
//   - 且恒为最近一次单击的可编辑元素（getSelectedEl() 与之相等）。
//
// 运行环境：vitest + jsdom。构造 N 个可编辑元素，以随机顺序逐个单击，
// 每次单击后断言：getSelectedEl() 为被点元素，且全集中恰好一个元素带
// SELECT_OUTLINE 且就是它。

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

const editableTag = fc.constantFrom(
    'DIV', 'P', 'SPAN', 'H1', 'A', 'BUTTON', 'SECTION', 'LI'
);

const safeText = fc.string({
    maxLength: 30
}).map((s) => s.replace(/[<>]/g, ''));

function evt(el) {
    return {
        target: el,
        preventDefault() {},
        stopPropagation() {},
    };
}

// 一批元素规格（2..8 个）以及一个对它们的随机点击顺序（含重复点击）。
const scenario = fc
    .array(
        fc.record({
            tag: editableTag,
            text: safeText
        }), {
            minLength: 2,
            maxLength: 8
        }
    )
    .chain((specs) =>
        fc.record({
            specs: fc.constant(specs),
            // 点击序列：对 [0, specs.length) 的下标取任意序列（长度 1..16）。
            clicks: fc.array(
                fc.integer({
                    min: 0,
                    max: specs.length - 1
                }), {
                    minLength: 1,
                    maxLength: 16
                }
            ),
        })
    );

// --- 属性 -------------------------------------------------------------------

describe('Property 11: 单击选中唯一性 (src/injected-script.js)', () => {
    // Feature: html-visual-editor, Property 11: 单击选中唯一性
    it('任一时刻至多一个元素带 #00d4aa，且恒为最近一次单击的可编辑元素', () => {
        fc.assert(
            fc.property(scenario, ({
                specs,
                clicks
            }) => {
                resetState();
                document.body.innerHTML = '';

                // 构造元素集合。
                const els = specs.map((spec) => {
                    const el = document.createElement(spec.tag);
                    if (spec.text) {
                        el.textContent = spec.text;
                    }
                    document.body.appendChild(el);
                    return el;
                });

                for (const idx of clicks) {
                    const target = els[idx];
                    onClick(evt(target));

                    // 1) 最近一次单击的元素即为选中元素。
                    expect(getSelectedEl()).toBe(target);
                    expect(target.style.outline).toBe(SELECT_OUTLINE);

                    // 2) 全集中恰好一个元素带 SELECT_OUTLINE，且为该元素。
                    const selectedOnes = els.filter(
                        (el) => el.style.outline === SELECT_OUTLINE
                    );
                    expect(selectedOnes.length).toBe(1);
                    expect(selectedOnes[0]).toBe(target);
                }
            }), {
                numRuns: 200
            }
        );
    });
});