import * as vscode from 'vscode';
import { StorageService } from './storageService';
import { TranslatorPanel } from './translatorPanel';
import { fetchLLM } from './translationService';

interface PendingTranslation {
  uri: string;
  range: vscode.Range;
  text: string;
}

export function activate(context: vscode.ExtensionContext) {
  const storage = new StorageService(context);

  // ── 侧边栏 ─────────────────────────────────────────────────────────────────

  const panelProvider = new TranslatorPanel(context.extensionUri, storage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TranslatorPanel.viewType, panelProvider)
  );

  // ── 编辑器内悬浮翻译结果 ────────────────────────────────────────────────────

  const translationDecoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    borderRadius: '3px',
  });

  let pendingTranslation: PendingTranslation | null = null;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  function clearPendingTranslation(editor?: vscode.TextEditor) {
    pendingTranslation = null;
    if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
    const target = editor ?? vscode.window.activeTextEditor;
    if (target) { target.setDecorations(translationDecoration, []); }
  }

  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ pattern: '**' }, {
      provideHover(document, position) {
        if (!pendingTranslation) { return; }
        if (document.uri.toString() !== pendingTranslation.uri) { return; }
        if (!pendingTranslation.range.contains(position)) { return; }
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.appendMarkdown('**LLM 翻译结果**\n\n');
        md.appendText(pendingTranslation.text);
        return new vscode.Hover(md, pendingTranslation.range);
      },
    })
  );

  // 切换文件时清除，不监听选区变化（避免与 showHover 流程冲突）
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => clearPendingTranslation())
  );

  context.subscriptions.push(translationDecoration);

  // ── 核心翻译函数 ──────────────────────────────────────────────────────────

  async function runTranslation() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showWarningMessage('LLM Translator: 请先选中要翻译的文本');
      return;
    }

    const selectedText = editor.document.getText(editor.selection);
    const selectionRange = new vscode.Range(editor.selection.start, editor.selection.end);
    const documentUri = editor.document.uri.toString();

    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusItem.text = '$(sync~spin) LLM 翻译中...';
    statusItem.show();

    try {
      const apiKey = await storage.getApiKey();
      const { prompts } = storage.getMergedPrompts();
      const result = await fetchLLM(
        selectedText,
        storage.getEndpoint(),
        apiKey,
        storage.getTarget(),
        storage.getModelName(),
        prompts
      );

      if (storage.getReplaceText()) {
        await editor.edit((builder) => {
          builder.replace(editor.selection, result);
        });
      } else {
        clearPendingTranslation(editor);
        pendingTranslation = { uri: documentUri, range: selectionRange, text: result };
        editor.setDecorations(translationDecoration, [selectionRange]);

        // 将光标定位到选区起点，然后立刻触发 hover 弹窗
        editor.selection = new vscode.Selection(selectionRange.start, selectionRange.start);
        // 等一帧让 VSCode 处理完光标变化再触发
        setTimeout(() => {
          vscode.commands.executeCommand('editor.action.showHover');
        }, 50);

        // 60 秒后自动清除高亮
        clearTimer = setTimeout(() => clearPendingTranslation(editor), 60000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`LLM Translator: ${message}`);
    } finally {
      statusItem.dispose();
    }
  }

  // ── 命令注册 ───────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('llm-translator.translate', runTranslation)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('llm-translator.openPanel', () => {
      vscode.commands.executeCommand('llm-translator.panel.focus');
    })
  );
}

export function deactivate() {}
