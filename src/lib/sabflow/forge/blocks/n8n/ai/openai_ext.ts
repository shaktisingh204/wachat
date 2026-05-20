/**
 * Forge block: OpenAI (extended)
 *
 * Source: n8n-master/packages/nodes-base/nodes/OpenAi/OpenAi.node.ts (+ Chat/Text/Image descriptions)
 * Credential type: 'openai' (expects { apiKey }).
 *
 * Operations:
 *   - chat              POST /chat/completions
 *   - complete          POST /completions          (legacy completion)
 *   - image_generate    POST /images/generations   (DALL-E)
 *   - embed             POST /embeddings
 *   - transcribe_stub   POST /audio/transcriptions (URL → fetch → upload not piped in v1)
 *
 * Deferred:
 *   - file/binary audio uploads (need multipart binary plumbing)
 *   - fine-tunes, assistants, threads
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString, requireCredential } from '../_shared/http';

const API = 'https://api.openai.com/v1';

async function oaApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  url: string,
  json?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const cred = requireCredential('OpenAI', ctx.credential);
  // Accept either `apiKey` (canonical) or `accessToken` (legacy) — pick whichever is set
  // so we can pass the correct tokenField to the helper.
  const tokenField = cred.apiKey ? 'apiKey' : cred.accessToken ? 'accessToken' : 'apiKey';
  const r = await ctx.helpers!.requestWithAuthentication('bearer', {
    method,
    url,
    tokenField,
    json,
  });
  if (!r.ok) {
    const clip =
      typeof r.data === 'string'
        ? r.data.length > 300
          ? `${r.data.slice(0, 300)}…`
          : r.data
        : JSON.stringify(r.data ?? null).slice(0, 300);
    throw new Error(`OpenAI ${method} ${url} failed (${r.status}): ${clip}`);
  }
  return r;
}

function bearerHeader(ctx: ForgeActionContext): string {
  const cred = requireCredential('OpenAI', ctx.credential);
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('OpenAI: credential is missing `apiKey`');
  return `Bearer ${key}`;
}

function parseMessages(raw: unknown): Array<{ role: string; content: string }> {
  const s = asString(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fallthrough */
  }
  return [{ role: 'user', content: s }];
}

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'gpt-4o-mini';
  const messages = parseMessages(ctx.options.messages);
  if (messages.length === 0) throw new Error('OpenAI chat: messages are required');
  const temperature = ctx.options.temperature !== undefined && ctx.options.temperature !== ''
    ? Number(ctx.options.temperature)
    : undefined;
  const maxTokens = ctx.options.maxTokens !== undefined && ctx.options.maxTokens !== ''
    ? Number(ctx.options.maxTokens)
    : undefined;

  const payload: Record<string, unknown> = { model, messages };
  if (temperature !== undefined) payload.temperature = temperature;
  if (maxTokens !== undefined) payload.max_tokens = maxTokens;

  const res = await oaApi(ctx, 'POST', `${API}/chat/completions`, payload);
  const body = res.data as { choices?: Array<{ message?: { content?: string } }> };
  return {
    outputs: {
      content: body?.choices?.[0]?.message?.content ?? '',
      raw: res.data,
    },
    logs: [`OpenAI chat → ${model}`],
  };
}

async function complete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'gpt-3.5-turbo-instruct';
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('OpenAI complete: prompt is required');

  const payload: Record<string, unknown> = { model, prompt };
  if (ctx.options.maxTokens) payload.max_tokens = Number(ctx.options.maxTokens);
  if (ctx.options.temperature !== undefined && ctx.options.temperature !== '') {
    payload.temperature = Number(ctx.options.temperature);
  }

  const res = await oaApi(ctx, 'POST', `${API}/completions`, payload);
  const body = res.data as { choices?: Array<{ text?: string }> };
  return {
    outputs: { text: body?.choices?.[0]?.text ?? '', raw: res.data },
    logs: [`OpenAI complete → ${model}`],
  };
}

