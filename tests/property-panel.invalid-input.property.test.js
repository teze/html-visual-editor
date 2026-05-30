// 属性测试：非法输入被拒绝且无副作用（Property 16）
//
// 对任意非法输入——数值类的空值/非数值/越界值，或不符合 `#` 后接 3/6 位十六进制
// 格式的颜色值，或清空为空（含纯空白）的 src/href——对应的 apply* 入口应：
//   1) 返回 { ok:false }（拒绝该输入）；
//   2) 不调用下行发送函数（即不发送任何 update 消息，预览样式/属性因此保持不变、
//      Change_Count 不递增）；
//   3) 调用 showFieldError，使对应字段错误元素 `${controlId}Err` 的 textContent 非空。
//
// 测试在 jsdom 下运行：用 createPanelFragment(document) 构造面板根节点，用 setSender
// 注入一个发送侦听器（spy）记录是否发生发送，每次迭代重置。
//
// Feature: html-visual-editor, Property 16: 非法输入被拒绝且无副作用
//
// Validates: Requirements 5.13, 5.14, 6.4, 7.3, 7.6

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';
import {
    createPanelFragment,
    setSender,
    setHasSelection,
    errId,
    FIELD_CONTROL_IDS,
    applyFontSize,
    applyPadding,
    applyRadius,
    applyWidth,
    applyHeight,
    applyColor,
    applyBackground,
    applySrc,
    applyHref,
} from '../src/property-panel.js';

// ---------------------------------------------------------------------------
// 通用非法输入构件
// ---------------------------------------------------------------------------

// 纯空白 / 空串（数值与地址字段在 trim 后均判为非法）。
const blankArb = fc.constantFrom('', '   ', '\t', ' \t ', '\n');

// 非整数小数字符串（如 "12.5"、"-3.7"）：始终包含 '.'，必被严格整数校验拒绝。
const decimalStr = fc
    .tuple(fc.integer({
        min: -9999,
        max: 9999
    }), fc.integer({
        min: 1,
        max: 9999
    }))
    .map(([a, b]) => `${a}.${b}`);

// ---------------------------------------------------------------------------
// 各字段的「非法输入」生成器
//
// 每个生成器都【保证】产出的值对该字段而言非法（越界 / 非数值 / 格式错误 / 空），
// 并以 fc.constantFrom 显式纳入任务列出的代表性反例，确保覆盖。
// ---------------------------------------------------------------------------

// applyFontSize：合法 1..999 整数（px）。非法：空、非数值、0、>=1000、负数、小数。
const fontSizeInvalid = fc.oneof(
    fc.constantFrom('', 'abc', '0', '1000', '-1', '12.5'),
    blankArb,
    fc.constantFrom('red', 'xyz', 'px', '12px', '1e3', 'NaN', '+', '-'),
    fc.oneof(fc.integer({
        max: 0
    }), fc.integer({
        min: 1000,
        max: 5000000
    })).map(String),
    decimalStr,
);

// applyPadding / applyRadius：合法 0..9999 整数（px）。
// 非法：空、非数值、<0、>9999、小数。注意 0 合法，故越界整数从 -1 / 10000 起。
const boxRangeInvalid = fc.oneof(
    fc.constantFrom('', 'x', '-1', '10000', '12.5'),
    blankArb,
    fc.constantFrom('abc', 'red', 'px', '10e2', '1.0'),
    fc.oneof(fc.integer({
        max: -1
    }), fc.integer({
        min: 10000,
        max: 5000000
    })).map(String),
    decimalStr,
);

// applyWidth / applyHeight：解析 px/% 单位后按范围校验（px 0..99999、% 0..100）。
// 非法：空、非数值、px 越界（如 '100000px'、'-5px'）、% 越界（如 '101%'）、小数。
const lengthInvalid = fc.oneof(
    fc.constantFrom('', 'abc', '100000px', '101%', '-5px'),
    blankArb,
    fc.constantFrom('red', 'xyz', 'px', '%', 'foo'),
    // px 越界（>99999 或 <0）。
    fc.oneof(fc.integer({
        min: 100000,
        max: 5000000
    }), fc.integer({
        max: -1
    })).map((n) => n + 'px'),
    // % 越界（>100 或 <0）。
    fc.oneof(fc.integer({
        min: 101,
        max: 100000
    }), fc.integer({
        max: -1
    })).map((n) => n + '%'),
    // 带单位的小数与裸小数。
    decimalStr.map((s) => s + 'px'),
    decimalStr.map((s) => s + '%'),
    decimalStr,
);

// applyColor / applyBackground：合法为 `#` + 3 或 6 位十六进制。
// 非法：空、命名色、长度错误、含非十六进制字符。
const hexDigit = fc.constantFrom(...'0123456789abcdefABCDEF'.split(''));
// `#` + 长度非 3/6 的十六进制串（0,1,2,4,5,7,8 位）。
const wrongLenHex = fc
    .constantFrom(0, 1, 2, 4, 5, 7, 8)
    .chain((len) => fc.array(hexDigit, {
        minLength: len,
        maxLength: len
    }))
    .map((arr) => '#' + arr.join(''));
const colorInvalid = fc.oneof(
    fc.constantFrom('', 'red', '#12', '#1234', '#gggggg', 'xyz'),
    blankArb,
    fc.constantFrom('blue', 'transparent', 'rgb(0,0,0)', '123456', 'fff', '#', '#ggg', '#12345g', '#1234567'),
    wrongLenHex,
);

// applySrc / applyHref：合法为非空（trim 后）且 ≤ 2048 字符。
// 非法：空与纯空白（“地址不能为空”）。
const addressInvalid = fc.oneof(
    fc.constantFrom('', '   '),
    fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), {
        minLength: 0,
        maxLength: 6
    }).map((a) => a.join('')),
);

