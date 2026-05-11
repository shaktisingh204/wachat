import type { IntegrationResult, ResolvedOptions, Credential } from './types';

export async function executeAnthropicAi(
  options: ResolvedOptions,
  credential?: Credential,
): Promise<IntegrationResult> {
  const apiKey = credential?.apiKey ?? (options.apiKey as string);
  if (!apiKey) return { error: 'anthropic: apiKey credential is required' };

  const model = (options.model as string) ?? 'claude-haiku-4-5-20251001';
  const prompt = (options.prompt as string) ?? '';
  const systemPrompt = options.systemPrompt as string | undefined;
  const maxTokens = Number(options.maxTokens ?? 1024);

  try {
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const tokens = ((data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)).toString();
    return { outputs: { text, tokens } };
  } catch (err) {
    return { error: `anthropic failed: ${(err as Error).message}` };
  }
}