async function imageGenerate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('OpenAI image: prompt is required');
  const model = asString(ctx.options.model) || 'dall-e-3';
  const size = asString(ctx.options.size) || '1024x1024';
  const n = ctx.options.n ? Number(ctx.options.n) : 1;

  const res = await oaApi(ctx, 'POST', `${API}/images/generations`, { model, prompt, size, n });
  const body = res.data as { data?: Array<{ url?: string; b64_json?: string }> };
  return {
    outputs: { images: body?.data ?? [], raw: res.data },
    logs: [`OpenAI image → ${model} (${body?.data?.length ?? 0})`],
  };
}

async function embed(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = asString(ctx.options.input);
  if (!input) throw new Error('OpenAI embed: input is required');
  const model = asString(ctx.options.model) || 'text-embedding-3-small';

  const res = await oaApi(ctx, 'POST', `${API}/embeddings`, { model, input });
  const body = res.data as { data?: Array<{ embedding?: number[] }> };
  return {
    outputs: { embedding: body?.data?.[0]?.embedding ?? [], raw: res.data },
    logs: [`OpenAI embed → ${model}`],
  };
}

async function transcribeStub(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const audioUrl = asString(ctx.options.audioUrl);
  if (!audioUrl) throw new Error('OpenAI transcribe: audioUrl is required');
  const model = asString(ctx.options.model) || 'whisper-1';

  // Fetch the audio file, then forward as multipart.
  // Multipart upload is not supported by the helper layer (json/body string only),
  // so we keep the manual fetch but derive the Bearer header via bearerHeader().
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`OpenAI transcribe: failed to fetch audio (${audioRes.status})`);
  const buf = Buffer.from(await audioRes.arrayBuffer());
  const contentType = audioRes.headers.get('content-type') ?? 'audio/mpeg';

  const form = new FormData();
  form.append('model', model);
  form.append(
    'file',
    new Blob([new Uint8Array(buf)], { type: contentType }),
    audioUrl.split('/').pop() || 'audio',
  );

  const res = await fetch(`${API}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: bearerHeader(ctx) },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI transcribe failed (${res.status}): ${text.slice(0, 300)}`);
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep text */
  }
  const out = (json as { text?: string })?.text ?? '';
  return { outputs: { text: out, raw: json }, logs: [`OpenAI transcribe → ${model}`] };
}

const block: ForgeBlock = {
  id: 'forge_openai_ext',
  name: 'OpenAI (extended)',
  description: 'Chat, complete, embed, image and transcription operations against OpenAI.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'openai' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Run a chat completion. `messages` is JSON or plain text.',
      fields: [
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
        { id: 'messages', label: 'Messages', type: 'textarea', required: true, placeholder: '[{"role":"user","content":"Hi"}]' },
        { id: 'temperature', label: 'Temperature', type: 'number' },
        { id: 'maxTokens', label: 'Max tokens', type: 'number' },
      ],
      run: chat,
    },
    {
      id: 'complete',
      label: 'Text completion',
      description: 'Legacy text completion endpoint.',
      fields: [
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-3.5-turbo-instruct' },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'temperature', label: 'Temperature', type: 'number' },
        { id: 'maxTokens', label: 'Max tokens', type: 'number' },
      ],
      run: complete,
    },
    {
      id: 'image_generate',
      label: 'Generate image',
      description: 'Generate an image with DALL-E.',
      fields: [
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'dall-e-3' },
        { id: 'size', label: 'Size', type: 'text', placeholder: '1024x1024' },
        { id: 'n', label: 'Count', type: 'number', placeholder: '1' },
      ],
      run: imageGenerate,
    },
    {
      id: 'embed',
      label: 'Create embedding',
      description: 'Embed text into a vector.',
      fields: [
        { id: 'input', label: 'Input', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'text-embedding-3-small' },
      ],
      run: embed,
    },
    {
      id: 'transcribe',
      label: 'Transcribe audio (by URL)',
      description: 'Fetch audio from a URL and transcribe with Whisper.',
      fields: [
        { id: 'audioUrl', label: 'Audio URL', type: 'text', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'whisper-1' },
      ],
      run: transcribeStub,
    },
  ],
};

registerForgeBlock(block);
export default block;
