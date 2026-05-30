// 属性测试：删除移除子树并清除选中（Property 18）
//
// 验证 src/injected-script.js 的 onMessage 对 { type:'update', prop:'delete' } 的处理：
//   - 对任意「带后代的被选中元素」：删除后该元素及其全部后代不再存在于 DOM 中
//     （isConnected === false，且不再被 document.body 包含）；
//   - 删除后 getSelectedEl() 返回 null（不存在 Selected_Element）；
//   - 随后再发一条 update（如 { prop:'fontSize', val:'20px' }）不抛错，
//     且不作用于任何已删除节点。
//
// 运行环境：vitest + jsdom。随机构造嵌套 DOM 树，注入选中目标后删除并断言。

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
    getSelectedEl,
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

// --- 生成器：随机嵌套 DOM 树 ------------------------------------------------

const editableTag = fc.constantFrom(
    'DIV', 'SECTION', 'ARTICLE', 'P', 'SPAN', 'UL', 'LI'
);

// 递归节点规格：tag + 子节点数组（受 depthSize 控制以限制深度）。
const {
    node
} = fc.letrec((tie) => ({
    node: fc.record({
        tag: editableTag,
        children: fc.oneof({
                depthSize: 'small'
            },
            fc.constant([]),
            fc.array(tie('node'), {
                maxLength: 3
            })
        ),
    }),
}));

// 根规格：至少 1 个子节点，保证根元素拥有后代。
const treeSpec = fc.array(node, {
    minLength: 1,
    maxLength: 4
});

function buildNode(spec) {
    const el = document.createElement(spec.tag);
    for (const child of spec.children) {
        el.appendChild(buildNode(child));
    }
    return el;
}

// --- 属性 -------------------------------------------------------------------

describe('Property 18: 删除移除子树并清除选中 (src/injected-script.js)', () => {
    // Feature: html-visual-editor, Property 18: 删除移除子树并清除选中
    it('删除后元素及全部后代不在 DOM，且选中被清空；后续 update 不抛错也不影响已删除节点', () => {
        fc.assert(
            fc.property(treeSpec, fc.integer({
                min: 0,
                max: 100000
            }), (specs, pick) => {
                resetState();
                document.body.innerHTML = '';
                captured.length = 0;

                // 构造根容器与随机子树（根必有后代）。
                const root = document.createElement('div');
                for (const s of specs) {
                    root.appendChild(buildNode(s));
                }
                document.body.appendChild(root);

                // 候选目标：所有「拥有后代元素」的节点（含 root）。
                const all = [root, ...root.querySelectorAll('*')];
                const candidates = all.filter(
                    (el) => el.querySelectorAll('*').length > 0
                );
                expect(candidates.length).toBeGreaterThan(0);

                const target = candidates[pick % candidates.length];
                const descendants = Array.from(target.querySelectorAll('*'));
                expect(descendants.length).toBeGreaterThan(0);

                // 注入选中目标并删除。
                setSelectedEl(target);
                onMessage({
                    data: {
                        type: 'update',
                        prop: 'delete'
                    }
                });

                // 1) 目标及全部后代不再存在于 DOM 中。
                expect(target.isConnected).toBe(false);
                expect(document.body.contains(target)).toBe(false);
                for (const d of descendants) {
                    expect(d.isConnected).toBe(false);
                    expect(document.body.contains(d)).toBe(false);
                }

                // 2) 删除后不存在 Selected_Element。
                expect(getSelectedEl()).toBe(null);

                // 3) 回发了 deleted 消息（且未把删除误计为 changed）。
                expect(captured.some((m) => m && m.type === 'deleted')).toBe(true);
                expect(captured.some((m) => m && m.type === 'changed')).toBe(false);

                // 4) 后续 update 不抛错，且不作用于任何已删除节点。
                const removed = descendants[0];
                const before = removed.style.fontSize;
                expect(() =>
                    onMessage({
                        data: {
                            type: 'update',
                            prop: 'fontSize',
                            val: '20px'
                        }
                    })
                ).not.toThrow();
                expect(removed.style.fontSize).toBe(before);
                expect(getSelectedEl()).toBe(null);
            }), {
                numRuns: 200
            }
        );
    });
});