// ---------------------------------------------------------------------------
// 待测字段用例：apply 入口 + 字段名（用于解析其错误元素 id）+ 非法输入生成器
// ---------------------------------------------------------------------------

const FIELD_CASES = [{
    label: 'applyFontSize',
    apply: applyFontSize,
    field: 'fontSize',
    invalid: fontSizeInvalid,
}, {
    label: 'applyPadding',
    apply: applyPadding,
    field: 'padding',
    invalid: boxRangeInvalid,
}, {
    label: 'applyRadius',
    apply: applyRadius,
    field: 'borderRadius',
    invalid: boxRangeInvalid,
}, {
    label: 'applyWidth',
    apply: applyWidth,
    field: 'width',
    invalid: lengthInvalid,
}, {
    label: 'applyHeight',
    apply: applyHeight,
    field: 'height',
    invalid: lengthInvalid,
}, {
    label: 'applyColor',
    apply: applyColor,
    field: 'color',
    invalid: colorInvalid,
}, {
    label: 'applyBackground',
    apply: applyBackground,
    field: 'backgroundColor',
    invalid: colorInvalid,
}, {
    label: 'applySrc',
    apply: applySrc,
    field: 'src',
    invalid: addressInvalid,
}, {
    label: 'applyHref',
    apply: applyHref,
    field: 'href',
    invalid: addressInvalid,
}, ];

// 字段名 → 其错误元素 id（控件 id + 'Err'）。
function errorElementId(field) {
    return errId(FIELD_CONTROL_IDS[field]);
}

// ---------------------------------------------------------------------------
// 属性
// ---------------------------------------------------------------------------

describe('Property 16: 非法输入被拒绝且无副作用 (src/property-panel.js)', () => {
    // Feature: html-visual-editor, Property 16: 非法输入被拒绝且无副作用
    it('任意非法输入 → apply* 返回 {ok:false}、不发送 update、并显示字段级错误提示', () => {
        for (const c of FIELD_CASES) {
            fc.assert(
                fc.property(c.invalid, (badValue) => {
                    const root = createPanelFragment(document);

                    // 安装一个全新的发送侦听器（spy），记录是否发生下行发送。
                    let sendCalls = 0;
                    let lastMessage = null;
                    setSender((msg) => {
                        sendCalls += 1;
                        lastMessage = msg;
                    });
                    // 选中状态对 apply* 无影响，此处显式置真以排除其干扰。
                    setHasSelection(true);

                    let result;
                    try {
                        result = c.apply(badValue, root);
                    } finally {
                        // 迭代间重置发送函数，避免泄漏到下一用例。
                        setSender(null);
                    }

                    // 1) 非法输入被拒绝。
                    expect(result).toBeTruthy();
                    expect(result.ok).toBe(false);

                    // 2) 无副作用：未发送任何 update 消息。
                    expect(sendCalls).toBe(0);
                    expect(lastMessage).toBe(null);

                    // 3) 显示字段级无效提示：对应错误元素 textContent 非空。
                    const errEl = root.querySelector('#' + errorElementId(c.field));
                    expect(errEl).toBeTruthy();
                    expect(errEl.textContent.length).toBeGreaterThan(0);
                }), {
                    numRuns: 150,
                }
            );
        }
    });
});

// ---------------------------------------------------------------------------
// 正向对照（sanity controls）
//
// 确保 apply* 在合法输入下确实会发送 update（sender 被调用恰好一次），从而保证
// 上面「非法输入不发送」的断言是有意义的，而非因 sender 从不被调用而平凡成立。
// ---------------------------------------------------------------------------

describe('正向对照：合法输入 → apply* 发送 update 恰好一次', () => {
    const POSITIVE_CASES = [{
        label: 'applyFontSize',
        apply: applyFontSize,
        value: '16',
        prop: 'fontSize',
        val: '16px',
    }, {
        label: 'applyPadding',
        apply: applyPadding,
        value: '0',
        prop: 'padding',
        val: '0px',
    }, {
        label: 'applyRadius',
        apply: applyRadius,
        value: '8',
        prop: 'borderRadius',
        val: '8px',
    }, {
        label: 'applyWidth',
        apply: applyWidth,
        value: '50%',
        prop: 'width',
        val: '50%',
    }, {
        label: 'applyHeight',
        apply: applyHeight,
        value: '250px',
        prop: 'height',
        val: '250px',
    }, {
        label: 'applyColor',
        apply: applyColor,
        value: '#abc',
        prop: 'color',
        val: '#aabbcc',
    }, {
        label: 'applyBackground',
        apply: applyBackground,
        value: '#FFFFFF',
        prop: 'backgroundColor',
        val: '#ffffff',
    }, {
        label: 'applySrc',
        apply: applySrc,
        value: 'https://example.com/a.png',
        prop: 'src',
        val: 'https://example.com/a.png',
    }, {
        label: 'applyHref',
        apply: applyHref,
        value: 'https://example.com/page',
        prop: 'href',
        val: 'https://example.com/page',
    }, ];

    for (const c of POSITIVE_CASES) {
        it(`${c.label}('${c.value}') → ok:true 且发送一次 update`, () => {
            const root = createPanelFragment(document);
            const sent = [];
            setSender((msg) => sent.push(msg));
            try {
                const result = c.apply(c.value, root);
                expect(result.ok).toBe(true);
                expect(sent).toHaveLength(1);
                expect(sent[0]).toEqual({
                    type: 'update',
                    prop: c.prop,
                    val: c.val,
                });
            } finally {
                setSender(null);
            }
        });
    }
});