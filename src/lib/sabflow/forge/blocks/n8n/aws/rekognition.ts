/**
 * Forge block: AWS Rekognition
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/Rekognition/AwsRekognition.node.ts
 *
 * Dynamic-imports `@aws-sdk/client-rekognition`.
 *
 * Actions: detect-labels, detect-faces, detect-text.
 *
 * Image input is either an S3 object (bucket + name) OR a base64-encoded
 * image — same shape Rekognition's `Image` parameter accepts.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock, ForgeField } from '../../../types';
import { asNumber, asString } from '../_shared/http';

type AwsCred = { accessKeyId: string; secretAccessKey: string; region: string };

function readCred(ctx: ForgeActionContext): AwsCred {
  const accessKeyId = asString(ctx.options.accessKeyId);
  const secretAccessKey = asString(ctx.options.secretAccessKey);
  const region = asString(ctx.options.region);
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS Rekognition: accessKeyId, secretAccessKey and region are required');
  }
  return { accessKeyId, secretAccessKey, region };
}

type SdkClient = {
  send: (cmd: unknown) => Promise<Record<string, unknown>>;
  destroy?: () => void;
};

type RekogSdk = Record<string, unknown> & {
  RekognitionClient: new (cfg: Record<string, unknown>) => SdkClient;
};

async function loadSdk(): Promise<RekogSdk> {
  try {
    const mod = (await import('@aws-sdk/client-rekognition' as string)) as Record<string, unknown>;
    const real = ((mod as { default?: Record<string, unknown> }).default ?? mod) as RekogSdk;
    if (typeof real.RekognitionClient !== 'function') throw new Error('RekognitionClient missing');
    return real;
  } catch {
    throw new Error("AWS Rekognition: install '@aws-sdk/client-rekognition' to use this block");
  }
}

function clientFor(cred: AwsCred, sdk: RekogSdk): SdkClient {
  return new sdk.RekognitionClient({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
}

async function runCommand(sdk: RekogSdk, cmdName: string, input: Record<string, unknown>, cred: AwsCred): Promise<Record<string, unknown>> {
  const Ctor = sdk[cmdName] as undefined | (new (i: Record<string, unknown>) => unknown);
  if (typeof Ctor !== 'function') {
    throw new Error(`AWS Rekognition: ${cmdName} not available in SDK`);
  }
  const client = clientFor(cred, sdk);
  try {
    return await client.send(new Ctor(input));
  } finally {
    client.destroy?.();
  }
}

function buildImageParam(ctx: ForgeActionContext): Record<string, unknown> {
  const bucket = asString(ctx.options.s3Bucket);
  const name = asString(ctx.options.s3Name);
  const version = asString(ctx.options.s3Version);
  const base64 = asString(ctx.options.imageBase64);
  if (bucket && name) {
    const S3Object: Record<string, unknown> = { Bucket: bucket, Name: name };
    if (version) S3Object.Version = version;
    return { S3Object };
  }
  if (base64) {
    return { Bytes: Buffer.from(base64, 'base64') };
  }
  throw new Error('AWS Rekognition: provide either (s3Bucket + s3Name) or imageBase64');
}

async function detectLabels(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Image = buildImageParam(ctx);
  const MaxLabels = asNumber(ctx.options.maxLabels);
  const MinConfidence = asNumber(ctx.options.minConfidence);
  const input: Record<string, unknown> = { Image };
  if (MaxLabels !== undefined) input.MaxLabels = MaxLabels;
  if (MinConfidence !== undefined) input.MinConfidence = MinConfidence;
  const res = await runCommand(sdk, 'DetectLabelsCommand', input, cred);
  const labels = (res.Labels as unknown[] | undefined) ?? [];
  return {
    outputs: { labels, labelModelVersion: res.LabelModelVersion ?? null },
    logs: [`Rekognition DetectLabels → ${labels.length} label(s)`],
  };
}

async function detectFaces(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Image = buildImageParam(ctx);
  const attributes = asString(ctx.options.attributes).trim();
  const input: Record<string, unknown> = { Image };
  if (attributes) {
    input.Attributes = attributes
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const res = await runCommand(sdk, 'DetectFacesCommand', input, cred);
  const faceDetails = (res.FaceDetails as unknown[] | undefined) ?? [];
  return {
    outputs: { faceDetails },
    logs: [`Rekognition DetectFaces → ${faceDetails.length} face(s)`],
  };
}

async function detectText(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = readCred(ctx);
  const sdk = await loadSdk();
  const Image = buildImageParam(ctx);
  const res = await runCommand(sdk, 'DetectTextCommand', { Image }, cred);
  const textDetections = (res.TextDetections as unknown[] | undefined) ?? [];
  return {
    outputs: { textDetections },
    logs: [`Rekognition DetectText → ${textDetections.length} detection(s)`],
  };
}

const CRED_FIELDS: ForgeField[] = [
  { id: 'accessKeyId', label: 'Access key id', type: 'password', required: true },
  { id: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
  { id: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
];

const IMAGE_FIELDS: ForgeField[] = [
  { id: 's3Bucket', label: 'S3 bucket (image source)', type: 'text' },
  { id: 's3Name', label: 'S3 object key', type: 'text' },
  { id: 's3Version', label: 'S3 object version', type: 'text' },
  { id: 'imageBase64', label: 'Image (base64) — alternative to S3', type: 'textarea' },
];

const block: ForgeBlock = {
  id: 'forge_aws_rekognition',
  name: 'AWS Rekognition',
  description: 'Computer-vision analysis on images (labels, faces, OCR).',
  iconName: 'LuEye',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'detect_labels',
      label: 'Detect labels',
      description: 'Identify objects, scenes and concepts.',
      fields: [
        ...CRED_FIELDS,
        ...IMAGE_FIELDS,
        { id: 'maxLabels', label: 'Max labels', type: 'number' },
        { id: 'minConfidence', label: 'Min confidence (0-100)', type: 'number' },
      ],
      run: detectLabels,
    },
    {
      id: 'detect_faces',
      label: 'Detect faces',
      description: 'Locate faces and (optionally) facial attributes.',
      fields: [
        ...CRED_FIELDS,
        ...IMAGE_FIELDS,
        { id: 'attributes', label: 'Attributes (CSV: DEFAULT, ALL, …)', type: 'text', placeholder: 'DEFAULT' },
      ],
      run: detectFaces,
    },
    {
      id: 'detect_text',
      label: 'Detect text',
      description: 'OCR — extract text from an image.',
      fields: [...CRED_FIELDS, ...IMAGE_FIELDS],
      run: detectText,
    },
  ],
};

registerForgeBlock(block);
export default block;
