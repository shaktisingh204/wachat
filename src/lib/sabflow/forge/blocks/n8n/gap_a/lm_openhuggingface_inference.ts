/**
 * Forge block: LM HuggingFace Inference
 *
 * POST https://api-inference.huggingface.co/models/{model}
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/llms/LMOpenHuggingFaceInference
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function chat(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('HuggingFace Inference: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('HuggingFace Inference: prompt is required');
  const model = asString(ctx.options.model);
  if (!model) throw new Error('HuggingFace Inference: model is required');
  const system = asString(ctx.options.system);
  const temperature = asNumber(ctx.options.temperature) ?? 0.7;
  const maxTokens = asNumber(ctx.options.maxTokens) ?? 1024;
  const composed = system ? `${system}\n\n${prompt}` : prompt;

  const res = await apiRequest({
    service: 'HuggingFace Inference',
    method: 'POST',
    url: `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      inputs: composed,
      parameters: { temperature, max_new_tokens: maxTokens, return_full_text: false },
    },
  });
  const data = res.data;
  let text = '';
  if (Array.isArray(data)) {
    const first = data[0] as { generated_text?: string } | undefined;
    text = first?.generated_text ?? '';
  } else if (data && typeof data === 'object') {
    const d = data as { generated_text?: string };
    text = d.generated_text ?? '';
  } else if (typeof data === 'string') {
    text = data;
  }
  return {
    outputs: { text, raw: data },
    logs: [`HF Inference → ${model}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lm_openhuggingface_inference',
  name: 'LM HuggingFace Inference',
  description: 'Text generation via the public HuggingFace Inference API.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'chat',
      label: 'Generate',
      description: 'Single-prompt inference against a HuggingFace hosted model.',
      fields: [
        { id: 'apiKey', label: 'API key (HF token)', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', required: true, placeholder: 'mistralai/Mistral-7B-Instruct-v0.2' },
        { id: 'system', label: 'System prompt (prepended)', type: 'textarea' },
        { id: 'prompt', label: 'User prompt', type: 'textarea', required: true },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
        { id: 'maxTokens', label: 'Max new tokens', type: 'number', defaultValue: 1024 },
      ],
      run: chat,
    },
  ],
};

registerForgeBlock(block);
export default block;
