import type { IntegrationResult, ResolvedOptions, Credential } from './types';

export async function executeTogetherAi(
  options: ResolvedOptions,
  credential?: Credential,
): Promise<IntegrationResult> {
  const apiKey = credential?.apiKey ?? (options.apiKey as string);
  if (!apiKey) return { error: 'together_ai: apiKey credential is required' };

  const model = (options.model as string) ?? 'mistralai/Mixtral-8x7B-Instruct-v0.1';
  const prompt = (options.prompt as string) ?? '';
  const maxTokens = Number(options.maxTokens ?? 512);

  try {
    const res = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`TogetherAI ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { outputs: { text: data.choices?.[0]?.message?.content ?? '' } };
  } catch (err) {
    return { error: `together_ai failed: ${(err as Error).message}` };
  }
}
