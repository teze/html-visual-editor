// tests/exporter.nocontent.test.js
// 任务 8.5：无内容导出与下载文件名单元测试
//
// 验证 src/exporter.js：
//  - 无内容导出（需求 10.6）：未加载内容时取消导出，经 onError 提示
//    NO_CONTENT_MESSAGE（'无可导出内容'），不触发下载，返回 null；
//  - 下载文件名（需求 10.2）：导出已加载内容的 iframe 时触发一次 .html 下载，
//    且下载文件名以 '.html' 结尾（含自动补全扩展名）。
//
// 运行环境：vitest + jsdom。jsdom 缺少 URL.createObjectURL / revokeObjectURL，
// 故测试内以 stub 注入；通过 spy HTMLAnchorElement.prototype.click 捕获下载
// 触发与 anchor.download 文件名。
//
// _Requirements: 10.2, 10.6_

import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
} from 'vitest';
import {
    exportHtml,
    triggerDownload,
    NO_CONTENT_MESSAGE,
} from '../src/exporter.js';

// --- 下载捕获脚手架 ---------------------------------------------------------
// jsdom 默认无 URL.createObjectURL/revokeObjectURL，且 anchor.click 不会真正下载。
// 这里在测试期间 stub 这些 API，并 spy click 以捕获被触发下载的文件名。

let originalCreateObjectURL;
let originalRevokeObjectURL;
let originalAnchorClick;
let capturedDownloads;

beforeEach(() => {
    capturedDownloads = [];

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    originalAnchorClick = HTMLAnchorElement.prototype.click;

    // 提供可用的对象 URL stub（即便 jsdom 已实现也覆盖为确定性实现）。
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn(() => {});

    // spy 下载触发：捕获 anchor.download 文件名，不执行真实导航。
    HTMLAnchorElement.prototype.click = function() {
        capturedDownloads.push(this.download);
    };
});

afterEach(() => {
    // 还原被 stub 的全局 API，避免影响其他测试文件。
    if (originalCreateObjectURL === undefined) {
        delete URL.createObjectURL;
    } else {
        URL.createObjectURL = originalCreateObjectURL;
    }
    if (originalRevokeObjectURL === undefined) {
        delete URL.revokeObjectURL;
    } else {
        URL.revokeObjectURL = originalRevokeObjectURL;
    }
    HTMLAnchorElement.prototype.click = originalAnchorClick;

    vi.restoreAllMocks();
});

// --- 无内容导出（需求 10.6） -------------------------------------------------

describe('无内容导出处理（需求 10.6）', () => {
    it('hasContent 返回 false 时：经 onError 提示「无可导出内容」、不下载、返回 null', () => {
        const onError = vi.fn();
        const fakeIframe = {
            // 即便存在 contentDocument，hasContent 显式判定为「无内容」也应取消导出。
            contentDocument: document.implementation.createHTMLDocument('x'),
        };

        const result = exportHtml(fakeIframe, {
            hasContent: () => false,
            onError,
        });

        // 取消导出：返回 null。
        expect(result).toBeNull();

        // 经状态栏（onError）提示「无可导出内容」。
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(NO_CONTENT_MESSAGE);

        // 不触发任何下载。
        expect(capturedDownloads).toHaveLength(0);
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('无 contentDocument 且未提供 hasContent 时：同样取消导出并提示无可导出内容', () => {
        const onError = vi.fn();
        const emptyIframe = {
            contentDocument: null,
            contentWindow: null,
        };

        const result = exportHtml(emptyIframe, {
            onError,
        });

        expect(result).toBeNull();
        expect(onError).toHaveBeenCalledWith(NO_CONTENT_MESSAGE);
        expect(capturedDownloads).toHaveLength(0);
    });
});

// --- 下载文件名（需求 10.2） -------------------------------------------------

describe('下载文件名 .html（需求 10.2）', () => {
    it('exportHtml(iframe, "myfile") 触发一次下载，文件名以 .html 结尾', () => {
        // 构造一个含内容的真实 iframe（jsdom 提供 contentDocument）。
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        const idoc = iframe.contentDocument;
        idoc.body.innerHTML = '<div>USER CONTENT</div>';

        try {
            const result = exportHtml(iframe, 'myfile');

            // 成功导出返回干净 HTML 文本（非 null）。
            expect(typeof result).toBe('string');
            expect(result).toContain('USER CONTENT');

            // 恰好触发一次下载，且文件名以 .html 结尾、为补全后的 'myfile.html'。
            expect(capturedDownloads).toHaveLength(1);
            expect(capturedDownloads[0].endsWith('.html')).toBe(true);
            expect(capturedDownloads[0]).toBe('myfile.html');
        } finally {
            iframe.remove();
        }
    });

    it('已带 .html 扩展名时不重复追加', () => {
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        iframe.contentDocument.body.innerHTML = '<p>hi</p>';

        try {
            exportHtml(iframe, 'page.html');
            expect(capturedDownloads).toHaveLength(1);
            expect(capturedDownloads[0]).toBe('page.html');
        } finally {
            iframe.remove();
        }
    });

    it('triggerDownload 直接调用也产出 .html 文件名', () => {
        const ok = triggerDownload('<!DOCTYPE html><html></html>', 'report');

        expect(ok).toBe(true);
        expect(capturedDownloads).toHaveLength(1);
        expect(capturedDownloads[0].endsWith('.html')).toBe(true);
        expect(capturedDownloads[0]).toBe('report.html');
    });
});