// 冒烟测试：一次性配置检查（任务 12.2）
//
// 目标：对交付物单文件 html-editor.html 做「一次性配置」类静态检查。这些验收标准
// 不适合属性测试（依赖浏览器原生行为或属于一次性配置），按 design.md「Testing Strategy
// · 冒烟测试」以静态/代码审查方式确认：
//   - 需求 2.2：预览 iframe 固定 sandbox="allow-scripts allow-same-origin"。
//   - 需求 6.1：颜色读取使用 getComputedStyle 获取计算后颜色值。
//   - 需求 2.4：注入脚本仅经 postMessage 通信，不直接访问父页面 DOM。
//
// 实现方式：把交付物 html-editor.html（及开发期 src/injected-script.js）作为「文本」
// 用 Node fs 读取后做正则/子串静态断言。不依赖渲染引擎，纯文本层面校验配置常量与
// 受控通信通道。运行环境：vitest + jsdom（本测试只用到 Node fs，与环境无关）。
//
// Validates: Requirements 2.2, 2.4, 6.1

import {
    describe,
    it,
    expect
} from 'vitest';
import {
    readFileSync
} from 'node:fs';
import {
    resolve
} from 'node:path';

// 从工作区根解析交付物路径：vitest 以 package.json 所在目录（工作区根）为 cwd 运行，
// 故 process.cwd() 指向工作区根，可稳定定位 html-editor.html 与 src/。
const htmlEditorPath = resolve(process.cwd(), 'html-editor.html');
const injectedScriptPath = resolve(process.cwd(), 'src', 'injected-script.js');

const htmlEditorSource = readFileSync(htmlEditorPath, 'utf8');
const injectedScriptSource = readFileSync(injectedScriptPath, 'utf8');

describe('冒烟：一次性配置检查（html-editor.html 静态校验, 需求 2.2/2.4/6.1）', () => {
    // ---- 需求 2.2：iframe sandbox 配置 ----
    describe('需求 2.2 — 预览 iframe sandbox 属性', () => {
        it('previewFrame 的 iframe 标签 sandbox 等于 "allow-scripts allow-same-origin"', () => {
            // 在交付的 HTML 标记中匹配 id="previewFrame" 的 iframe，提取其 sandbox 属性值。
            const iframeMatch = htmlEditorSource.match(
                /<iframe\b[^>]*\bid="previewFrame"[^>]*>/
            );
            expect(iframeMatch).not.toBeNull();

            const iframeTag = iframeMatch[0];
            const sandboxMatch = iframeTag.match(/\bsandbox="([^"]*)"/);
            expect(sandboxMatch).not.toBeNull();
            // 必须严格等于约定值（既不缺权限也不多余权限）。
            expect(sandboxMatch[1]).toBe('allow-scripts allow-same-origin');
        });

        it('内联 preview-frame 模块的 SANDBOX 常量字符串为 "allow-scripts allow-same-origin"', () => {
            // 渲染接线写入 srcdoc 时使用的 SANDBOX 常量，确保运行期注入也用同一沙箱配置。
            expect(htmlEditorSource).toMatch(
                /var\s+SANDBOX\s*=\s*'allow-scripts allow-same-origin'\s*;/
            );
        });
    });

    // ---- 需求 6.1：颜色读取使用 getComputedStyle ----
    describe('需求 6.1 — 颜色读取使用 getComputedStyle', () => {
        it('html-editor.html 内联代码使用 getComputedStyle 读取计算后样式', () => {
            // getInfo / __editorFn 的 computedStyleOf 路径通过 getComputedStyle 读取颜色。
            const occurrences = htmlEditorSource.match(/getComputedStyle/g) || [];
            expect(occurrences.length).toBeGreaterThanOrEqual(1);
        });

        it('开发期 src/injected-script.js 同样使用 getComputedStyle', () => {
            expect(injectedScriptSource).toMatch(/getComputedStyle/);
        });
    });

    // ---- 需求 2.4：注入脚本不直接访问父页面 DOM ----
    describe('需求 2.4 — 注入脚本仅经 postMessage 通信、不访问父页面 DOM', () => {
        it('交付文件不包含 parent.document 直接访问', () => {
            // 注入函数 __editorFn 运行在 sandbox iframe 内，禁止跨上下文读写父页面 DOM。
            // 采用整文件级断言更稳健：交付物中任何位置都不应出现 parent.document。
            expect(htmlEditorSource).not.toMatch(/parent\s*\.\s*document/);
        });

        it('交付文件不包含 top.document 直接访问', () => {
            expect(htmlEditorSource).not.toMatch(/top\s*\.\s*document/);
        });

        it('交付文件不包含 window.parent.document 直接访问', () => {
            expect(htmlEditorSource).not.toMatch(/window\s*\.\s*parent\s*\.\s*document/);
        });

        it('注入脚本使用受控的 postMessage 通道与 Editor 通信', () => {
            // postMessage 是注入脚本与编辑器双向通信的唯一受控通道（design 安全边界）。
            expect(htmlEditorSource).toMatch(/postMessage/);
        });
    });

    // ---- 零依赖完整性（单文件可 file:// 直接打开，无外部资源） ----
    describe('零依赖完整性 — 无外部脚本/样式引用', () => {
        it('不包含任何外部 <script src=...> 引用', () => {
            // 整文件级断言：交付物为单文件内联，所有逻辑在内联 <script> 中，无外链脚本。
            // 注：DEMO_HTML 等内联字符串中也不存在 `<script src=` 子串，断言稳健无误报。
            expect(htmlEditorSource).not.toMatch(/<script\s+src=/i);
        });

        it('不包含任何外部 <link ...> 样式引用', () => {
            // 交付物的样式全部内联于 <style> 中；无 <link> 外链（含 stylesheet）。
            // 注：DEMO_HTML 内联字符串中也不存在 `<link ` 子串，断言稳健无误报。
            expect(htmlEditorSource).not.toMatch(/<link\s/i);
        });
    });
});