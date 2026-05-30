// tests/change-counter.invariant.property.test.js
// 属性测试：修改计数不变量（Property 19）
//
// 验证 src/change-counter.js 的 ChangeCounter 在「属性变更 / 单次内联编辑会话 /
// 删除元素」混合的成功操作序列下的计数不变量：
//   - 属性变更 / 删除：直接 increment()，每次成功操作 +1；
//   - 单次内联编辑会话：nextSessionId() 取唯一会话标识，随后对该会话
//     incrementOncePerSession(sid) 调用任意多次（>=1）也仅计 1（需求 4.4）；
//   - 最终计数 == 成功操作次数（在 999999 上限内夹取），且恒为 0..999999 整数。
//
// Feature: html-visual-editor, Property 19: 修改计数不变量

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';

import {
    ChangeCounter,
    MAX_CHANGE_COUNT,
} from '../src/change-counter.js';

// --- 生成器 -----------------------------------------------------------------

// 单个操作：
//  - 'property-change' / 'delete'：一次直接计数的成功操作；
//  - 'edit-session'：一次内联编辑会话，会话内发生 inputs 次（>=1）文字变更，
//    但按「每会话仅计一次」语义只贡献 1 次计数。
// inputs 仅对 'edit-session' 有意义（其他类型忽略）。
const opArb = fc.record({
    kind: fc.constantFrom('property-change', 'delete', 'edit-session'),
    inputs: fc.integer({
        min: 1,
        max: 12
    }),
});

// 随机操作序列（长度 0..200，确保覆盖空序列与较长序列）。
const opsArb = fc.array(opArb, {
    minLength: 0,
    maxLength: 200
});

// --- 属性 -------------------------------------------------------------------

describe('Property 19: 修改计数不变量 (src/change-counter.js)', () => {
    // Feature: html-visual-editor, Property 19: 修改计数不变量
    // 对任意由「属性变更 / 单次内联编辑会话 / 删除」组成的成功操作序列，
    // 最终计数等于成功操作次数（单会话内多次 input 仅计 1），且恒为 0..999999 整数。
    it('最终计数等于成功操作次数（单会话多次 input 仅计 1），且恒为 0..999999 整数', () => {
        fc.assert(
            fc.property(opsArb, (ops) => {
                const counter = new ChangeCounter();

                for (const op of ops) {
                    if (op.kind === 'edit-session') {
                        // 模拟一次内联编辑会话：唯一会话标识，会话内多次文字变更。
                        const sid = counter.nextSessionId();
                        for (let i = 0; i < op.inputs; i++) {
                            counter.incrementOncePerSession(sid);
                        }
                    } else {
                        // 属性变更 / 删除：直接计数。
                        counter.increment();
                    }
                }

                // 每个 op 恰好贡献 1 次成功计数；上限夹取到 MAX_CHANGE_COUNT。
                const expected = Math.min(ops.length, MAX_CHANGE_COUNT);
                expect(counter.count).toBe(expected);

                // 取值恒为 0..999999 范围内的整数。
                expect(Number.isInteger(counter.count)).toBe(true);
                expect(counter.count).toBeGreaterThanOrEqual(0);
                expect(counter.count).toBeLessThanOrEqual(MAX_CHANGE_COUNT);
            }), {
                numRuns: 200
            },
        );
    });

    // Feature: html-visual-editor, Property 19: 修改计数不变量
    // 单独聚焦「每会话仅计一次」：对任意会话数量与各会话任意 input 次数，
    // 最终计数应等于会话数量。
    it('单次内联编辑会话内多次 input 仅计 1（计数等于会话数量）', () => {
        const sessionsArb = fc.array(fc.integer({
            min: 1,
            max: 20
        }), {
            minLength: 0,
            maxLength: 100,
        });

        fc.assert(
            fc.property(sessionsArb, (inputsPerSession) => {
                const counter = new ChangeCounter();

                for (const inputs of inputsPerSession) {
                    const sid = counter.nextSessionId();
                    for (let i = 0; i < inputs; i++) {
                        counter.incrementOncePerSession(sid);
                    }
                }

                expect(counter.count).toBe(inputsPerSession.length);
                expect(Number.isInteger(counter.count)).toBe(true);
            }), {
                numRuns: 100
            },
        );
    });
});