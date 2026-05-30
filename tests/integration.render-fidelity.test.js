// 集成测试：渲染保真（任务 11.4，需求 2.1）
//
// 目标：验证 Preview_Frame 把用户 HTML 拼接注入脚本写入 srcdoc 的过程
// （src/preview-frame.js 的 buildSrcdoc，内部复用 src/inject.js）不会破坏
// 用户内容的样式与结构保真：
//   - 原始 <style> 节点数量在注入后保持不变；
//   - 原始 <link rel="stylesheet"> 节点数量在注入后保持不变；
//   - 带内联 style="..." 属性的元素数量与各自的 style 文本均被原样保留；
//   - 用户 <body> 的结构与文本内容未被破坏；
//   - 仅新增了恰好一个 id="__htmledit__" 的注入 <script>（注入幂等，Property 7）。
//
// 这是 UI 渲染保真类验收标准（2.1）的模块级集成验证：不依赖真实渲染引擎，
// 而是断言「注入产物的 srcdoc 文本」在 DOMParser 解析后样式节点与用户结构完好。
// 真实视觉一致性由浏览器对 <iframe srcdoc> 的原生渲染保证。
//
// 运行环境：vitest + jsdom（提供全局 DOMParser）。
//
// Validates: Requirements 2.1

import {
    describe,
    it,
    expect,
} from 'vitest';
import {
    buildSrcdoc,
} from '../src/preview-frame.js';
import {
    INJECTED_SCRIPT_ID,
} from '../src/inject.js';

// 平凡的编辑器函数工厂：buildSrcdoc 的第二参数是「零参工厂」，调用后返回
// 编辑器函数本身。这里返回一个空函数体，注入脚本体即 (function(){})()，
// 不含 </script>，不会污染解析或样式节点统计。
const trivialEditorProvider = () => function() {};

