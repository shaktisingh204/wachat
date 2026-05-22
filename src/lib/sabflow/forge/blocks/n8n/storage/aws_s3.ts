/**
 * Forge block: AWS S3
 *
 * Source: n8n-master/packages/nodes-base/nodes/S3/S3.node.ts (and Aws/S3/)
 * Credential type: 'aws_s3' — { accessKeyId, secretAccessKey, region, bucket? }
 *
 * Real SigV4 via `@aws-sdk/client-s3`. The SDK signs every request internally,
 * so callers just provide a SabFlow credential and the operation parameters.
 *
 * Actions:
 *   - file_list         ListObjectsV2 (defaults bucket to credential.bucket)
 *   - file_upload       PutObject with base64-decoded body
 *   - file_download     GetObject, returns the object body as base64
 *   - file_delete       DeleteObject
 *   - presigned_get_url Issue a presigned GET URL via @aws-sdk/s3-request-presigner
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString, requireCredential } from '../_shared/http';
import { uploadStreamToSabFiles } from '../_shared/sabfiles';

type S3Cred = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket?: string;
};

function credFor(ctx: ForgeActionContext): S3Cred {
  const raw = requireCredential('AWS S3', ctx.credential);
  const accessKeyId = asString(raw.accessKeyId);
  const secretAccessKey = asString(raw.secretAccessKey);
  const region = asString(raw.region);
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS S3: credential must include accessKeyId, secretAccessKey, region');
  }
  return { accessKeyId, secretAccessKey, region, bucket: asString(raw.bucket) || undefined };
}

async function clientFor(ctx: ForgeActionContext): Promise<{ client: any; cred: S3Cred }> {
  const cred = credFor(ctx);
  const { S3Client: S3ClientCtor } = await import('@aws-sdk/client-s3');
  const client = new S3ClientCtor({
    region: cred.region,
    credentials: { accessKeyId: cred.accessKeyId, secretAccessKey: cred.secretAccessKey },
  });
  return { client, cred };
}

function pickBucket(ctx: ForgeActionContext, cred: S3Cred): string {
  const explicit = asString(ctx.options.bucket);
  const bucket = explicit || cred.bucket || '';
  if (!bucket) {
    throw new Error('AWS S3: bucket is required (set on the action or as the credential default)');
  }
  return bucket;
}

async function streamToBase64(body: unknown): Promise<string> {
  if (!body) return '';
  // AWS SDK v3 returns a web ReadableStream (or a Node Readable in some envs).
  // `Response` happily wraps either and gives us an ArrayBuffer.
  const buf = await new Response(body as BodyInit).arrayBuffer();
  return Buffer.from(buf).toString('base64');
}

async function fileList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { client, cred } = await clientFor(ctx);
  const bucket = pickBucket(ctx, cred);
  const prefix = asString(ctx.options.prefix) || undefined;
  const maxKeys = asNumber(ctx.options.maxKeys) ?? 100;
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const res: any = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: maxKeys }),
  );
  const objects = ((res.Contents as any[]) ?? []).map((o: any) => ({
    key: o.Key ?? null,
    size: o.Size ?? null,
    etag: o.ETag ?? null,
    lastModified: o.LastModified?.toISOString() ?? null,
    storageClass: o.StorageClass ?? null,
  }));
  return {
    outputs: {
      bucket,
      prefix: prefix ?? null,
      count: objects.length,
      isTruncated: res.IsTruncated ?? false,
      nextContinuationToken: res.NextContinuationToken ?? null,
      objects,
    },
    logs: [`S3 list ${bucket}${prefix ? `/${prefix}` : ''} → ${objects.length} object(s)`],
  };
}

async function fileUpload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { client, cred } = await clientFor(ctx);
  const bucket = pickBucket(ctx, cred);
  const key = asString(ctx.options.key);
  if (!key) throw new Error('AWS S3: key is required for upload');
  const bodyRaw = asString(ctx.options.body);
  const contentType = asString(ctx.options.contentType) || 'application/octet-stream';
  let body: Buffer;
  try {
    body = Buffer.from(bodyRaw, 'base64');
  } catch {
    throw new Error('AWS S3: body must be a base64-encoded string');
  }
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const res: any = await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
  return {
    outputs: {
      bucket,
      key,
      etag: res.ETag ?? null,
      versionId: res.VersionId ?? null,
      size: body.byteLength,
    },
    logs: [`S3 upload ${bucket}/${key} → ${body.byteLength} bytes`],
  };
}

async function fileDownload(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { client, cred } = await clientFor(ctx);
  const bucket = pickBucket(ctx, cred);
  const key = asString(ctx.options.key);
  if (!key) throw new Error('AWS S3: key is required for download');
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const res: any = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  
  const name = key.split('/').pop() || 'download';
  const sabFile = await uploadStreamToSabFiles(
    ctx,
    name,
    (res.ContentType as string) ?? 'application/octet-stream',
    res.Body as any,
    res.ContentLength as number
  );

  return {
    outputs: {
      bucket,
      key,
      fileId: sabFile.id,
      fileName: sabFile.name,
      contentType: sabFile.mime,
      contentLength: sabFile.size,
    },
    logs: [`S3 download ${bucket}/${key} → SabFiles ${sabFile.id} (${sabFile.size} bytes)`],
  };
}

async function fileDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { client, cred } = await clientFor(ctx);
  const bucket = pickBucket(ctx, cred);
  const key = asString(ctx.options.key);
  if (!key) throw new Error('AWS S3: key is required for delete');
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  return {
    outputs: { bucket, key, deleted: true },
    logs: [`S3 delete ${bucket}/${key}`],
  };
}

async function presignedGetUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { client, cred } = await clientFor(ctx);
  const bucket = pickBucket(ctx, cred);
  const key = asString(ctx.options.key);
  if (!key) throw new Error('AWS S3: key is required for presigned GET URL');
  const expiresIn = asNumber(ctx.options.expiresIn) ?? 900; // 15 min default
  const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
    import('@aws-sdk/client-s3'),
    import('@aws-sdk/s3-request-presigner'),
  ]);
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }) as any,
    { expiresIn },
  );
  return {
    outputs: { bucket, key, url, expiresIn },
    logs: [`S3 presigned GET ${bucket}/${key} (expires in ${expiresIn}s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_aws_s3',
  name: 'AWS S3',
  description: 'List, upload, download and delete S3 objects (SigV4 via AWS SDK v3).',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'aws_s3',
  },
  actions: [
    {
      id: 'file_list',
      label: 'List objects',
      description: 'ListObjectsV2 against the bucket (defaults to credential bucket).',
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'text', placeholder: 'leave empty to use credential default' },
        { id: 'prefix', label: 'Prefix', type: 'text', placeholder: 'folder/' },
        { id: 'maxKeys', label: 'Max keys', type: 'number', defaultValue: 100 },
      ],
      run: fileList,
    },
    {
      id: 'file_upload',
      label: 'Upload file',
      description: 'PutObject — body must be base64-encoded.',
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'text' },
        { id: 'key', label: 'Object key', type: 'text', required: true, placeholder: 'folder/file.txt' },
        { id: 'body', label: 'Body (base64)', type: 'textarea', required: true },
        { id: 'contentType', label: 'Content-Type', type: 'text', defaultValue: 'application/octet-stream' },
      ],
      run: fileUpload,
    },
    {
      id: 'file_download',
      label: 'Download file',
      description: 'GetObject — returns the body as base64.',
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'text' },
        { id: 'key', label: 'Object key', type: 'text', required: true },
      ],
      run: fileDownload,
    },
    {
      id: 'file_delete',
      label: 'Delete object',
      description: 'DeleteObject by key.',
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'text' },
        { id: 'key', label: 'Object key', type: 'text', required: true },
      ],
      run: fileDelete,
    },
    {
      id: 'presigned_get_url',
      label: 'Presigned GET URL',
      description: 'Issue a presigned URL for browser-side download.',
      fields: [
        { id: 'bucket', label: 'Bucket', type: 'text' },
        { id: 'key', label: 'Object key', type: 'text', required: true },
        { id: 'expiresIn', label: 'Expires in (seconds)', type: 'number', defaultValue: 900 },
      ],
      run: presignedGetUrl,
    },
  ],
};

registerForgeBlock(block);
export default block;
