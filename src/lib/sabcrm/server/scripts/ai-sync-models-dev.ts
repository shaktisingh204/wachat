// PORT-NOTE: This script fetched the models.dev API and wrote an
// ai-providers.json catalog into the Twenty NestJS engine. It depended on:
//   - twenty-shared/ai (NATIVE_AI_SDK_PROVIDER_IDS, AiSdkPackage)
//   - src/engine/metadata-modules/ai/ai-models/* (NestJS-specific paths)
//   - prettier for formatting
//
// SabNode does not have a twenty-server NestJS engine. If a similar AI-model
// sync is needed, the script should write to a SabNode-local path under
// src/lib/sabcrm/server/ai-models/ai-providers.json and import providers from
// src/lib/sabcrm/shared/src/ai/. The core logic (fetch → filter → generate →
// write) is framework-agnostic and can be reused verbatim once the target path
// constants are updated.
//
// The full source logic is preserved below for reference; uncomment and adapt
// the import paths to activate.

import * as fs from 'fs';
import * as path from 'path';

// PORT-NOTE: Replace these imports with SabNode equivalents when activating.
// import { NATIVE_AI_SDK_PROVIDER_IDS } from '@/lib/sabcrm/shared/src/ai';
// import { inferModelFamily } from './utils/infer-model-family.util';

const MODELS_DEV_API_URL = 'https://models.dev/api.json';

const EXCLUDED_MODEL_PREFIXES = [
  'text-embedding',
  'embedding',
  'dall-e',
  'tts-',
  'whisper',
  'moderation',
  'davinci',
  'babbage',
  'ada',
  'curie',
  'text-search',
  'text-similarity',
  'code-search',
  'text-davinci',
  'text-curie',
  'text-babbage',
  'text-ada',
  'ft:',
  'canary',
];

const EXCLUDED_MODEL_SUFFIXES = ['-audio-preview', '-realtime-preview'];

const LONG_CONTEXT_THRESHOLD_TOKENS = 200000;

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
  xai: 'xAI',
};

const API_KEY_TEMPLATES: Record<string, string> = {
  openai: '{{OPENAI_API_KEY}}',
  anthropic: '{{ANTHROPIC_API_KEY}}',
  google: '{{GOOGLE_API_KEY}}',
  mistral: '{{MISTRAL_API_KEY}}',
  xai: '{{XAI_API_KEY}}',
};

type LongContextCostEntry = {
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  cachedInputCostPerMillionTokens?: number;
  cacheCreationCostPerMillionTokens?: number;
  thresholdTokens: number;
};

type GeneratedModel = {
  name: string;
  label: string;
  description?: string;
  modelFamily?: string;
  inputCostPerMillionTokens?: number;
  outputCostPerMillionTokens?: number;
  cachedInputCostPerMillionTokens?: number;
  cacheCreationCostPerMillionTokens?: number;
  longContextCost?: LongContextCostEntry;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  modalities?: string[];
  supportsReasoning?: boolean;
  isDeprecated?: boolean;
};

type GeneratedProvider = {
  npm: string;
  label: string;
  apiKey: string;
  models: GeneratedModel[];
};

const isLanguageModel = (modelId: string): boolean => {
  const lowerId = modelId.toLowerCase();
  for (const prefix of EXCLUDED_MODEL_PREFIXES) {
    if (lowerId.startsWith(prefix)) return false;
  }
  for (const suffix of EXCLUDED_MODEL_SUFFIXES) {
    if (lowerId.endsWith(suffix)) return false;
  }
  return true;
};

const meetsInclusionCriteria = (modelData: Record<string, unknown>): boolean => {
  if (modelData.status === 'beta') return false;
  if (modelData.tool_call !== true) return false;
  const cost = modelData.cost as { input?: number; output?: number } | undefined;
  if (cost?.input === undefined) return false;
  const limit = modelData.limit as { context?: number; output?: number } | undefined;
  if (limit?.context === undefined) return false;
  return true;
};

