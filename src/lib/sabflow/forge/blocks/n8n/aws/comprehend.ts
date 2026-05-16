/**
 * Forge block: AWS Comprehend
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/Comprehend/AwsComprehend.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-comprehend`.
 *
 * Actions: detect-language, detect-sentiment, detect-entities, detect-key-phrases.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock, ForgeField } from '../../../types';
import { asString } from '../_shared/http';
import { optionalImport } from '../_shared/optional_import';

type AwsCred = { accessKeyId: string; secretAccessKey: string; region: string };

function readCred(ctx: ForgeActionContext): AwsCred {
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  const region = asString(ctx.options.region);
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS Comprehend: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type ComprehendSdk = Record<string, unknown> & {
  ComprehendClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<ComprehendSdk> {
  try {
    const mod = await optionalImport<Record<string, unknown>>('@aws-sdk/client-comprehend');
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as ComprehendSdk;
    if (typeof real.ComprehendClient !== 'function') throw new Error('ComprehendClient missing');
    return real;
  } catch {
    throw new Error("AWS Comprehend: install '@aws-sdk/client-comprehend' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: ComprehendSdk): SdkClient {
  return new sdk.ComprehendClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

async function runCommand(sdk: ComprehendSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS Comprehend: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

function readText(ctx: ForgeActionContext): string {
  const Text = asString(ctx.options.text);
  if (!Text) throw new Error('AWS Comprehend: text is required');
  return Text;
}

async function detectLanguage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Text = readText(ctx);
  const res = await runCommand(sdk, 'DetectDominantLanguageCommand', { Text }, cred);
  const languages = (res.Languages as unknown[] | undefined) ?? [];
  return {
    outputs: { languages },
    logs: [`Comprehend DetectDominantLanguage → ${languages.length} result(s)`],
  };
}

async function detectSentiment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Text = readText(ctx);
  const LanguageCode = asString(ctx.options.languageCode) || 'en';
  const res = await runCommand(sdk, 'DetectSentimentCommand', { Text, LanguageCode }, cred);
  return {
    outputs: { sentiment: res.Sentiment ?? null, sentimentScore: res.SentimentScore ?? null },
    logs: [`Comprehend DetectSentiment → ${asString(res.Sentiment) || 'n/a'}`],
  };
}

async function detectEntities(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Text = readText(ctx);
  const LanguageCode = asString(ctx.options.languageCode) || 'en';
  const res = await runCommand(sdk, 'DetectEntitiesCommand', { Text, LanguageCode }, cred);
  const entities = (res.Entities as unknown[] | undefined) ?? [];
  return {
    outputs: { entities },
    logs: [`Comprehend DetectEntities → ${entities.length} entity/entities`],
  };
}

async function detectKeyPhrases(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Text = readText(ctx);
  const LanguageCode = asString(ctx.options.languageCode) || 'en';
  const res = await runCommand(sdk, 'DetectKeyPhrasesCommand', { Text, LanguageCode }, cred);
  const keyPhrases = (res.KeyPhrases as unknown[] | undefined) ?? [];
  return {
    outputs: { keyPhrases },
    logs: [`Comprehend DetectKeyPhrases → ${keyPhrases.length} phrase(s)`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const TEXT_FIELD: ForgeField = { id: 'text', label: 'Text', type: 'textarea', required: true };
const LANG_FIELD: ForgeField = {
  id: 'languageCode',
  label: 'Language code',
  type: 'text',
  defaultValue: 'en',
  placeholder: 'en, es, de, fr, …',
};

const block: ForgeBlock = {
  id: 'forge_aws_comprehend',
  name: 'AWS Comprehend',
  description: 'Natural-language analysis: language, sentiment, entities, key phrases.',
  iconName: 'LuBrain',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'detect_language',
      label: 'Detect dominant language',
      description: 'DetectDominantLanguage on the provided text.',
      fields: [...CRED_FIELDS, TEXT_FIELD],
      run: detectLanguage,
    },
    {
      id: 'detect_sentiment',
      label: 'Detect sentiment',
      description: 'DetectSentiment (positive / negative / neutral / mixed).',
      fields: [...CRED_FIELDS, TEXT_FIELD, LANG_FIELD],
      run: detectSentiment,
    },
    {
      id: 'detect_entities',
      label: 'Detect entities',
      description: 'DetectEntities (people, places, organisations, …).',
      fields: [...CRED_FIELDS, TEXT_FIELD, LANG_FIELD],
      run: detectEntities,
    },
    {
      id: 'detect_key_phrases',
      label: 'Detect key phrases',
      description: 'DetectKeyPhrases — noun-phrase extraction.',
      fields: [...CRED_FIELDS, TEXT_FIELD, LANG_FIELD],
      run: detectKeyPhrases,
    },
  ],
};

registerForgeBlock(block);
export default block;
