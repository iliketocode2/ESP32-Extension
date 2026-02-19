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
let panel;
function activate(context) {
    context.subscriptions.push(vscode.commands.registerCommand('spike-serial.open', () => {
        if (panel) {
            panel.reveal();
            return;
        }
        panel = vscode.window.createWebviewPanel('spike-serial', 'SPIKE Serial Monitor', vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [],
        });
        panel.webview.html = getWebviewContent();
        panel.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === 'openExternal' && msg.url) {
                vscode.env.openExternal(vscode.Uri.parse(msg.url));
            }
            else if (msg.type === 'showLocalServerHelp') {
                const choice = await vscode.window.showInformationMessage('To run locally: navigate to your project folder in a terminal and run `python -m http.server 8000`, then point the URL bar to http://localhost:8000', 'Open Terminal');
                if (choice === 'Open Terminal') {
                    vscode.commands.executeCommand('workbench.action.terminal.new');
                }
            }
        });
        panel.onDidDispose(() => {
            panel = undefined;
        });
    }));
}
function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src 'unsafe-inline';
    style-src 'unsafe-inline';
    frame-src https://chrisrogers.pyscriptapps.com https://localhost:* http://localhost:*;
  ">
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
      gap: 10px;
      padding: 8px 12px;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .toolbar h2 {
      font-size: 13px;
      font-weight: 600;
      flex: 1;
    }

    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      padding: 4px 12px;
      font-size: 12px;
      cursor: pointer;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.1));
      color: var(--vscode-button-secondaryForeground, inherit);
    }

    .url-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--vscode-input-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .url-bar label { font-size: 11px; opacity: 0.6; white-space: nowrap; }

    .url-bar input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--vscode-input-foreground);
      font-size: 12px;
      font-family: var(--vscode-editor-font-family, monospace);
      outline: none;
    }

    iframe {
      flex: 1;
      width: 100%;
      border: none;
    }

    .notice {
      padding: 24px 32px;
      line-height: 1.7;
      max-width: 640px;
    }

    .notice h3 { margin-bottom: 12px; font-size: 15px; }
    .notice p  { margin-bottom: 10px; font-size: 13px; opacity: 0.85; }
    .notice code {
      background: rgba(255,255,255,0.1);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }
    .notice .btn-row { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }

    #iframe-area { flex: 1; display: flex; flex-direction: column; }
    #the-iframe  { display: none; flex: 1; }
    #notice-area { flex: 1; overflow-y: auto; }
  </style>
</head>
<body>

<div class="toolbar">
  <h2>⚡ SPIKE Serial Monitor</h2>
  <button class="secondary" onclick="openInBrowser()">Open in Browser ↗</button>
  <button onclick="loadIframe()">Load in Panel</button>
</div>

<div class="url-bar">
  <label>URL:</label>
  <input id="urlInput" type="text"
    value="https://chrisrogers.pyscriptapps.com/talking-on-spike/latest/"
    onkeydown="if(event.key==='Enter') loadIframe()"
  />
  <button class="secondary" onclick="loadIframe()">↵ Go</button>
</div>

<div id="iframe-area">
  <div id="notice-area">
    <div class="notice">
      <h3>How to use</h3>
      <p>
        Your PyScript serial app uses the <strong>Web Serial API</strong>, which needs a real
        browser context with hardware access. VS Code's built-in webview panel partially supports
        this — click <strong>"Load in Panel"</strong> to try it directly here.
      </p>
      <p>
        If the serial "connect" button doesn't work inside the panel (which can happen depending
        on your OS and VS Code version), use <strong>"Open in Browser"</strong> instead — that
        always works and gives you the full Chrome serial experience.
      </p>
      <p>
        You can also point the URL bar at a <strong>local server</strong> if you're running your
        PyScript app locally (e.g. <code>http://localhost:8000</code>).
      </p>
      <div class="btn-row">
        <button onclick="loadIframe()">Load in Panel</button>
        <button class="secondary" onclick="openInBrowser()">Open in Browser ↗</button>
        <button class="secondary" onclick="startLocalServer()">How to run locally</button>
      </div>
    </div>
  </div>
  <iframe id="the-iframe" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"></iframe>
</div>

<script>
  const vscode = acquireVsCodeApi();

  function getUrl() {
    return document.getElementById('urlInput').value.trim();
  }

  function loadIframe() {
    const url = getUrl();
    if (!url) return;

    const iframe = document.getElementById('the-iframe');
    const notice = document.getElementById('notice-area');

    iframe.src = url;
    iframe.style.display = 'block';
    notice.style.display = 'none';
  }

  function openInBrowser() {
    const url = getUrl();
    vscode.postMessage({ type: 'openExternal', url });
  }

  function startLocalServer() {
    vscode.postMessage({ type: 'showLocalServerHelp' });
  }
</script>
</body>
</html>`;
}
function deactivate() { }
