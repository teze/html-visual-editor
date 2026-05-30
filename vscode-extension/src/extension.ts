import * as vscode from 'vscode';
import { HtmlVisualEditorProvider } from './htmlVisualEditorProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('HTML 可视化编辑器插件已激活');

    // 注册自定义编辑器
    const provider = new HtmlVisualEditorProvider(context);
    const registration = vscode.window.registerCustomEditorProvider(
        'htmlVisualEditor.editor',
        provider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        }
    );

    context.subscriptions.push(registration);

    // 注册命令：用可视化编辑器打开
    const openEditorCommand = vscode.commands.registerCommand(
        'htmlVisualEditor.openEditor',
        async (uri?: vscode.Uri) => {
            if (!uri && vscode.window.activeTextEditor) {
                uri = vscode.window.activeTextEditor.document.uri;
            }
            if (uri) {
                await vscode.commands.executeCommand(
                    'vscode.openWith',
                    uri,
                    'htmlVisualEditor.editor'
                );
            }
        }
    );

    context.subscriptions.push(openEditorCommand);
}

export function deactivate() {
    console.log('HTML 可视化编辑器插件已停用');
}
