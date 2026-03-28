import { DEFAULT_PROMPTS, PromptConfig } from './defaultPrompts';

function getUserContent(
  target: string,
  data: string,
  prompts: Record<string, PromptConfig> = {}
): string {
  const template =
    prompts[target]?.prompt ||
    DEFAULT_PROMPTS[target]?.prompt ||
    '';

  if (!template) {
    return data || '';
  }

  if (/\{\{\s*text\s*\}\}/gi.test(template)) {
    return template.replace(/\{\{\s*text\s*\}\}/gi, data);
  }

  return `${template}\n\n${data}`;
}

export async function fetchLLM(
  data: string,
  endpoint: string,
  apikey: string,
  target: string,
  modelName: string,
  prompts: Record<string, PromptConfig> = {}
): Promise<string> {
  if (!endpoint || !apikey || !target) {
    throw new Error('关键参数没有设置完全（终端节点、API Key、互译模式均不能为空）');
  }

  const contentText = getUserContent(target, data, prompts);
  if (!contentText) {
    throw new Error('尚未为该模式配置提示词');
  }

  const validEndpoint = endpoint.includes('{{modelName}}')
    ? endpoint.replace('{{modelName}}', modelName)
    : endpoint;

  const response = await fetch(validEndpoint, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apikey,
      'content-type': 'application/json',
      'authorization': `Bearer ${apikey}`,
    },
    body: JSON.stringify({
      ...(modelName && { model: modelName }),
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: contentText }],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP 错误！状态码: ${response.status}`);
  }

  const result = await response.json() as { choices: Array<{ message: { content: string } }> };
  return result.choices[0].message.content;
}
