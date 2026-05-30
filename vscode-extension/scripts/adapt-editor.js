/**
 * 适配脚本：将原始 html-editor.html 改造为适合 VS Code webview 的版本
 * 
 * 主要修改：
 * 1. 移除文件打开/导出按钮（VS Code 负责文件操作）
 * 2. 添加 VS Code API 集成
 * 3. 暴露必要的接口供 VS Code 调用
 */

const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../../html-editor.html');
const targetFile = path.join(__dirname, '../media/editor.html');

console.log('正在适配编辑器...');

// 读取原始文件
let html = fs.readFileSync(sourceFile, 'utf8');

// 1. 修改顶栏：隐藏文件操作按钮
html = html.replace(
    /<button class="tbtn" id="openBtn">.*?<\/button>/s,
    '<button class="tbtn" id="openBtn" style="display:none">📂 打开文件</button>'
);

html = html.replace(
    /<input type="file" id="fileIn".*?>/,
    '<input type="file" id="fileIn" accept=".html,.htm" style="display:none">'
);

html = html.replace(
    /<button class="tbtn" id="demoBtn">.*?<\/button>/,
    '<button class="tbtn" id="demoBtn" style="display:none">✨ 示例页面</button>'
);

// 2. 在 </body> 前添加 VS Code 集成接口
const vscodeIntegration = `
<script>
// ============================================================================
// VS Code 集成层
// ============================================================================
(function() {
    'use strict';
    
    // 获取 VS Code API
    const vscode = acquireVsCodeApi();
    
    // 标记编辑器已初始化
    window.editorInitialized = false;
    
    // 等待编辑器核心初始化完成
    const waitForEditor = setInterval(() => {
        // 检查核心模块是否已加载
        if (typeof window.__editorCore !== 'undefined') {
            clearInterval(waitForEditor);
            initVSCodeIntegration();
        }
    }, 50);
    
    function initVSCodeIntegration() {
        console.log('VS Code 集成层初始化');
        
        // 暴露加载内容接口
        window.loadHTMLContent = function(html) {
            console.log('加载 HTML 内容');
            // 模拟文件加载
            if (window.__editorCore && window.__editorCore.loadHTML) {
                window.__editorCore.loadHTML(html);
            }
        };
        
        // 暴露获取当前 HTML 接口
        window.getCurrentHTML = function() {
            if (window.__editorCore && window.__editorCore.exportHTML) {
                return window.__editorCore.exportHTML();
            }
            return '';
        };
        
        // 暴露状态更新接口
        window.updateStatus = function(message) {
            const statusText = document.getElementById('statusText');
            if (statusText) {
                statusText.textContent = message;
            }
        };
        
        // 拦截原有的导出功能
        const originalExportBtn = document.getElementById('exportBtn');
        if (originalExportBtn) {
            originalExportBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const html = window.getCurrentHTML();
                vscode.postMessage({
                    type: 'update',
                    content: html
                });
                
                window.updateStatus('已保存');
                
                // 2秒后恢复状态
                setTimeout(() => {
                    window.updateStatus('就绪');
                }, 2000);
            });
        }
        
        // 监听编辑变化，触发自定义事件
        let changeTimeout;
        const originalIncrement = window.__changeCounter?.increment;
        if (originalIncrement) {
            window.__changeCounter.increment = function() {
                originalIncrement.call(window.__changeCounter);
                
                // 触发变化事件
                window.dispatchEvent(new CustomEvent('editorChanged'));
                
                // 延迟自动保存
                clearTimeout(changeTimeout);
                changeTimeout = setTimeout(() => {
                    const html = window.getCurrentHTML();
                    vscode.postMessage({
                        type: 'update',
                        content: html
                    });
                }, 2000);
            };
        }
        
        // 标记初始化完成
        window.editorInitialized = true;
        
        // 通知 VS Code 已就绪
        vscode.postMessage({ type: 'ready' });
    }
    
    // 监听来自 VS Code 的消息
    window.addEventListener('message', (event) => {
        const message = event.data;
        
        switch (message.type) {
            case 'init':
                // 接收初始内容
                if (window.loadHTMLContent) {
                    window.loadHTMLContent(message.content);
                }
                break;
                
            case 'documentChanged':
                // 文档在外部被修改
                if (confirm('文件已在外部修改，是否重新加载？')) {
                    if (window.loadHTMLContent) {
                        window.loadHTMLContent(message.content);
                    }
                }
                break;
        }
    });
    
    // 错误处理
    window.addEventListener('error', (event) => {
        vscode.postMessage({
            type: 'error',
            message: event.message || '未知错误'
        });
    });
})();
</script>
`;

html = html.replace('</body>', vscodeIntegration + '\n</body>');

// 3. 确保 media 目录存在
const mediaDir = path.dirname(targetFile);
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, {
        recursive: true
    });
}

// 写入目标文件
fs.writeFileSync(targetFile, html, 'utf8');

console.log('✓ 编辑器适配完成');
console.log(`  源文件: ${sourceFile}`);
console.log(`  目标文件: ${targetFile}`);