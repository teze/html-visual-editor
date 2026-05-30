import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * HTML 可视化编辑器提供者
 * 实现 CustomTextEditorProvider 接口，提供自定义编辑器功能
 */
export class HtmlVisualEditorProvider implements vscode.CustomTextEditorProvider {
    private static readonly viewType = 'htmlVisualEditor.editor';

    constructor(private readonly context: vscode.ExtensionContext) {}

    /**
     * 解析自定义编辑器
     */
    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // 配置 webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
            ],
        };

        // 设置 webview 内容
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

        // 监听文档变化
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                // 文档在外部被修改，通知 webview 更新
                webviewPanel.webview.postMessage({
                    type: 'documentChanged',
                    content: document.getText(),
                });
            }
        });

        // 监听 webview 消息
        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'ready':
                        // Webview 已就绪，发送初始内容
                        webviewPanel.webview.postMessage({
                            type: 'init',
                            content: document.getText(),
                        });
                        break;

                    case 'update':
                        // 编辑器内容更新，保存到文档
                        await this.updateTextDocument(document, message.content);
                        break;

                    case 'error':
                        vscode.window.showErrorMessage(
                            `HTML 编辑器错误: ${message.message}`
                        );
                        break;
                }
            },
            null,
            this.context.subscriptions
        );

        // 清理订阅
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    /**
     * 更新文档内容
     */
    private async updateTextDocument(
        document: vscode.TextDocument,
        content: string
    ): Promise<void> {
        const edit = new vscode.WorkspaceEdit();

        // 替换整个文档内容
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            content
        );

        await vscode.workspace.applyEdit(edit);
    }

    /**
     * 生成 webview 的 HTML 内容
     */
    private getHtmlForWebview(
        webview: vscode.Webview,
        document: vscode.TextDocument
    ): string {
        // 读取原始的 html-editor.html 文件
        const editorHtmlPath = path.join(
            this.context.extensionPath,
            '..',
            'html-editor.html'
        );

        let editorHtml = '';
        try {
            editorHtml = fs.readFileSync(editorHtmlPath, 'utf8');
        } catch (error) {
            vscode.window.showErrorMessage(
                `无法加载编辑器文件: ${error}`
            );
            return this.getErrorHtml('无法加载编辑器');
        }

        // 注入 VS Code 集成代码
        const vscodeIntegration = this.getVSCodeIntegration();

        // 在 </body> 前注入集成代码
        editorHtml = editorHtml.replace(
            '</body>',
            `${vscodeIntegration}</body>`
        );

        return editorHtml;
    }

    /**
     * 获取 VS Code 集成脚本
     */
    private getVSCodeIntegration(): string {
        return `
        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                let isReady = false;
                let pendingContent = null;

                // 通知 VS Code webview 已就绪
                window.addEventListener('DOMContentLoaded', () => {
                    vscode.postMessage({ type: 'ready' });
                });

                // 监听来自 VS Code 的消息
                window.addEventListener('message', (event) => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'init':
                            // 接收初始内容
                            loadContent(message.content);
                            isReady = true;
                            break;
                            
                        case 'documentChanged':
                            // 文档在外部被修改
                            if (confirm('文件已在外部修改，是否重新加载？')) {
                                loadContent(message.content);
                            }
                            break;
                    }
                });

                // 加载 HTML 内容到编辑器
                function loadContent(html) {
                    // 触发原有的文件加载逻辑
                    if (window.loadHTMLContent) {
                        window.loadHTMLContent(html);
                    } else {
                        // 如果编辑器还未初始化，保存内容待后续加载
                        pendingContent = html;
                    }
                }

                // 拦截导出功能，改为保存到 VS Code
                const originalExport = window.exportHTML;
                window.exportHTML = function(html) {
                    // 发送更新到 VS Code
                    vscode.postMessage({
                        type: 'update',
                        content: html
                    });
                    
                    // 显示保存成功提示
                    if (window.updateStatus) {
                        window.updateStatus('已保存到 VS Code');
                    }
                };

                // 监听编辑器初始化完成
                const checkInit = setInterval(() => {
                    if (window.editorInitialized && pendingContent) {
                        loadContent(pendingContent);
                        pendingContent = null;
                        clearInterval(checkInit);
                    }
                }, 100);

                // 自动保存：监听内容变化
                let saveTimeout;
                window.addEventListener('editorChanged', () => {
                    clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        if (window.getCurrentHTML) {
                            const html = window.getCurrentHTML();
                            vscode.postMessage({
                                type: 'update',
                                content: html
                            });
                        }
                    }, 1000); // 1秒后自动保存
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
    }

    /**
     * 生成错误页面 HTML
     */
    private getErrorHtml(message: string): string {
        return `
        <!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>错误</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    background: #1e1e1e;
                    color: #cccccc;
                }
                .error-container {
                    text-align: center;
                    padding: 40px;
                }
                .error-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                h1 {
                    font-size: 24px;
                    margin-bottom: 10px;
                    color: #f48771;
                }
                p {
                    font-size: 14px;
                    color: #999999;
                }
            </style>
        </head>
        <body>
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <h1>加载失败</h1>
                <p>${message}</p>
            </div>
        </body>
        </html>
        `;
    }
}
