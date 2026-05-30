// 集成测试：端到端流程（任务 11.5，需求 10.1 / 10.7）
//
// 在 jsdom 下以「模块级」串联完整编辑链路，验证关键状态正确衔接：
//   1. 渲染（Render）：把样例 HTML 经 src/inject.js 的 injectInto + buildEditorScript
//      拼接为注入后的 srcdoc，写入 <iframe> 的 contentDocument，得到一个代表
//      「已加载 + 已注入」预览态的文档。
//   2. 编辑（Edit）：在该预览文档内模拟用户编辑——改文字、改内联样式、并给「选中」
//      元素打上编辑器视觉痕迹（data-saved-outline + 编辑态 outline/outline-offset/cursor），
//      模拟经注入脚本 onMessage(update) 路径施加的修改与选中边框。
//   3. 导出（Export）：经 src/exporter.js 的 cleanAndSerialize（以及 exportHtml 编排）
//      产出干净 HTML，断言 (a) 用户编辑被保留；(b) 不含 id="__htmledit__" 注入脚本；
//      (c) 不含编辑器添加的 outline/outline-offset/cursor 编辑态样式（需求 10.1/10.3/10.4/10.5）。
//   4. 重注入（Re-inject）：经 injectInto(cleanHtml, buildEditorScript()) 重新注入脚本，
//      断言注入脚本恰好恢复一个（可继续编辑），且用户编辑仍在（需求 10.7）。
//   5. 消息总线（MessageBus）接线契约：createMessageBus + spy handlers，经 onMessage /
//      dispatchUpMessage 投递 selected / changed 上行消息，断言对应 handler 被触发
//      （验证收发分发的接线契约，支撑 10.x 链路中编辑器侧的状态联动）。
//
// 这是端到端关键状态串联的模块级验证（不依赖真实渲染引擎与真实跨上下文 postMessage）：
// 渲染保真由 <iframe srcdoc> 原生渲染保证（见 integration.render-fidelity.test.js），
// 本文件聚焦「加载/注入 → 编辑 → 导出干净 → 重注入可继续编辑」的状态正确性。
//
// 运行环境：vitest + jsdom。
//
// Validates: Requirements 10.1, 10.7

import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
} from 'vitest';
import {
    injectInto,
    buildEditorScript,
    countInjectedScripts,
    INJECTED_SCRIPT_ID,
} from '../src/inject.js';
import {
    cleanAndSerialize,
    exportHtml,
    hasLoadedContent,
    SAVED_OUTLINE_ATTR,
    EXPORT_DONE_MESSAGE,
} from '../src/exporter.js';
import {
    createMessageBus,
    dispatchUpMessage,
} from '../src/message-bus.js';

// 编辑前的样例 HTML：含 <style>、<link rel="stylesheet"> 与内联样式，以及可编辑内容。
const SAMPLE_HTML = [
    '<!DOCTYPE html>',
    '<html lang="zh">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <title>端到端样例</title>',
    '  <link rel="stylesheet" href="theme.css">',
    '  <style>.box { color: #123456; }</style>',
    '</head>',
    '<body>',
    '  <h1 id="title" style="color: rgb(10, 20, 30);">原始标题 Original</h1>',
    '  <p id="para">原始正文 paragraph</p>',
    '  <div id="sel" class="box">可选中盒子 selectable</div>',
    '</body>',
    '</html>',
].join('\n');

// 用户编辑用的唯一可断言标记。
const EDITED_TITLE = 'EDITED_TITLE_42TOKEN';
const EDITED_TEXT = 'EDITED_PARA_TEXT_99TOKEN';
const EDITED_PADDING = '17px';

// 编辑器选中边框颜色（应在导出产物中被清除）。
const SELECT_OUTLINE = '2px solid #00d4aa';

function parse(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

// 步骤 1（Render）：把样例 HTML 注入脚本后写入 iframe.contentDocument，
// 返回 { iframe, idoc }。document.write 在 jsdom 下确定性地解析注入脚本节点。
function renderIntoIframe(rawHtml) {
    const srcdoc = injectInto(rawHtml, buildEditorScript());
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const idoc = iframe.contentDocument;
    idoc.open();
    idoc.write(srcdoc);
    idoc.close();
    return {
        iframe,
        idoc,
    };
}

// 步骤 2（Edit）：在预览文档内模拟用户编辑。
//   - #title：改文字（模拟内联编辑提交）。
//   - #para：改文字 + 设内联样式 padding（模拟一次成功的样式 update）。
//   - #sel：标记为「选中」——保存原始 outline 后施加编辑态 outline/outline-offset/cursor，
//     模拟选中边框的视觉痕迹（导出时应被清除）。
function applyUserEdits(idoc) {
    const title = idoc.getElementById('title');
    title.textContent = EDITED_TITLE;

    const para = idoc.getElementById('para');
    para.textContent = EDITED_TEXT;
    para.style.setProperty('padding', EDITED_PADDING);

    const sel = idoc.getElementById('sel');
    // 编辑器施加选中边框：先保存原始内联 outline（此处为空），再覆盖编辑态样式。
    sel.setAttribute(SAVED_OUTLINE_ATTR, '');
    sel.style.setProperty('outline', SELECT_OUTLINE);
    sel.style.setProperty('outline-offset', '1px');
    sel.style.setProperty('cursor', 'pointer');
}

describe('集成：端到端流程（Render → Edit → Export → Re-inject, 需求 10.1/10.7）', () => {
    let createdIframes;

    beforeEach(() => {
        createdIframes = [];
    });

    afterEach(() => {
        // 清理本测试创建的 iframe，避免跨用例污染。
        document.querySelectorAll('iframe').forEach((f) => f.remove());
        vi.restoreAllMocks();
    });

    it('渲染→编辑→导出(干净)→重注入：用户编辑保真、产物干净、可继续编辑', () => {
        // 1) Render：注入脚本并写入 iframe 文档。
        const {
            idoc,
        } = renderIntoIframe(SAMPLE_HTML);

        // 渲染后即处于「已加载 + 已注入」态：注入脚本恰好一个，已加载内容判定为真。
        expect(idoc.querySelectorAll('#' + INJECTED_SCRIPT_ID)).toHaveLength(1);
        expect(hasLoadedContent(idoc)).toBe(true);

        // 2) Edit：施加用户编辑（改文字 / 改样式 / 选中边框痕迹）。
        applyUserEdits(idoc);

        // 编辑确实落到活动文档上。
        expect(idoc.getElementById('title').textContent).toBe(EDITED_TITLE);
        expect(idoc.getElementById('para').style.padding).toBe(EDITED_PADDING);
        expect(idoc.getElementById('sel').getAttribute(SAVED_OUTLINE_ATTR)).toBe('');

        // 3) Export：清理 + 序列化得到干净 HTML（cleanAndSerialize 会就地清理活动文档）。
        const cleanHtml = cleanAndSerialize(idoc);
        const cleanDoc = parse(cleanHtml);

        // (a) 用户编辑被保留：改后的文字与内联样式都在干净产物里。
        expect(cleanDoc.getElementById('title').textContent).toBe(EDITED_TITLE);
        expect(cleanDoc.getElementById('para').textContent).toBe(EDITED_TEXT);
        expect(cleanDoc.getElementById('para').style.padding).toBe(EDITED_PADDING);

        // 渲染保真亦贯穿导出：原始 <style>/<link> 仍在。
        expect(cleanDoc.querySelectorAll('style')).toHaveLength(1);
        expect(cleanDoc.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(1);

        // (b) 产物干净：不含 id="__htmledit__" 注入脚本。
        expect(countInjectedScripts(cleanHtml)).toBe(0);
        expect(cleanHtml).not.toContain(INJECTED_SCRIPT_ID);

        // (c) 产物干净：不含编辑器添加的 outline/outline-offset/cursor 编辑态样式与选中边框颜色。
        const cleanSel = cleanDoc.getElementById('sel');
        expect(cleanSel.getAttribute(SAVED_OUTLINE_ATTR)).toBeNull();
        const selStyle = cleanSel.getAttribute('style') || '';
        expect(selStyle).not.toContain('outline-offset');
        expect(selStyle).not.toContain('cursor');
        expect(cleanHtml).not.toContain('#00d4aa');
        expect(cleanHtml).not.toContain('outline-offset');
        expect(cleanHtml).not.toContain(SAVED_OUTLINE_ATTR);

        // 4) Re-inject：重注入脚本，恢复可继续编辑（注入脚本恰好一个），用户编辑仍在（需求 10.7）。
        const reinjected = injectInto(cleanHtml, buildEditorScript());
        expect(countInjectedScripts(reinjected)).toBe(1);
        expect(reinjected).toContain(EDITED_TITLE);
        expect(reinjected).toContain(EDITED_TEXT);

        const reinjectedDoc = parse(reinjected);
        expect(reinjectedDoc.querySelectorAll('#' + INJECTED_SCRIPT_ID)).toHaveLength(1);
        expect(reinjectedDoc.getElementById('para').style.padding).toBe(EDITED_PADDING);
    });

    it('exportHtml 编排：触发一次 .html 下载、提示已导出，并在 1 秒内重注入恢复可编辑（10.7）', () => {
        // 下载副作用脚手架：jsdom 无 URL.createObjectURL，且 anchor.click 不真正下载。
        const capturedDownloads = [];
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        const originalAnchorClick = HTMLAnchorElement.prototype.click;
        URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = vi.fn(() => {});
        HTMLAnchorElement.prototype.click = function() {
            capturedDownloads.push(this.download);
        };

        try {
            // 1) Render + 2) Edit。
            const {
                iframe,
                idoc,
            } = renderIntoIframe(SAMPLE_HTML);
            applyUserEdits(idoc);

            // 重注入回调：模拟 preview-frame.render —— 导出后重新注入脚本，恢复 iframe 可编辑态。
            // cleanAndSerialize 已就地清理活动文档（移除注入脚本、清除编辑态样式），用户编辑仍在该文档中，
            // 故此处对活动文档的当前 HTML 重新注入即可代表「保留全部修改 + 恢复可编辑」。
            const reinject = vi.fn(() => {
                const again = injectInto(idoc.documentElement.outerHTML, buildEditorScript());
                idoc.open();
                idoc.write(again);
                idoc.close();
            });
            const onStatus = vi.fn();
            const onError = vi.fn();

            // 用同步计时器注入点使重注入确定性发生（远 < 1 秒）。
            const syncSetTimeout = (fn) => {
                fn();
                return 0;
            };

            // 3) Export 编排：内容已加载（hasContent=true），清理+序列化+下载+安排重注入。
            const exported = exportHtml(iframe, {
                filename: 'e2e-output',
                hasContent: () => true,
                reinject,
                onStatus,
                onError,
                setTimeoutFn: syncSetTimeout,
            });

            // 导出成功：返回干净 HTML 文本，含用户编辑、不含注入脚本。
            expect(typeof exported).toBe('string');
            expect(exported).toContain(EDITED_TITLE);
            expect(exported).toContain(EDITED_TEXT);
            expect(countInjectedScripts(exported)).toBe(0);

            // 触发恰好一次 .html 下载。
            expect(capturedDownloads).toHaveLength(1);
            expect(capturedDownloads[0].endsWith('.html')).toBe(true);
            expect(capturedDownloads[0]).toBe('e2e-output.html');

            // 导出成功状态提示，且未触发错误。
            expect(onStatus).toHaveBeenCalledWith(EXPORT_DONE_MESSAGE);
            expect(onError).not.toHaveBeenCalled();

            // 重注入（10.7）：经同步计时器确定性发生过一次，恢复可继续编辑。
            // reinject 把干净文档重新注入脚本，故 iframe 文档中注入脚本恰好恢复一个，用户编辑仍在。
            expect(reinject).toHaveBeenCalledTimes(1);
            expect(idoc.querySelectorAll('#' + INJECTED_SCRIPT_ID)).toHaveLength(1);
            expect(idoc.getElementById('title').textContent).toBe(EDITED_TITLE);
            expect(idoc.getElementById('para').style.padding).toBe(EDITED_PADDING);
        } finally {
            // 还原被 stub 的全局 API。
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
        }
    });

    it('exportHtml 编排：reinject 经注入计时器在导出后被调用一次（恢复可继续编辑）', () => {
        // 单独、清晰地断言 reinject 被编排调用一次（10.7 的「重注入」接线契约）。
        const capturedDownloads = [];
        const originalCreateObjectURL = URL.createObjectURL;
        const originalAnchorClick = HTMLAnchorElement.prototype.click;
        URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = vi.fn(() => {});
        HTMLAnchorElement.prototype.click = function() {
            capturedDownloads.push(this.download);
        };

        try {
            const {
                iframe,
                idoc,
            } = renderIntoIframe(SAMPLE_HTML);
            applyUserEdits(idoc);

            const reinject = vi.fn();
            const syncSetTimeout = (fn) => {
                fn();
                return 0;
            };

            const exported = exportHtml(iframe, {
                hasContent: () => true,
                reinject,
                setTimeoutFn: syncSetTimeout,
            });

            expect(typeof exported).toBe('string');
            // 重注入回调恰好被编排调用一次。
            expect(reinject).toHaveBeenCalledTimes(1);
            expect(capturedDownloads).toHaveLength(1);
        } finally {
            if (originalCreateObjectURL === undefined) {
                delete URL.createObjectURL;
            } else {
                URL.createObjectURL = originalCreateObjectURL;
            }
            HTMLAnchorElement.prototype.click = originalAnchorClick;
        }
    });

    it('MessageBus 接线契约：selected / changed 上行消息触发对应 handler', () => {
        // 编辑器侧 handler 探针（spy）。
        const onSelected = vi.fn();
        const onChanged = vi.fn();
        const onDeleted = vi.fn();
        const handlers = {
            onSelected,
            onChanged,
            onDeleted,
        };

        const bus = createMessageBus({
            handlers,
        });

        // 经 bus.onMessage 投递 selected（携带 info）与 changed。
        const info = {
            tag: 'DIV',
            innerText: 'hello',
            color: '#123456',
        };
        bus.onMessage({
            data: {
                type: 'selected',
                info,
            },
        });
        bus.onMessage({
            data: {
                type: 'changed',
            },
        });

        // selected → onSelected(info)；changed → onChanged()。
        expect(onSelected).toHaveBeenCalledTimes(1);
        expect(onSelected).toHaveBeenCalledWith(info);
        expect(onChanged).toHaveBeenCalledTimes(1);
        expect(onDeleted).not.toHaveBeenCalled();

        // 非法 / 未知上行消息被静默忽略（不触发任何 handler）。
        bus.onMessage({
            data: {
                type: 'bogus-type',
            },
        });
        bus.onMessage({
            data: null,
        });
        expect(onSelected).toHaveBeenCalledTimes(1);
        expect(onChanged).toHaveBeenCalledTimes(1);

        // 纯函数 dispatchUpMessage 亦满足同样的分发契约。
        const dispatched = dispatchUpMessage({
            type: 'changed',
        }, handlers);
        expect(dispatched).toBe('changed');
        expect(onChanged).toHaveBeenCalledTimes(2);
    });
});