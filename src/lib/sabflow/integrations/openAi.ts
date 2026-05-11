import type { IntegrationResult, ResolvedOptions, Credential } from './types';

export async function executeOpenAi(
  options: ResolvedOptions,
  credential?: Credential,
): Promise<IntegrationResult> {
  const apiKey = credential?.apiKey ?? (options.apiKey as string);
  if (!apiKey) return { error: 'open_ai: apiKey credential is required' };

  const operation = (options.operation as string) ?? 'chat';
  const model = (options.model as string) ?? 'gpt-4o-mini';
  const prompt = (options.prompt as string) ?? '';
  const systemPrompt = options.systemPrompt as string | undefined;

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  try {
    if (operation === 'chat') {
      const messages: Array<{ role: string; content: string }> = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };
      return {
        outputs: {
          text: data.choices?.[0]?.message?.content ?? '',
          tokens: String(data.usage?.total_tokens ?? 0),
        },
      };
    }
    if (operation === 'embedding') {
      const input = (options.input as string) ?? prompt;
      const embModel = (options.embeddingModel as string) ?? 'text-embedding-3-small';
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: embModel, input }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      const embedding = data.data?.[0]?.embedding ?? [];
      return { outputs: { embedding: JSON.stringify(embedding), dimensions: String(embedding.length) } };
    }
    return { error: `open_ai: unknown operation "${operation}"` };
  } catch (err) {
    return { error: `open_ai failed: ${(err as Error).message}` };
  }
}
