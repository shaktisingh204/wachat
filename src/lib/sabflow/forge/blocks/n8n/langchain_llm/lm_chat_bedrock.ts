/**
 * Forge block: LM Chat AWS Bedrock
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LmChatAwsBedrock/LmChatAwsBedrock.node.ts
 *
 * Endpoint:
 *   POST https://bedrock-runtime.<region>.amazonaws.com/model/<model-id>/invoke
 *   Auth: AWS SigV4 (service="bedrock", body-signed)
 *
 * Bedrock multiplexes many model providers behind one invoke URL but each
 * family uses its own request/response shape.  We branch on the model-id
 * prefix:
 *
 *   anthropic.*    →  { anthropic_version: "bedrock-2023-05-31",
 *                       messages: [...], max_tokens, system?, temperature? }
 *   meta.llama*    →  { prompt, max_gen_len, temperature?, top_p? }
 *   amazon.titan-* →  { inputText, textGenerationConfig: {...} }
 *   cohere.command*→  { message, chat_history?, temperature? }  (Command R)
 *                     or { prompt, max_tokens } for legacy `cohere.command*-text-*`
 *   mistral.*      →  { prompt, max_tokens, temperature? }
 *
 * Return shape: `{ text, raw }` to match sibling blocks (lm_chat_openai etc.).
 *
 * Credentials are inline (same as the sibling LM blocks) — no `@aws-sdk/*`
 * dependency; SigV4 signing is done locally via `forge/aws/sigv4.ts`.
 */

import { signV4 } from '../../../aws/sigv4';
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

/* ── URL & payload helpers ──────────────────────────────────────────────── */

function bedrockInvokeUrl(region: string, modelId: string): string {
  // The colon in model ids like `amazon.titan-embed-text-v2:0` MUST be
  // percent-encoded for the canonical URI to match the server's calculation.
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;
}

type Payload = Record<string, unknown>;

function buildPayload(args: {
  modelId: string;
  prompt: string;
  system: string;
  temperature: number;
  maxTokens: number;
}): Payload {
  const { modelId, prompt, system, temperature, maxTokens } = args;

  if (modelId.startsWith('anthropic.')) {
    const p: Payload = {
      anthropic_version: 'bedrock-2023-05-31',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    };
    if (system) p.system = system;
    return p;
  }

  if (modelId.startsWith('meta.') || modelId.startsWith('meta-')) {
    // Llama on Bedrock takes a flat prompt string.  System-prompt support is
    // model-dependent; we prepend it inline when supplied so callers don't
    // silently lose context.
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
    return {
      prompt: fullPrompt,
      max_gen_len: maxTokens,
      temperature,
    };
  }

  if (modelId.startsWith('amazon.titan-')) {
    return {
      inputText: system ? `${system}\n\n${prompt}` : prompt,
      textGenerationConfig: {
        maxTokenCount: maxTokens,
        temperature,
        topP: 0.9,
      },
    };
  }

  if (modelId.startsWith('cohere.command')) {
    // Command R / R+ use the "message" field; legacy command-text uses prompt.
    if (modelId.includes('-text-') || modelId.includes('-light-text-')) {
      return {
        prompt: system ? `${system}\n\n${prompt}` : prompt,
        max_tokens: maxTokens,
        temperature,
      };
    }
    const p: Payload = {
      message: prompt,
      max_tokens: maxTokens,
      temperature,
    };
    if (system) p.preamble = system;
    return p;
  }

  if (modelId.startsWith('mistral.')) {
    const fullPrompt = system ? `<s>[INST] ${system}\n\n${prompt} [/INST]` : `<s>[INST] ${prompt} [/INST]`;
    return {
      prompt: fullPrompt,
      max_tokens: maxTokens,
      temperature,
    };
  }

  // Unknown family — best-effort: try Anthropic shape but warn via the error
  // path when extraction fails.  Most non-listed Bedrock entrants follow the
  // OpenAI-ish messages contract these days.
  return {
    anthropic_version: 'bedrock-2023-05-31',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
    ...(system ? { system } : {}),
  };
}

/* ── Response extraction ────────────────────────────────────────────────── */

