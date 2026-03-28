import * as vscode from 'vscode';
import { DEFAULT_PROMPTS, PromptConfig } from './defaultPrompts';

export class StorageService {
  private static readonly API_KEY_SECRET = 'llm-translator.apikey';

  constructor(private readonly context: vscode.ExtensionContext) {}

  async getApiKey(): Promise<string> {
    return (await this.context.secrets.get(StorageService.API_KEY_SECRET)) ?? '';
  }

  async setApiKey(value: string): Promise<void> {
    await this.context.secrets.store(StorageService.API_KEY_SECRET, value);
  }

  getEndpoint(): string {
    return this.context.globalState.get<string>('endpoint', '');
  }
  async setEndpoint(value: string): Promise<void> {
    await this.context.globalState.update('endpoint', value);
  }

  getModelName(): string {
    return this.context.globalState.get<string>('modelName', '');
  }
  async setModelName(value: string): Promise<void> {
    await this.context.globalState.update('modelName', value);
  }

  getTarget(): string {
    return this.context.globalState.get<string>('target', '');
  }
  async setTarget(value: string): Promise<void> {
    await this.context.globalState.update('target', value);
  }

  getReplaceText(): boolean {
    return this.context.globalState.get<boolean>('replaceText', false);
  }
  async setReplaceText(value: boolean): Promise<void> {
    await this.context.globalState.update('replaceText', value);
  }

  async setPrompts(prompts: Record<string, PromptConfig>, promptOrder: string[]): Promise<void> {
    await this.context.globalState.update('prompts', prompts);
    await this.context.globalState.update('promptOrder', promptOrder);
  }

  getMergedPrompts(): { prompts: Record<string, PromptConfig>; promptOrder: string[] } {
    const stored = this.context.globalState.get<Record<string, PromptConfig>>('prompts', {});
    const storedOrder = this.context.globalState.get<string[]>('promptOrder', []);

    const merged: Record<string, PromptConfig> = {};
    const allKeys = new Set([...Object.keys(DEFAULT_PROMPTS), ...Object.keys(stored)]);

    allKeys.forEach((id) => {
      const def = DEFAULT_PROMPTS[id];
      const s = stored[id];
      merged[id] = {
        label: s?.label || def?.label || id,
        prompt: s?.prompt || def?.prompt || '',
        id: s?.id || def?.id || id,
        canDelete: s?.canDelete !== undefined ? s.canDelete : (def?.canDelete !== undefined ? def.canDelete : !DEFAULT_PROMPTS[id]),
      };
    });

    const order: string[] = [];
    storedOrder.forEach((id) => { if (merged[id] && !order.includes(id)) { order.push(id); } });
    Object.keys(DEFAULT_PROMPTS).forEach((id) => { if (merged[id] && !order.includes(id)) { order.push(id); } });
    Object.keys(merged).forEach((id) => { if (!order.includes(id)) { order.push(id); } });

    return { prompts: merged, promptOrder: order };
  }
}
