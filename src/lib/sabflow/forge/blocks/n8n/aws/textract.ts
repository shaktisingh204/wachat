/**
 * Forge block: AWS Textract
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/Textract/AwsTextract.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-textract`.
 *
 * Actions: detect-document-text, analyze-document.
 *
 * Document input mirrors Rekognition: either an S3 object (bucket + name) OR a
 * base64-encoded document.
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
    throw new Error('AWS Textract: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type TextractSdk = Record<string, unknown> & {
  TextractClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<TextractSdk> {
  try {
    const mod = await optionalImport<Record<string, unknown>>('@aws-sdk/client-textract');
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as TextractSdk;
    if (typeof real.TextractClient !== 'function') throw new Error('TextractClient missing');
    return real;
  } catch {
    throw new Error("AWS Textract: install '@aws-sdk/client-textract' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: TextractSdk): SdkClient {
  return new sdk.TextractClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

async function runCommand(sdk: TextractSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS Textract: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

function buildDocumentParam(ctx: ForgeActionContext): Record<string, unknown> {
  const bucket = asString(ctx.options.s3Bucket);
  const name = asString(ctx.options.s3Name);
  const version = asString(ctx.options.s3Version);
  const base64 = asString(ctx.options.documentBase64);
  if (bucket && name) {
    const S3Object: Record<string, unknown> = { Bucket: bucket, Name: name };
    if (version) S3Object.Version = version;
    return { S3Object };
  }
  if (base64) {
    return { Bytes: Buffer.from(base64, 'base64') };
  }
  throw new Error('AWS Textract: provide either (s3Bucket + s3Name) or documentBase64');
}

async function detectDocumentText(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Document = buildDocumentParam(ctx);
  const res = await runCommand(sdk, 'DetectDocumentTextCommand', { Document }, cred);
  const blocks = (res.Blocks as unknown[] | undefined) ?? [];
  return {
    outputs: { blocks, documentMetadata: res.DocumentMetadata ?? null },
    logs: [`Textract DetectDocumentText → ${blocks.length} block(s)`],
  };
}

async function analyzeDocument(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Document = buildDocumentParam(ctx);
  const featuresRaw = asString(ctx.options.featureTypes).trim();
  if (!featuresRaw) {
    throw new Error('AWS Textract: featureTypes is required (CSV — TABLES, FORMS, SIGNATURES, LAYOUT)');
  }
  const FeatureTypes = featuresRaw
    .split(/[,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const res = await runCommand(sdk, 'AnalyzeDocumentCommand', { Document, FeatureTypes }, cred);
  const blocks = (res.Blocks as unknown[] | undefined) ?? [];
  return {
    outputs: {
      blocks,
      documentMetadata: res.DocumentMetadata ?? null,
      analyzeDocumentModelVersion: res.AnalyzeDocumentModelVersion ?? null,
    },
    logs: [`Textract AnalyzeDocument [${FeatureTypes.join(',')}] → ${blocks.length} block(s)`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const DOC_FIELDS: ForgeField[] = [
  { id: 's3Bucket', label: 'S3 bucket (doc source)', type: 'text' },
  { id: 's3Name', label: 'S3 object key', type: 'text' },
  { id: 's3Version', label: 'S3 object version', type: 'text' },
  { id: 'documentBase64', label: 'Document (base64) — alternative to S3', type: 'textarea' },
];

const block: ForgeBlock = {
  id: 'forge_aws_textract',
  name: 'AWS Textract',
  description: 'Extract text, tables and forms from documents.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'detect_document_text',
      label: 'Detect document text',
      description: 'Plain OCR — lines and words.',
      fields: [...CRED_FIELDS, ...DOC_FIELDS],
      run: detectDocumentText,
    },
    {
      id: 'analyze_document',
      label: 'Analyze document',
      description: 'Structured extraction — TABLES, FORMS, SIGNATURES, LAYOUT.',
      fields: [
        ...CRED_FIELDS,
        ...DOC_FIELDS,
        {
          id: 'featureTypes',
          label: 'Feature types (CSV)',
          type: 'text',
          required: true,
          placeholder: 'TABLES, FORMS',
        },
      ],
      run: analyzeDocument,
    },
  ],
};

registerForgeBlock(block);
export default block;
