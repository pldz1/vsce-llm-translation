export interface PromptConfig {
  label: string;
  id: string;
  canDelete: boolean;
  prompt: string;
}

export const DEFAULT_PROMPTS: Record<string, PromptConfig> = {
  cn_en_translation: {
    label: '中英互译',
    id: 'cn_en_translation',
    canDelete: false,
    prompt:
      '你是一名顶级的专业翻译家，擅长精准、地道地进行中英互译。请将下面内容翻译成另一种语言。在翻译过程中，严格保持原文的含义、语气和风格，**仅输出翻译结果，无需添加任何解释或评论**：\n\n{{text}}',
  },
  editing_assistant: {
    label: '中英润色',
    id: 'editing_assistant',
    canDelete: false,
    prompt:
      '你是一位专业的文档编辑专家，请根据原文语言，将其润色为**专业、严谨且流畅的官方文档或正式商业文本风格**。在润色时，务必保持原文的核心事实和技术术语不变。**请先输出润色后的内容；随后在新的段落，以一个简洁的列表说明主要的修改点和改进之处**：\n\n{{text}}',
  },
};
