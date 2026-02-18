const vscode = require('vscode');
const WebSocket = require('ws');

const WSS_URL = 'wss://chrisrogers.pyscriptapps.com/talking-on-a-channel/api/channels/hackathon';

function activate(context) {
    let disposable = vscode.commands.registerCommand('pyscript.sendCode', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor!');
            return;
        }

        // Get selected text, or entire file if nothing selected
        const selection = editor.selection;
        const code = selection.isEmpty
            ? editor.document.getText()
            : editor.document.getText(selection);

        const ws = new WebSocket(WSS_URL);

        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'code', payload: code }));
            ws.close();
            vscode.window.showInformationMessage('Code sent to PyScript!');
        });

        ws.on('error', (err) => {
            vscode.window.showErrorMessage(`WebSocket error: ${err.message}`);
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };