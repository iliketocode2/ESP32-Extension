"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const serialRepl_1 = require("./serialRepl");
let panel;
const serialManager = new serialRepl_1.SerialReplManager();
function activate(context) {
    serialManager.onData((chunk) => {
        console.log('[Serial RX]', JSON.stringify(chunk));
        if (panel?.webview) {
            panel.webview.postMessage({ type: 'serialData', data: chunk });
        }
    });
    context.subscriptions.push(vscode.commands.registerCommand('spike-serial-repl.open', () => {
        if (panel) {
            panel.reveal();
            return;
        }
        panel = vscode.window.createWebviewPanel('spike-serial-repl', 'Serial REPL', vscode.ViewColumn.One, { enableScripts: true });
        panel.webview.html = getWebviewContent();
        panel.webview.onDidReceiveMessage(handleWebviewMessage);
        panel.onDidDispose(() => {
            serialManager.disconnect();
            panel = undefined;
        });
    }));
}
async function handleWebviewMessage(msg) {
    if (!panel?.webview)
        return;
    try {
        switch (msg.type) {
            case 'listPorts': {
                const ports = await serialManager.listPorts();
                panel.webview.postMessage({ type: 'portList', ports });
                break;
            }
            case 'connect':
                if (msg.path) {
                    await serialManager.connect(msg.path, msg.baudRate ?? 115200);
                    panel.webview.postMessage({ type: 'connected' });
                }
                break;
            case 'disconnect':
                await serialManager.disconnect();
                panel.webview.postMessage({ type: 'disconnected' });
                break;
            case 'paste':
                if (msg.code !== undefined) {
                    console.log('[Serial TX] paste', msg.code.length, 'chars');
                    await serialManager.paste(msg.code);
                    panel.webview.postMessage({ type: 'pasteDone' });
                }
                break;
            case 'reset':
                console.log('[Serial TX] reset');
                await serialManager.reset();
                break;
            case 'interrupt':
                console.log('[Serial TX] Ctrl+C');
                await serialManager.interrupt();
                break;
            case 'raw':
                if (msg.raw !== undefined) {
                    console.log('[Serial TX] raw', msg.raw.length, 'chars');
                    await serialManager.sendRaw(msg.raw);
                }
                break;
            default:
                break;
        }
    }
    catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        panel.webview.postMessage({ type: 'error', message: err });
    }
}
function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-wrap: wrap;
    }
    .toolbar label { font-size: 12px; }
    .toolbar select {
      min-width: 180px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 4px 8px;
      font-size: 12px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      padding: 4px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.1));
      color: var(--vscode-button-secondaryForeground, inherit);
    }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .main {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 6px 1fr;
      min-height: 0;
      overflow: hidden;
    }
    .resizer {
      background: var(--vscode-panel-border);
      cursor: col-resize;
      width: 6px;
    }
    .pane {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .pane-header {
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .code-editor {
      flex: 1;
      min-height: 0;
      width: 100%;
      padding: 10px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 13px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: none;
      resize: none;
      outline: none;
    }
    .repl-output {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 10px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 13px;
      background: #1e1e1e;
      color: #d4d4d4;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .repl-tx { color: #6a9955; }
    .repl-rx { color: #d4d4d4; }
    .repl-log { color: #9cdcfe; opacity: 0.9; }
    .btn-row { display: flex; gap: 6px; flex-wrap: wrap; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); }
    .status { font-size: 11px; opacity: 0.8; padding: 4px 10px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <label>Port:</label>
    <select id="portSelect">
      <option value="">-- Select port --</option>
    </select>
    <button id="btnRefresh" class="secondary">Refresh</button>
    <button id="btnConnect">Connect</button>
    <button id="btnDisconnect" class="secondary" disabled>Disconnect</button>
    <span class="status" id="status">Disconnected</span>
  </div>
  <div class="main">
    <div class="pane">
      <div class="pane-header">Code</div>
      <div class="btn-row">
        <button id="btnRun">Run</button>
        <button id="btnReset" class="secondary" disabled>Reset</button>
        <button id="btnCtrlC" class="secondary" disabled>Ctrl+C</button>
      </div>
      <textarea id="codeEditor" class="code-editor" placeholder="# MicroPython code here&#10;print('hello')"># MicroPython code
print('hello from REPL')
</textarea>
    </div>
    <div id="resizer" class="resizer"></div>
    <div class="pane">
      <div class="pane-header">REPL output <span style="font-weight:normal;opacity:0.7">(green = sent, white = from device; use Ctrl+C to stop running code)</span></div>
      <pre id="replOutput" class="repl-output"></pre>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const portSelect = document.getElementById('portSelect');
    const btnRefresh = document.getElementById('btnRefresh');
    const btnConnect = document.getElementById('btnConnect');
    const btnDisconnect = document.getElementById('btnDisconnect');
    const btnRun = document.getElementById('btnRun');
    const btnReset = document.getElementById('btnReset');
    const btnCtrlC = document.getElementById('btnCtrlC');
    const codeEditor = document.getElementById('codeEditor');
    const replOutput = document.getElementById('replOutput');
    const statusEl = document.getElementById('status');

    let connected = false;

    function setConnected(value) {
      connected = value;
      btnConnect.disabled = value;
      btnDisconnect.disabled = !value;
      btnRun.disabled = !value;
      btnReset.disabled = !value;
      btnCtrlC.disabled = !value;
      statusEl.textContent = value ? 'Connected' : 'Disconnected';
    }

    function appendRepl(text, className) {
      var span = document.createElement('span');
      if (className) span.className = className;
      span.appendChild(document.createTextNode(text));
      replOutput.appendChild(span);
      replOutput.scrollTop = replOutput.scrollHeight;
    }
    function appendReplRaw(text) {
      appendRepl(text, 'repl-rx');
    }

    window.addEventListener('message', (e) => {
      const msg = e.data;
      switch (msg.type) {
        case 'portList':
          portSelect.options.length = 0;
          portSelect.appendChild(new Option('-- Select port --', ''));
          (msg.ports || []).forEach(p => {
            const label = p.manufacturer ? p.path + ' (' + p.manufacturer + ')' : p.path;
            portSelect.appendChild(new Option(label, p.path));
          });
          break;
        case 'connected':
          setConnected(true);
          appendRepl('\\n*** Connected ***\\n', 'repl-log');
          break;
        case 'disconnected':
          setConnected(false);
          appendRepl('\\n*** Disconnected ***\\n', 'repl-log');
          break;
        case 'serialData':
          appendRepl(msg.data || '', 'repl-rx');
          break;
        case 'pasteDone':
          appendRepl('\\n>>> Code sent.\\n', 'repl-log');
          break;
        case 'error':
          appendRepl('\\n[Error] ' + (msg.message || 'Unknown') + '\\n', 'repl-log');
          break;
      }
    });

    btnRefresh.onclick = () => vscode.postMessage({ type: 'listPorts' });
    btnConnect.onclick = () => {
      const path = portSelect.value;
      if (path) vscode.postMessage({ type: 'connect', path, baudRate: 115200 });
    };
    btnDisconnect.onclick = () => vscode.postMessage({ type: 'disconnect' });
    btnRun.onclick = () => {
      var code = codeEditor.value;
      if (!code.trim()) return;
      appendRepl('\\n>>> Running code:\\n', 'repl-log');
      appendRepl(code + '\\n', 'repl-tx');
      vscode.postMessage({ type: 'paste', code: code });
    };
    btnReset.onclick = () => {
      appendRepl('\\n>>> Reset sent\\n', 'repl-log');
      vscode.postMessage({ type: 'reset' });
    };
    btnCtrlC.onclick = () => {
      appendRepl('\\n>>> Ctrl+C sent\\n', 'repl-log');
      vscode.postMessage({ type: 'interrupt' });
    };

    var main = document.querySelector('.main');
    var resizer = document.getElementById('resizer');
    var startX, startLeftW;
    resizer.addEventListener('mousedown', function(e) {
      startX = e.clientX;
      var leftPane = main.querySelector('.pane');
      startLeftW = leftPane.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      function move(e2) {
        var dx = e2.clientX - startX;
        var w = Math.max(100, Math.min(main.offsetWidth - 120, startLeftW + dx));
        main.style.gridTemplateColumns = w + 'px 6px 1fr';
      }
      function stop() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', stop);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', stop);
    });

    vscode.postMessage({ type: 'listPorts' });
  </script>
</body>
</html>`;
}
function deactivate() {
    return serialManager.disconnect();
}
