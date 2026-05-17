/**
 * Forge block: LM Chat Google Vertex AI
 *
 * POST https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/{model}:generateContent
 *
 * Auth: a pre-minted Google OAuth bearer token (gcloud auth print-access-token).
 * Inline `apiKey` field holds the bearer token.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Vertex: apiKey (bearer token) is required');
  const project = asString(ctx.options.project);
  if (!project) throw new Error('Vertex: project is required');
  const region = asString(ctx.options.region) || 'us-central1';
  const model = asString(ctx.options.model) || 'gemini-1.5-flash';
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Vertex: prompt is required');
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  const url =
    `https://${region}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}` +
    `/locations/${encodeURIComponent(region)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await apiRequest({
    service: 'Vertex',
    method: 'POST',
    url,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: body,
  });
  const data = res.data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return {
    outputs: { text, raw: res.data },
    logs: [`Vertex chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_google_vertex',
  name: 'LM Chat Google Vertex',
  description: 'Chat completion via Google Vertex AI generateContent (Gemini family).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Single-turn chat against Vertex AI generateContent.',
      fields: [
        {
          id: 'apiKey',
          label: 'Bearer token',
          type: 'password',
          required: true,
          helperText: 'Use `gcloud auth print-access-token` or a service-account access token.',
        },
        { id: 'project', label: 'GCP project id', type: 'text', required: true },
        { id: 'region', label: 'Region', type: 'text', placeholder: 'us-central1' },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'gemini-1.5-flash' },
        { id: 'system', label: 'System instruction', type: 'textarea' },
        { id: 'prompt', label: 'User prompt', type: 'textarea', required: true },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
        { id: 'maxTokens', label: 'Max output tokens', type: 'number', defaultValue: 1024 },
      ],
      run: chat,
    },
  ],
};

registerForgeBlock(block);
export default block;
