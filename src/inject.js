// inject.js — 注入脚本拼接与注入（需求 2.3）
//
// 通过 .toString() 把编辑器函数源码拼接为 <script> 文本，注入到用户 HTML 中。
// 保证产物里 id="__htmledit__" 的 <script> 恰好出现一次（幂等，Property 7）。
//
// 本模块仅做纯字符串处理，可独立测试：不依赖具体的注入脚本实现
// （src/injected-script.js 由其他任务实现）。调用方可把编辑器函数作为参数传入，
// 未传入时使用本文件内的占位函数，便于独立测试。

export const INJECTED_SCRIPT_ID = '__htmledit__';

// 占位的编辑器函数：仅用于本模块独立测试，真实实现来自 src/injected-script.js。
// buildEditorScript 默认使用它，使 inject.js 不依赖其他模块即可被测试。
function __placeholderEditorFn() {
    /* placeholder injected editor body — replaced by the real editor function */
}

// 构造匹配「带 id="__htmledit__" 的 <script>…</script>」的正则。
// 说明（幂等策略）：
//  - 采用基于 id 的字符串正则，对属性顺序鲁棒：<script ...>、<script id=...>、
//    或把 id 写在其他属性之后均可匹配（`[^>]*` 跨越开标签内的其他属性）。
//  - 引号同时支持单/双引号（反向引用 \1 保证成对）。
//  - 标签名大小写不敏感（i 标志），并兼容 </script > 这类带空白的结束标签。
//  - 脚本体使用非贪婪 `[\s\S]*?`，匹配到第一个 </script> 结束，避免吞掉后续内容。
//  - 每次调用都新建正则，避免 /g 的 lastIndex 状态在多次调用间互相影响。
function injectedScriptRegex() {
    return /<script\b[^>]*\bid\s*=\s*(["'])__htmledit__\1[^>]*>[\s\S]*?<\/script\s*>/gi;
}

// 统计 HTML 文本中 id="__htmledit__" 的 <script> 节点数量。
export function countInjectedScripts(html) {
    const input = typeof html === 'string' ? html : '';
    const matches = input.match(injectedScriptRegex());
    return matches ? matches.length : 0;
}

// 移除 HTML 文本中所有 id="__htmledit__" 的 <script> 节点（用于注入前去重，保证幂等）。
export function stripInjectedScript(html) {
    const input = typeof html === 'string' ? html : '';
    return input.replace(injectedScriptRegex(), '');
}

// 以 '(' + editorFn.toString() + ')()' 拼接脚本体，并把 <script> 标签拆写为
// '<scri'+'pt id="__htmledit__">'（结束标签同样拆写为 '</scri'+'pt>'），
// 防止 HTML 解析器在解析编辑器自身脚本块时提前闭合。
// editorFn 可为函数或已序列化的函数源码字符串；缺省时使用本文件内的占位函数。
export function buildEditorScript(editorFn = __placeholderEditorFn) {
    const source =
        typeof editorFn === 'function' || typeof editorFn === 'string' ?
        editorFn.toString() :
        String(editorFn);
    const body = '(' + source + ')()';
    return '<scri' + 'pt id="' + INJECTED_SCRIPT_ID + '">' + body + '</scri' + 'pt>';
}

// 将注入脚本插入用户 HTML：
//  1. 先移除已存在的 __htmledit__ 脚本（幂等：无论输入是否已含同 id 节点）。
//  2. 优先在 </body> 前插入；无 </body> 则追加到末尾。
// 返回注入后的 HTML 文本，其中 id="__htmledit__" 的 <script> 恰好一个（Property 7）。
export function injectInto(rawHtml, scriptString) {
    const html = typeof rawHtml === 'string' ? rawHtml : '';
    const script = typeof scriptString === 'string' ? scriptString : '';
    const stripped = stripInjectedScript(html);

    // 在第一个 </body>（大小写不敏感、兼容 </body >）之前插入。
    const bodyClose = stripped.match(/<\/body\s*>/i);
    if (bodyClose) {
        const idx = bodyClose.index;
        return stripped.slice(0, idx) + script + '\n' + stripped.slice(idx);
    }
    return stripped + '\n' + script;
}

// 便捷封装：构造脚本并注入到 rawHtml（保留 buildEditorScript + injectInto 的组合）。
// 兼容此前骨架导出的 injectScript 名称，避免并行任务的导入失效。
export function injectScript(rawHtml, editorFn = __placeholderEditorFn) {
    return injectInto(rawHtml, buildEditorScript(editorFn));
}