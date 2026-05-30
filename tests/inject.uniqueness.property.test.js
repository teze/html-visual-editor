// 属性测试：注入脚本唯一性（Property 7）
//
// 验证 src/inject.js 的注入幂等性：对任意输入 HTML（无论其是否已包含
// 一个或多个 id="__htmledit__" 的 <script> 节点、属性顺序与引号如何变化），
// 经 injectInto(rawHtml, buildEditorScript()) 处理后的产物中，
// id="__htmledit__" 的 <script> 节点恰好出现一次。
//
// 附加断言（注入点行为）：
//  - 存在 </body> 时，注入脚本出现在第一个 </body> 之前；
//  - 不存在 </body> 时，注入脚本追加到末尾。

import {
    describe,
    it,
    expect
} from 'vitest';
import fc from 'fast-check';
import {
    buildEditorScript,
    injectInto,
    countInjectedScripts,
    INJECTED_SCRIPT_ID,
} from '../src/inject.js';

// --- 生成器 -----------------------------------------------------------------

// 安全文本：去除 '<' / '>'，保证随机文本不会意外构成标签（如 </body> 或 </script>）。
const safeText = fc
    .string({
        minLength: 0,
        maxLength: 40
    })
    .map((s) => s.replace(/[<>]/g, ''));

// 良性 markup 片段：均不含 </body>、</script> 或 __htmledit__，
// 用于制造「随机周边 markup」而不污染计数。
const markupSnippet = fc.constantFrom(
    '<div class="box">',
    '</div>',
    '<p>Hello World</p>',
    '<span>text</span>',
    '<h1>Title</h1>',
    '<header><nav>Menu</nav></header>',
    '<img src="a.png">',
    '<a href="#">link</a>',
    '<ul><li>item</li></ul>',
    '<!-- a comment -->',
    '<section>',
    '</section>',
    '<script src="vendor.js"></script>', // 非 __htmledit__ 脚本，不应被计入
    '\n',
    '   '
);

const chunk = fc.oneof(safeText, markupSnippet);
const content = fc
    .array(chunk, {
        minLength: 0,
        maxLength: 8
    })
    .map((arr) => arr.join(''));

// 预先存在的 __htmledit__ 脚本：变化引号（单/双）、属性顺序、'=' 周围空白、脚本体。
// 这些都应被 injectInto 在注入前剥离（幂等）。
const preExistingScript = fc
    .record({
        quote: fc.constantFrom('"', "'"),
        spaceAroundEq: fc.boolean(),
        extraBefore: fc.constantFrom('', ' type="text/javascript"', ' data-x="1"', ' defer'),
        extraAfter: fc.constantFrom('', ' nonce="abc"', ' data-y="2"'),
        body: fc.constantFrom('', 'console.log(1)', 'var a=2;', '/* old */', 'window.x=1'),
    })
    .map(({
        quote,
        spaceAroundEq,
        extraBefore,
        extraAfter,
        body
    }) => {
        const eq = spaceAroundEq ? ' = ' : '=';
        return (
            '<script' +
            extraBefore +
            ' id' +
            eq +
            quote +
            INJECTED_SCRIPT_ID +
            quote +
            extraAfter +
            '>' +
            body +
            '</script>'
        );
    });

// 完整 HTML 文档生成器：
//  - numScripts 控制预先存在的 __htmledit__ 脚本数量（0、1 或 2）；
//  - hasBodyClose 控制是否包含 </body>；
//  - pre/mid/post 为随机周边 markup 与文本。
const htmlArb = fc
    .record({
        pre: content,
        scripts: fc.array(preExistingScript, {
            minLength: 0,
            maxLength: 2
        }),
        mid: content,
        hasBodyClose: fc.boolean(),
        post: content,
    })
    .map(({
        pre,
        scripts,
        mid,
        hasBodyClose,
        post
    }) => {
        const inner = pre + scripts.join('') + mid;
        const html = hasBodyClose ?
            '<html><body>' + inner + '</body>' + post + '</html>' :
            '<div>' + inner + post + '</div>';
        return {
            html,
            hasBodyClose,
            numScripts: scripts.length
        };
    });

// --- 属性 -------------------------------------------------------------------

describe('Property 7: 注入脚本唯一性 (src/inject.js)', () => {
    // Feature: html-visual-editor, Property 7: 注入脚本唯一性
    it('注入产物中 id="__htmledit__" 的 <script> 恰好一个，且注入点正确', () => {
        fc.assert(
            fc.property(htmlArb, ({
                html,
                hasBodyClose
            }) => {
                const script = buildEditorScript();
                const output = injectInto(html, script);

                // 核心属性：注入脚本恰好出现一次。
                expect(countInjectedScripts(output)).toBe(1);

                // 注入的脚本字符串在产物中唯一出现（预先存在的同 id 节点已被剥离）。
                const scriptPos = output.indexOf(script);
                expect(scriptPos).toBeGreaterThanOrEqual(0);
                expect(output.indexOf(script, scriptPos + 1)).toBe(-1);

                // 附加断言：注入点行为。
                if (hasBodyClose) {
                    // 存在 </body> 时，注入脚本应出现在第一个 </body> 之前。
                    const bodyClosePos = output.search(/<\/body\s*>/i);
                    expect(bodyClosePos).toBeGreaterThanOrEqual(0);
                    expect(scriptPos).toBeLessThan(bodyClosePos);
                } else {
                    // 不存在 </body> 时，注入脚本应追加到末尾。
                    expect(output.endsWith(script)).toBe(true);
                }
            }), {
                numRuns: 200
            }
        );
    });

    // Feature: html-visual-editor, Property 7: 注入脚本唯一性
    it('即使输入已含 1~2 个同 id 脚本，去重后仍恰好一个', () => {
        const withExisting = fc
            .record({
                pre: content,
                scripts: fc.array(preExistingScript, {
                    minLength: 1,
                    maxLength: 2
                }),
                mid: content,
                hasBodyClose: fc.boolean(),
            })
            .map(({
                pre,
                scripts,
                mid,
                hasBodyClose
            }) => {
                const inner = pre + scripts.join('') + mid;
                return hasBodyClose ?
                    '<html><body>' + inner + '</body></html>' :
                    '<section>' + inner + '</section>';
            });

        fc.assert(
            fc.property(withExisting, (html) => {
                // 前置条件：输入确实已包含同 id 脚本。
                expect(countInjectedScripts(html)).toBeGreaterThanOrEqual(1);

                const output = injectInto(html, buildEditorScript());
                expect(countInjectedScripts(output)).toBe(1);
            }), {
                numRuns: 200
            }
        );
    });
});