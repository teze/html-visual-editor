// 属性测试：属性面板回填一致性（Property 9）
//
// 对任意 SelectedElementInfo，调用 fillForm(info, root) 后，属性面板各控件显示的值
// 应与 info 对应字段一致：
//   - pText      = innerText
//   - pFontSize  = String(fontSize)（fontSize 为有限整数时）
//   - pColorTxt  = color，pBgTxt = backgroundColor（颜色 Hex 文本框）
//   - pColor / pBg（input[type=color]）仅当对应 hex 为 6 位 #rrggbb 时同步
//   - pWidth     = width，pHeight = height
//   - 控件可见性：IMG 显示 grpImg 并预填 pSrc、隐藏 grpText；
//                 A   显示 grpLink 并预填 pHref；其他文字元素显示 grpText
//
// Feature: html-visual-editor, Property 9: 属性面板回填一致性
//
// Validates: Requirements 3.5, 7.1, 7.4

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';
import {
    fillForm,
    createPanelFragment
} from '../src/property-panel.js';

// --- 生成器 -----------------------------------------------------------------

// 字体粗细可选枚举（与 property-panel.js 中 FONT_WEIGHT_OPTIONS 保持一致）。
const FONT_WEIGHT_OPTIONS = ['300', '400', '500', '600', '700', '900'];

// 6 位 Hex 正则（颜色选择器仅同步 6 位 #rrggbb）。
const HEX6 = /^#[0-9a-f]{6}$/;

// 小写十六进制位。
const hexDigit = fc.constantFrom(...'0123456789abcdef'.split(''));

// 6 位小写 #rrggbb。
const hex6 = fc
    .tuple(hexDigit, hexDigit, hexDigit, hexDigit, hexDigit, hexDigit)
    .map((d) => '#' + d.join(''));

// 颜色字段：6 位小写 Hex 或空串（透明 / 无颜色）。
const colorArb = fc.oneof(hex6, fc.constant(''));

// 尺寸字段：空串、px 或百分比。
const sizeArb = fc.oneof(
    fc.constant(''),
    fc.integer({
        min: 0,
        max: 99999
    }).map((n) => n + 'px'),
    fc.integer({
        min: 0,
        max: 100
    }).map((n) => n + '%'),
);

// innerText：随机文本。剥离回车（textarea value getter 会把 CR/CRLF 规范化为 LF）。
const innerTextArb = fc
    .string({
        maxLength: 60
    })
    .map((s) => s.replace(/\r/g, ''));

// 地址字段：随机文本，剥离换行（text input 的 value 清洗会移除换行符）。
const addrArb = fc
    .string({
        maxLength: 40
    })
    .map((s) => s.replace(/[\r\n]/g, ''));

// 字体粗细：枚举值或空串（非枚举值会被回填逻辑清空为空串）。
const fontWeightArb = fc.oneof(fc.constantFrom(...FONT_WEIGHT_OPTIONS), fc.constant(''));

// SelectedElementInfo 生成器。
const infoArb = fc.record({
    tag: fc.constantFrom('DIV', 'P', 'SPAN', 'H1', 'A', 'IMG', 'BUTTON'),
    innerText: innerTextArb,
    fontSize: fc.integer({
        min: 1,
        max: 999
    }),
    fontWeight: fontWeightArb,
    color: colorArb,
    backgroundColor: colorArb,
    width: sizeArb,
    height: sizeArb,
    src: addrArb,
    href: addrArb,
});

// --- 属性 -------------------------------------------------------------------

describe('Property 9: 属性面板回填一致性 (src/property-panel.js)', () => {
    // Feature: html-visual-editor, Property 9: 属性面板回填一致性
    it('fillForm 后各控件显示值与 info 字段一致，且控件可见性符合标签规则', () => {
        fc.assert(
            fc.property(infoArb, (info) => {
                const root = createPanelFragment(document);
                fillForm(info, root);

                const val = (id) => root.querySelector('#' + id).value;
                const disp = (id) => root.querySelector('#' + id).style.display;

                const tag = info.tag.toUpperCase();
                const isImg = tag === 'IMG';
                const isA = tag === 'A';

                // 容器态：空态隐藏、表单显示。
                expect(disp('panelEmpty')).toBe('none');
                expect(disp('editForm')).toBe('block');

                // 标签徽章。
                expect(root.querySelector('#elBadge').textContent).toBe(
                    '<' + tag.toLowerCase() + '>'
                );

                // 文字内容。
                expect(val('pText')).toBe(info.innerText || '');

                // 字体大小：有限整数 → String(fontSize)。
                expect(val('pFontSize')).toBe(String(info.fontSize));

                // 字体粗细：枚举值原样显示，否则空串。
                const expectedWeight = FONT_WEIGHT_OPTIONS.indexOf(String(info.fontWeight)) >= 0 ?
                    String(info.fontWeight) :
                    '';
                expect(val('pFontWeight')).toBe(expectedWeight);

                // 颜色 Hex 文本框 = 原始颜色（可能为空串）。
                expect(val('pColorTxt')).toBe(info.color || '');
                expect(val('pBgTxt')).toBe(info.backgroundColor || '');

                // 颜色选择器：仅当对应 hex 为 6 位 #rrggbb 时同步。
                if (HEX6.test(info.color || '')) {
                    expect(val('pColor')).toBe(info.color);
                }
                if (HEX6.test(info.backgroundColor || '')) {
                    expect(val('pBg')).toBe(info.backgroundColor);
                }

                // 宽 / 高。
                expect(val('pWidth')).toBe(info.width || '');
                expect(val('pHeight')).toBe(info.height || '');

                // 控件可见性。
                expect(disp('grpImg')).toBe(isImg ? 'block' : 'none');
                expect(disp('grpLink')).toBe(isA ? 'block' : 'none');
                expect(disp('grpText')).toBe(isImg ? 'none' : 'block');

                // 专属控件预填。
                if (isImg) {
                    expect(val('pSrc')).toBe(info.src || '');
                }
                if (isA) {
                    expect(val('pHref')).toBe(info.href || '');
                }
            }), {
                numRuns: 200
            }
        );
    });
});