import type { IntegrationResult, ResolvedOptions, Credential } from './types';

export async function executeMistral(
  options: ResolvedOptions,
  credential?: Credential,
): Promise<IntegrationResult> {
  const apiKey = credential?.apiKey ?? (options.apiKey as string);
  if (!apiKey) return { error: 'mistral: apiKey credential is required' };

  const model = (options.model as string) ?? 'mistral-small-latest';
  const prompt = (options.prompt as string) ?? '';

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { outputs: { text: data.choices?.[0]?.message?.content ?? '' } };
  } catch (err) {
    return { error: `mistral failed: ${(err as Error).message}` };
  }
}
