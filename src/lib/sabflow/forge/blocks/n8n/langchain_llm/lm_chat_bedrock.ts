/**
 * Forge block: LM Chat AWS Bedrock
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LmChatAwsBedrock/LmChatAwsBedrock.node.ts
 *
 * AWS Bedrock's `/model/{id}/invoke` requires SigV4-signed requests. We don't
 * yet have a SigV4 signer in the forge shared layer; this block stubs the call
 * and instructs the user to wire in `@aws-sdk/client-bedrock-runtime`. A
 * pre-signed URL path is provided as an interim escape hatch.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const presignedUrl = asString(ctx.options.presignedUrl);
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  const region = asString(ctx.options.region) || 'us-east-1';
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Bedrock: prompt is required');
  const model = asString(ctx.options.model) || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;

  if (!presignedUrl) {
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'Bedrock: SigV4 signing not implemented in forge core. Provide a presignedUrl, or install @aws-sdk/client-bedrock-runtime and extend this block.',
      );
    }
    throw new Error(
      `Bedrock: accessKeyId/secretAccessKey provided but SigV4 signer is not wired (region=${region}). Use presignedUrl as a workaround.`,
    );
  }

  // Anthropic-on-Bedrock payload shape; works for Claude family.
  const payload: Record<string, unknown> = {
    anthropic_version: 'bedrock-2023-05-31',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
  };
  if (system) payload.system = system;

  const res = await apiRequest({
    service: 'Bedrock',
    method: 'POST',
    url: presignedUrl,
    json: payload,
  });
  const body = res.data as { content?: Array<{ text?: string }> };
  const text = (body?.content ?? []).map((c) => c.text ?? '').join('');
  return {
    outputs: { text, raw: res.data },
    logs: [`Bedrock chat → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_chat_bedrock',
  name: 'LM Chat AWS Bedrock',
  description: 'Invoke an AWS Bedrock chat model (SigV4 stub; use presigned URL).',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Chat completion',
      description: 'Single-turn chat against Bedrock invoke endpoint.',
      fields: [
        { id: 'presignedUrl', label: 'Presigned invoke URL', type: 'text', helperText: 'Recommended until SigV4 signer is wired.' },
        { id: 'accessKeyId', label: 'AWS Access Key ID', type: 'password' },
        { id: 'secretAccessKey', label: 'AWS Secret Access Key', type: 'password' },
        { id: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
        { id: 'model', label: 'Model ID', type: 'text', placeholder: 'anthropic.claude-3-5-sonnet-20240620-v1:0' },
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
