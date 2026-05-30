// 属性测试：合法数值样式输入被应用（Property 15）
//
// 验证 src/injected-script.js 的 onMessage 对 { type:'update', prop, val } 的处理：
// 当 prop 为 CSS 样式属性（camelCase）、val 为面板发出的「合法范围内数值 + 单位」时，
// onMessage 应把该值写入当前选中元素的对应内联样式 style[prop]。
//
// 覆盖各范围上下界：
//   - fontSize:     1..999      px
//   - padding:      0..9999     px
//   - borderRadius: 0..9999     px
//   - width/height: px 0..99999 / % 0..100
//
// 运行环境：vitest + jsdom。注意 jsdom 会规范化部分样式值，故断言
// style[prop] 等于「期望的 CSS 值」（这里期望即面板发送的原始 val）。

import {
    describe,
    it,
    expect,
    beforeEach,
} from 'vitest';
import fc from 'fast-check';
import {
    onMessage,
    setSelectedEl,
    setPostTarget,
    resetState,
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

// --- 生成器：合法范围内数值样式输入（prop + val 含单位） ---------------------

// 每个分支生成 { prop, val }，val 为面板会发送的「合法值 + 单位」字符串。
const styleInput = fc.oneof(
    // font-size: 1..999 px（含上下界 1 / 999）
    fc.integer({
        min: 1,
        max: 999
    }).map((n) => ({
        prop: 'fontSize',
        val: n + 'px',
    })),
    // padding: 0..9999 px（含上下界 0 / 9999）
    fc.integer({
        min: 0,
        max: 9999
    }).map((n) => ({
        prop: 'padding',
        val: n + 'px',
    })),
    // border-radius: 0..9999 px（含上下界 0 / 9999）
    fc.integer({
        min: 0,
        max: 9999
    }).map((n) => ({
        prop: 'borderRadius',
        val: n + 'px',
    })),
    // width: px 0..99999（含上下界 0 / 99999）
    fc.integer({
        min: 0,
        max: 99999
    }).map((n) => ({
        prop: 'width',
        val: n + 'px',
    })),
    // width: % 0..100（含上下界 0 / 100）
    fc.integer({
        min: 0,
        max: 100
    }).map((n) => ({
        prop: 'width',
        val: n + '%',
    })),
    // height: px 0..99999（含上下界 0 / 99999）
    fc.integer({
        min: 0,
        max: 99999
    }).map((n) => ({
        prop: 'height',
        val: n + 'px',
    })),
    // height: % 0..100（含上下界 0 / 100）
    fc.integer({
        min: 0,
        max: 100
    }).map((n) => ({
        prop: 'height',
        val: n + '%',
    }))
);

const elementTag = fc.constantFrom('DIV', 'P', 'SPAN', 'SECTION', 'BUTTON', 'A');

// --- 属性 -------------------------------------------------------------------

describe('Property 15: 合法数值样式输入被应用 (src/injected-script.js)', () => {
    // Feature: html-visual-editor, Property 15: 合法数值样式输入被应用
    it('合法范围内数值样式（含单位）经 onMessage 写入选中元素对应 style[prop]', () => {
        fc.assert(
            fc.property(elementTag, styleInput, (tag, {
                prop,
                val
            }) => {
                resetState();
                document.body.innerHTML = '';
                captured.length = 0;

                // 新建并选中一个干净元素。
                const el = document.createElement(tag);
                document.body.appendChild(el);
                setSelectedEl(el);

                onMessage({
                    data: {
                        type: 'update',
                        prop,
                        val
                    }
                });

                // jsdom 直写 style[prop]=val 后，style[prop] 读取应等于发送的 CSS 值。
                expect(el.style[prop]).toBe(val);

                // 一次成功的样式更新回发 changed。
                expect(captured.some((m) => m && m.type === 'changed')).toBe(true);
            }), {
                numRuns: 200
            }
        );
    });
});