// 把 HTML 文本解析为 Document（text/html，jsdom 提供 DOMParser 全局）。
function parse(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

// 统计某选择器在文档中的节点数量。
function countOf(doc, selector) {
    return doc.querySelectorAll(selector).length;
}

// 收集所有带内联 style 属性的元素的 style 文本（保持文档顺序）。
function inlineStyles(doc) {
    return Array.from(doc.querySelectorAll('[style]')).map((el) =>
        el.getAttribute('style')
    );
}

describe('集成：渲染保真（buildSrcdoc 注入不破坏样式与结构, 需求 2.1）', () => {
    // 代表性用例 1：完整 HTML 文档，head 含 1 个 <style> + 1 个 <link>，
    // body 含多个带内联 style 的元素与嵌套结构/文本。
    it('保留 <style>/<link>/内联 style 节点数量与文本，且仅新增一个注入脚本', () => {
        const sampleHtml = [
            '<!DOCTYPE html>',
            '<html lang="zh">',
            '<head>',
            '  <meta charset="utf-8">',
            '  <title>样例页面</title>',
            '  <link rel="stylesheet" href="styles.css">',
            '  <style>.box { color: #123456; } h1 { font-size: 24px; }</style>',
            '</head>',
            '<body>',
            '  <header style="background-color: #eeeeee; padding: 16px;">',
            '    <h1 style="color: rgb(10, 20, 30);">标题 Title</h1>',
            '  </header>',
            '  <main>',
            '    <p style="font-size: 14px; text-align: center;">第一段 paragraph one</p>',
            '    <div class="box" style="border-radius: 8px;">盒子内容 box content</div>',
            '  </main>',
            '</body>',
            '</html>',
        ].join('\n');

        const originalDoc = parse(sampleHtml);
        const originalStyleCount = countOf(originalDoc, 'style');
        const originalLinkCount = countOf(originalDoc, 'link');
        const originalInlineStyles = inlineStyles(originalDoc);

        // 前置确认样例本身符合预期（1 个 style、1 个 link、4 个内联 style 元素）。
        expect(originalStyleCount).toBe(1);
        expect(originalLinkCount).toBe(1);
        expect(originalInlineStyles).toHaveLength(4);

        const srcdoc = buildSrcdoc(sampleHtml, trivialEditorProvider);
        const outputDoc = parse(srcdoc);

        // 1) <style> 节点数量与原始一致。
        expect(countOf(outputDoc, 'style')).toBe(originalStyleCount);

        // 2) <link> 节点数量与原始一致。
        expect(countOf(outputDoc, 'link')).toBe(originalLinkCount);

        // 3) 带内联 style 的元素数量与各自 style 文本均被原样保留（顺序一致）。
        expect(inlineStyles(outputDoc)).toEqual(originalInlineStyles);

        // 4) 用户 <body> 结构与文本未被破坏。
        const h1 = outputDoc.querySelector('header > h1');
        expect(h1).not.toBeNull();
        expect(h1.textContent).toBe('标题 Title');
        const paragraphs = outputDoc.querySelectorAll('main > p');
        expect(paragraphs).toHaveLength(1);
        expect(paragraphs[0].textContent).toBe('第一段 paragraph one');
        const box = outputDoc.querySelector('main > div.box');
        expect(box).not.toBeNull();
        expect(box.textContent).toBe('盒子内容 box content');

        // 5) 恰好新增一个 id="__htmledit__" 的注入脚本。
        const injected = outputDoc.querySelectorAll('script#' + INJECTED_SCRIPT_ID);
        expect(injected).toHaveLength(1);
        // 原始文档中不存在该注入脚本（确认是「新增」而非原本就有）。
        expect(countOf(originalDoc, 'script#' + INJECTED_SCRIPT_ID)).toBe(0);
    });

    // 代表性用例 2：更深的嵌套结构 + 多个内联样式 + 注释，验证保真在结构变化下成立。
    it('深层嵌套与多内联样式下仍保真，且注入脚本唯一', () => {
        const sampleHtml = [
            '<!DOCTYPE html>',
            '<html>',
            '<head>',
            '  <link rel="stylesheet" href="/assets/theme.css">',
            '  <style>',
            '    body { margin: 0; }',
            '    .card { display: block; }',
            '  </style>',
            '</head>',
            '<body>',
            '  <!-- 用户注释 user comment -->',
            '  <section class="wrap" style="max-width: 960px; margin: 0 auto;">',
            '    <article class="card" style="padding: 24px;">',
            '      <h2 style="color: rgb(0, 0, 0);">卡片标题 Card</h2>',
            '      <p>正文内容 body text</p>',
            '      <a href="https://example.com" style="color: #0066cc;">链接 link</a>',
            '    </article>',
            '  </section>',
            '</body>',
            '</html>',
        ].join('\n');

        const originalDoc = parse(sampleHtml);
        const originalStyleCount = countOf(originalDoc, 'style');
        const originalLinkCount = countOf(originalDoc, 'link');
        const originalInlineStyles = inlineStyles(originalDoc);

        expect(originalStyleCount).toBe(1);
        expect(originalLinkCount).toBe(1);
        expect(originalInlineStyles).toHaveLength(4);

        const srcdoc = buildSrcdoc(sampleHtml, trivialEditorProvider);
        const outputDoc = parse(srcdoc);

        // 样式节点数量保真。
        expect(countOf(outputDoc, 'style')).toBe(originalStyleCount);
        expect(countOf(outputDoc, 'link')).toBe(originalLinkCount);

        // 内联 style 文本逐项保真。
        expect(inlineStyles(outputDoc)).toEqual(originalInlineStyles);

        // 用户结构未被破坏：深层嵌套路径仍可命中且文本一致。
        const heading = outputDoc.querySelector('section.wrap > article.card > h2');
        expect(heading).not.toBeNull();
        expect(heading.textContent).toBe('卡片标题 Card');
        const link = outputDoc.querySelector('article.card > a');
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe('https://example.com');
        expect(link.textContent).toBe('链接 link');

        // 注入脚本恰好一个。
        expect(outputDoc.querySelectorAll('script#' + INJECTED_SCRIPT_ID)).toHaveLength(1);
    });
});