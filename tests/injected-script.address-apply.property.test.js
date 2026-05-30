// 属性测试：地址属性应用保真（Property 17）
//
// 验证 src/injected-script.js 的 onMessage 对 { type:'update', prop:'src'|'href', val }
// 的处理：
//   - prop 'src' 发给选中的 <img>：img.getAttribute('src') === val；
//   - prop 'href' 发给选中的 <a>： a.getAttribute('href') === val。
// 适用于任意非空、长度 ≤ 2048 的字符串（getAttribute 返回原样写入值，
// 故无需回避特殊字符；仅排除 null 字节这类无法作为属性值往返的字符）。
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

// --- 生成器：非空、长度 ≤ 2048 的地址字符串 --------------------------------

// 任意非空字符串，去除 null 字节（\u0000 无法作为属性值往返），长度上限 2048。
const addressValue = fc
    .string({
        minLength: 1,
        maxLength: 2048
    })
    .map((s) => s.replace(/\u0000/g, ''))
    .filter((s) => s.length >= 1 && s.length <= 2048);

// --- 属性 -------------------------------------------------------------------

describe('Property 17: 地址属性应用保真 (src/injected-script.js)', () => {
    // Feature: html-visual-editor, Property 17: 地址属性应用保真
    it('src 写入选中 <img>、href 写入选中 <a>，且写入值等于输入', () => {
        fc.assert(
            fc.property(addressValue, (val) => {
                // --- src → <img> ---
                resetState();
                document.body.innerHTML = '';
                captured.length = 0;

                const img = document.createElement('img');
                document.body.appendChild(img);
                setSelectedEl(img);

                onMessage({
                    data: {
                        type: 'update',
                        prop: 'src',
                        val
                    }
                });

                expect(img.getAttribute('src')).toBe(val);
                expect(captured.some((m) => m && m.type === 'changed')).toBe(true);

                // --- href → <a> ---
                resetState();
                document.body.innerHTML = '';
                captured.length = 0;

                const a = document.createElement('a');
                document.body.appendChild(a);
                setSelectedEl(a);

                onMessage({
                    data: {
                        type: 'update',
                        prop: 'href',
                        val
                    }
                });

                expect(a.getAttribute('href')).toBe(val);
                expect(captured.some((m) => m && m.type === 'changed')).toBe(true);
            }), {
                numRuns: 200
            }
        );
    });
});