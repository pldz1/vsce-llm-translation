import * as vscode from 'vscode';
import { StorageService } from './storageService';
import { fetchLLM } from './translationService';

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

export class TranslatorPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'llm-translator.panel';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly storage: StorageService
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this._buildHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case 'getConfig': {
          const { prompts, promptOrder } = this.storage.getMergedPrompts();
          const apiKey = await this.storage.getApiKey();
          webviewView.webview.postMessage({
            type: 'configLoaded',
            data: {
              endpoint: this.storage.getEndpoint(),
              apiKey,
              modelName: this.storage.getModelName(),
              target: this.storage.getTarget(),
              replaceText: this.storage.getReplaceText(),
              prompts,
              promptOrder,
            },
          });
          break;
        }
        case 'saveEndpoint':
          await this.storage.setEndpoint(msg.value);
          break;
        case 'saveApiKey':
          await this.storage.setApiKey(msg.value);
          break;
        case 'saveModelName':
          await this.storage.setModelName(msg.value);
          break;
        case 'saveTarget':
          await this.storage.setTarget(msg.value);
          break;
        case 'saveReplaceText':
          await this.storage.setReplaceText(msg.value);
          break;
        case 'savePrompts':
          await this.storage.setPrompts(msg.prompts, msg.promptOrder);
          break;
        case 'translate':
          await this._handleTranslate(msg.text, webviewView.webview);
          break;
      }
    });
  }

  private async _handleTranslate(text: string, webview: vscode.Webview): Promise<void> {
    webview.postMessage({ type: 'translationStart' });
    try {
      const apiKey = await this.storage.getApiKey();
      const { prompts } = this.storage.getMergedPrompts();
      const result = await fetchLLM(
        text,
        this.storage.getEndpoint(),
        apiKey,
        this.storage.getTarget(),
        this.storage.getModelName(),
        prompts
      );
      webview.postMessage({ type: 'translationResult', result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      webview.postMessage({ type: 'translationError', message });
    }
  }

  private _buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'panel.js')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>LLM Translator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: transparent;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      line-height: 1.4;
    }

    .container { padding: 8px 12px 16px; }

    /* ── 通知 ── */
    .notification {
      padding: 6px 8px;
      margin-bottom: 8px;
      font-size: 12px;
      line-height: 1.4;
      border-left: 3px solid transparent;
    }
    .notification.notification--error {
      background: var(--vscode-inputValidation-errorBackground);
      border-left-color: var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-foreground);
    }
    .notification.notification--info {
      background: var(--vscode-inputValidation-infoBackground);
      border-left-color: var(--vscode-inputValidation-infoBorder);
      color: var(--vscode-foreground);
    }
    .notification.notification--hidden { display: none; }

    /* ── 字段行 ── */
    .row {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
      gap: 6px;
    }
    .row label {
      flex: 0 0 64px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    .row input, .row select {
      flex: 1;
      min-width: 0;
      padding: 3px 6px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      outline: none;
    }
    .row input::placeholder { color: var(--vscode-input-placeholderForeground); }
    .row input:focus, .row select:focus {
      border-color: var(--vscode-focusBorder);
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    .row select {
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border-color: var(--vscode-dropdown-border);
    }

    /* ── textarea ── */
    textarea {
      width: 100%;
      padding: 4px 6px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      resize: vertical;
      min-height: 58px;
      max-height: 130px;
      outline: none;
    }
    textarea::placeholder { color: var(--vscode-input-placeholderForeground); }
    textarea:focus {
      border-color: var(--vscode-focusBorder);
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    textarea:disabled { opacity: 0.5; }

    /* ── textarea 堆叠行（标签在上）── */
    .row.textarea-row {
      flex-direction: column;
      align-items: stretch;
      gap: 3px;
    }
    .row.textarea-row label { flex: none; }

    /* ── textarea + 按钮并排 ── */
    .row.textarea-button { align-items: flex-start; gap: 6px; }
    .row.textarea-button textarea { flex: 1; width: auto; }
    .row.textarea-button .button { flex: 0 0 auto; margin-top: 1px; }

    /* ── checkbox 行 ── */
    .row.checkbox-row { gap: 6px; margin-bottom: 8px; }
    .row.checkbox-row input[type="checkbox"] {
      flex: 0 0 auto;
      width: 14px; height: 14px;
      accent-color: var(--vscode-focusBorder);
      cursor: pointer;
      padding: 0; border: none; background: transparent;
    }
    .row.checkbox-row label {
      flex: 0 0 auto;
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      cursor: pointer;
    }

    /* ── 按钮 ── */
    .button {
      padding: 3px 10px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size, 13px);
      cursor: pointer;
      white-space: nowrap;
    }
    .button:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
    .button:disabled { opacity: 0.4; cursor: not-allowed; }
    .button.danger-button {
      background: var(--vscode-button-secondaryBackground, #5a1d1d);
      color: var(--vscode-button-secondaryForeground, #cccccc);
      border: 1px solid var(--vscode-button-border, transparent);
    }
    .button.danger-button:hover:not(:disabled) {
      background: var(--vscode-button-secondaryHoverBackground, #6e2323);
    }

    /* ── 分隔线 ── */
    .separator {
      height: 1px;
      background: var(--vscode-widget-border, var(--vscode-panel-border, #454545));
      margin: 10px 0;
      border: none;
    }

    /* ── 折叠区块（VSCode section header 风格）── */
    details.collapsible {
      margin: 0 -12px 0;
    }
    details.collapsible summary {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
      background: var(--vscode-sideBarSectionHeader-background, transparent);
      border-top: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-widget-border, transparent));
      cursor: pointer;
      list-style: none;
      outline: none;
      user-select: none;
    }
    details.collapsible summary::-webkit-details-marker { display: none; }
    details.collapsible summary::before {
      content: '▶';
      font-size: 8px;
      opacity: 0.7;
      transition: transform 0.15s;
      display: inline-block;
    }
    details.collapsible[open] summary::before { transform: rotate(90deg); }
    details.collapsible .collapsible-content {
      padding: 10px 12px 6px;
    }

    /* ── 提示文字 ── */
    .hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
      margin-bottom: 8px;
    }

    /* ── 结果区 ── */
    .result-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .result {
      background: var(--vscode-editor-background, var(--vscode-input-background));
      color: var(--vscode-editor-foreground, var(--vscode-foreground));
      border: 1px solid var(--vscode-widget-border, var(--vscode-input-border, transparent));
      padding: 6px 8px;
      font-size: 12px;
      line-height: 1.5;
      min-height: 48px;
      max-height: 160px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="notification" class="notification notification--hidden" role="status" aria-live="polite"></div>

    <div class="row">
      <label for="endpoint-input">终端节点</label>
      <input id="endpoint-input" placeholder="https://...{{modelName}}" />
    </div>
    <div class="row">
      <label for="apikey-input">API Key</label>
      <input id="apikey-input" type="password" placeholder="输入密钥" />
    </div>
    <div class="row">
      <label for="modelname-input">模型名称</label>
      <input id="modelname-input" placeholder="可选: gpt-4" />
    </div>
    <div class="row">
      <label for="target-language-select">翻译模式</label>
      <select id="target-language-select">
        <option value="">请选择</option>
      </select>
    </div>
    <p class="hint" style="margin-bottom:10px;">终端节点支持 <code>{{modelName}}</code> 占位符</p>

  </div>

  <details class="collapsible">
    <summary>提示词信息</summary>
    <div class="collapsible-content">
      <div class="row checkbox-row">
        <input id="lock-prompt-checkbox" type="checkbox" checked />
        <label for="lock-prompt-checkbox">锁定提示词</label>
      </div>
      <p class="hint">取消勾选即可编辑当前模式的提示词。</p>
      <div class="row textarea-row" style="margin-bottom:8px;">
        <label for="prompt-textarea">提示词（支持 {{text}} 占位符）</label>
        <textarea id="prompt-textarea" placeholder="提示词内容" disabled></textarea>
      </div>
      <button id="delete-mode-button" class="button danger-button" disabled>删除当前模式</button>
    </div>
  </details>

  <details class="collapsible">
    <summary>新增模式</summary>
    <div class="collapsible-content">
      <div class="row" style="margin-bottom:6px;">
        <label for="new-mode-label-input">模式名称</label>
        <input id="new-mode-label-input" placeholder="例如：英译日、代码注释翻译" />
      </div>
      <div class="row textarea-button">
        <textarea id="new-mode-prompt-textarea" placeholder="填写提示词，使用 {{text}} 表示原文内容"></textarea>
        <button id="add-mode-button" class="button">新增</button>
      </div>
    </div>
  </details>

  <div class="container" style="padding-top:10px;">
    <div class="row checkbox-row">
      <input id="replace-text-checkbox" type="checkbox" />
      <label for="replace-text-checkbox">替换文本（翻译后直接替换选中内容）</label>
    </div>

    <hr class="separator" />

    <div class="row textarea-button" style="margin-bottom:10px;">
      <textarea id="translate-textarea" placeholder="在此输入文本..."></textarea>
      <button id="start-translate" class="button">执行</button>
    </div>

    <p class="result-label">翻译结果</p>
    <div class="result" id="res-span"></div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