type Usage = { inputTokens?: number; outputTokens?: number } | undefined;

function extractText(modelId: string, raw: unknown): { text: string; usage: Usage } {
  if (!raw || typeof raw !== 'object') return { text: '', usage: undefined };

  if (modelId.startsWith('anthropic.')) {
    const body = raw as { content?: Array<{ type?: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const text = (body.content ?? [])
      .filter((c) => !c.type || c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    return {
      text,
      usage: body.usage
        ? { inputTokens: body.usage.input_tokens, outputTokens: body.usage.output_tokens }
        : undefined,
    };
  }

  if (modelId.startsWith('meta.') || modelId.startsWith('meta-')) {
    const body = raw as { generation?: string; prompt_token_count?: number; generation_token_count?: number };
    return {
      text: body.generation ?? '',
      usage: { inputTokens: body.prompt_token_count, outputTokens: body.generation_token_count },
    };
  }

  if (modelId.startsWith('amazon.titan-')) {
    const body = raw as { results?: Array<{ outputText?: string; tokenCount?: number }>; inputTextTokenCount?: number };
    const text = (body.results ?? []).map((r) => r.outputText ?? '').join('');
    const output = (body.results ?? []).reduce((acc, r) => acc + (r.tokenCount ?? 0), 0);
    return {
      text,
      usage: { inputTokens: body.inputTextTokenCount, outputTokens: output || undefined },
    };
  }

  if (modelId.startsWith('cohere.command')) {
    const body = raw as { text?: string; generations?: Array<{ text?: string }> };
    if (body.text) return { text: body.text, usage: undefined };
    return { text: (body.generations ?? []).map((g) => g.text ?? '').join(''), usage: undefined };
  }

  if (modelId.startsWith('mistral.')) {
    const body = raw as { outputs?: Array<{ text?: string }> };
    return { text: (body.outputs ?? []).map((o) => o.text ?? '').join(''), usage: undefined };
  }

  // Fallback — try the Anthropic shape.
  const body = raw as { content?: Array<{ text?: string }> };
  return { text: (body.content ?? []).map((c) => c.text ?? '').join(''), usage: undefined };
}

/* ── Action ─────────────────────────────────────────────────────────────── */

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Bedrock: accessKeyId and secretAccessKey are required');
  }
  const sessionToken = asString(ctx.options.sessionToken) || undefined;
  const region = asString(ctx.options.region) || 'us-east-1';
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Bedrock: prompt is required');
  const modelId = asString(ctx.options.model) || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const payload = buildPayload({ modelId, prompt, system, temperature, maxTokens });
  const bodyJson = JSON.stringify(payload);
  const url = bedrockInvokeUrl(region, modelId);

  const signed = signV4({
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
    service: 'bedrock',
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: bodyJson,
  });

  const res = await apiRequest({
    service: 'Bedrock',
    method: 'POST',
    url,
    headers: signed.headers,
    body: bodyJson,
  });

  const { text, usage } = extractText(modelId, res.data);
  return {
    outputs: { text, output: text, usage, raw: res.data },
    logs: [`Bedrock chat → ${modelId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_bedrock',
  name: 'LM Chat AWS Bedrock',
  description: 'Invoke an AWS Bedrock chat model (SigV4-signed invoke).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Single-turn chat against the Bedrock invoke endpoint.',
      fields: [
        { id: 'accessKeyId', label: 'AWS access key id', type: 'password', required: true },
        { id: 'secretAccessKey', label: 'AWS secret access key', type: 'password', required: true },
        { id: 'sessionToken', label: 'AWS session token (optional)', type: 'password' },
        { id: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1', required: true },
        { id: 'model', label: 'Model ID', type: 'text', placeholder: 'anthropic.claude-3-5-sonnet-20241022-v2:0' },
        { id: 'system', label: 'System prompt', type: 'textarea' },
        { id: 'prompt', label: 'User prompt', type: 'textarea', required: true },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
        { id: 'maxTokens', label: 'Max tokens', type: 'number', defaultValue: 1024 },
      ],
      run: chat,
    },
  ],
};

registerForgeBlock(block);
export default block;