const extractCost = (modelData: Record<string, unknown>, model: GeneratedModel): void => {
  const cost = modelData.cost as Record<string, unknown> | undefined;
  if (!cost) return;
  if (typeof cost.input === 'number') model.inputCostPerMillionTokens = cost.input;
  if (typeof cost.output === 'number') model.outputCostPerMillionTokens = cost.output;
  if (typeof cost.cache_read === 'number') model.cachedInputCostPerMillionTokens = cost.cache_read;
  if (typeof cost.cache_write === 'number') model.cacheCreationCostPerMillionTokens = cost.cache_write;

  const longCtx = cost.context_over_200k as Record<string, unknown> | undefined;
  if (longCtx && typeof longCtx.input === 'number') {
    model.longContextCost = {
      inputCostPerMillionTokens: longCtx.input,
      outputCostPerMillionTokens: (longCtx.output as number) ?? 0,
      thresholdTokens: LONG_CONTEXT_THRESHOLD_TOKENS,
    };
    if (typeof longCtx.cache_read === 'number') {
      model.longContextCost.cachedInputCostPerMillionTokens = longCtx.cache_read;
    }
    if (typeof longCtx.cache_write === 'number') {
      model.longContextCost.cacheCreationCostPerMillionTokens = longCtx.cache_write;
    }
  }
};

const extractLimits = (modelData: Record<string, unknown>, model: GeneratedModel): void => {
  const limit = modelData.limit as Record<string, unknown> | undefined;
  if (!limit) return;
  if (typeof limit.context === 'number') model.contextWindowTokens = limit.context;
  if (typeof limit.output === 'number') model.maxOutputTokens = limit.output;
};

const extractModalities = (modelData: Record<string, unknown>, model: GeneratedModel): void => {
  const modalities = modelData.modalities as { input?: string[] } | undefined;
  if (!modalities?.input) return;
  const relevant = modalities.input.filter((m) => m !== 'text');
  if (relevant.length > 0) model.modalities = relevant;
};

// PORT-NOTE: Activate by providing NATIVE_AI_SDK_PROVIDER_IDS from shared AI module.
const NATIVE_AI_SDK_PROVIDER_IDS: string[] = [
  'openai',
  'anthropic',
  'google',
  'mistral',
  'xai',
];

type ModelsDevProviderData = {
  models: Record<string, { name: string } & Record<string, unknown>>;
};
type ModelsDevData = Record<string, ModelsDevProviderData>;

const buildModelsForProvider = (
  providerName: string,
  modelsDevModels: Record<string, { name: string } & Record<string, unknown>>,
): GeneratedModel[] => {
  const qualifying: GeneratedModel[] = [];
  for (const [modelId, modelData] of Object.entries(modelsDevModels)) {
    if (!isLanguageModel(modelId)) continue;
    if (!meetsInclusionCriteria(modelData)) continue;

    const model: GeneratedModel = {
      name: modelId,
      label: (modelData.name as string) ?? modelId,
    };

    extractCost(modelData, model);
    extractLimits(modelData, model);
    extractModalities(modelData, model);
    if (modelData.reasoning === true) model.supportsReasoning = true;
    if (modelData.status === 'deprecated') model.isDeprecated = true;

    qualifying.push(model);
  }
  return qualifying;
};

const generateCatalog = (data: ModelsDevData): Record<string, GeneratedProvider> => {
  const result: Record<string, GeneratedProvider> = {};
  for (const providerName of NATIVE_AI_SDK_PROVIDER_IDS) {
    const providerData = data[providerName];
    if (!providerData) {
      console.warn(`Provider "${providerName}" not found in models.dev`);
      continue;
    }
    const models = buildModelsForProvider(providerName, providerData.models);
    if (models.length === 0) {
      console.warn(`No qualifying models for "${providerName}", skipping`);
      continue;
    }
    result[providerName] = {
      npm: `@ai-sdk/${providerName}`,
      label: PROVIDER_LABELS[providerName] ?? providerName,
      apiKey: API_KEY_TEMPLATES[providerName] ?? '',
      models,
    };
  }
  return result;
};

const main = async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Fetching models.dev API...');
  const response = await fetch(MODELS_DEV_API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  const data: ModelsDevData = await response.json() as ModelsDevData;
  console.log(`Fetched ${Object.keys(data).length} providers from models.dev`);

  const generated = generateCatalog(data);
  const json = JSON.stringify(generated, null, 2) + '\n';

  if (dryRun) {
    console.log('[DRY RUN] Would write ai-providers.json');
    return;
  }

  // PORT-NOTE: Update output path to SabNode's CRM AI models directory.
  const outputPath = path.resolve(
    __dirname,
    '../ai-models/ai-providers.json',
  );

  fs.writeFileSync(outputPath, json, 'utf-8');
  console.log(`Wrote ${outputPath}`);
};

main().catch((error) => {
  console.error('AI catalog sync failed:', error);
  process.exit(1);
});
