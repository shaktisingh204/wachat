/**
 * Forge block: HuggingFace Inference (extended)
 *
 * Hits `https://api-inference.huggingface.co/models/{id}` for several task
 * types: text-generation, text-classification, summarization, feature
 * extraction.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api-inference.huggingface.co/models';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('HuggingFace: apiKey is required');
  return { Authorization: `Bearer ${apiKey}` };
}

function parseOptionalJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`HuggingFace: ${label} must be valid JSON`);
  }
}

async function runInference(
  ctx: ForgeActionContext,
  task: string,
  defaultModel: string,
): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || defaultModel;
  const inputs = asString(ctx.options.inputs);
  const parameters = parseOptionalJson(ctx.options.parameters, 'parameters');
  if (!inputs) throw new Error('HuggingFace: inputs is required');
  const body: Record<string, unknown> = { inputs };
  if (parameters !== undefined) body.parameters = parameters;
  const res = await apiRequest({
    service: 'HuggingFace',
    method: 'POST',
    url: `${API}/${encodeURI(model)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`HuggingFace ${task} → ${model}`] };
}

const textGeneration = (ctx: ForgeActionContext) =>
  runInference(ctx, 'text-generation', 'gpt2');
const textClassification = (ctx: ForgeActionContext) =>
  runInference(ctx, 'text-classification', 'distilbert-base-uncased-finetuned-sst-2-english');
const summarization = (ctx: ForgeActionContext) =>
  runInference(ctx, 'summarization', 'facebook/bart-large-cnn');
const featureExtraction = (ctx: ForgeActionContext) =>
  runInference(ctx, 'feature-extraction', 'sentence-transformers/all-MiniLM-L6-v2');

function baseFields(defaultModel: string) {
  return [
    { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
    { id: 'model', label: 'Model', type: 'text' as const, defaultValue: defaultModel },
    { id: 'inputs', label: 'Inputs', type: 'textarea' as const, required: true },
    { id: 'parameters', label: 'Parameters (JSON)', type: 'json' as const },
  ];
}

const block: ForgeBlock = {
  id: 'forge_huggingface_inference',
  name: 'HuggingFace Inference',
  description: 'Call the HuggingFace Inference API across text tasks.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    { id: 'text_generation', label: 'Text generation', fields: baseFields('gpt2'), run: textGeneration },
    { id: 'text_classification', label: 'Text classification', fields: baseFields('distilbert-base-uncased-finetuned-sst-2-english'), run: textClassification },
    { id: 'summarization', label: 'Summarization', fields: baseFields('facebook/bart-large-cnn'), run: summarization },
    { id: 'feature_extraction', label: 'Feature extraction', fields: baseFields('sentence-transformers/all-MiniLM-L6-v2'), run: featureExtraction },
  ],
};

registerForgeBlock(block);
export default block;
