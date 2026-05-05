import 'server-only';

/**
 * Cloudflare R2 client — built on the S3-compatible API.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID            — your Cloudflare account ID
 *   R2_ACCESS_KEY_ID         — R2 token access key
 *   R2_SECRET_ACCESS_KEY     — R2 token secret
 *   R2_BUCKET                — bucket name
 *   R2_PUBLIC_URL (optional) — public CDN base, e.g. https://files.sabnode.com
 *                              When unset, a presigned GET URL is returned
 *                              instead. Public URL is preferred so we don't
 *                              expire/regenerate URLs on every render.
 */

import type {
  PutObjectCommandInput,
  S3Client as S3ClientT,
} from '@aws-sdk/client-s3';

type R2Env = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl?: string;
};

function readEnv(): R2Env {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_URL,
  } = process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error(
      'R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET',
    );
  }

  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicUrl: R2_PUBLIC_URL,
  };
}

let cachedClient: S3ClientT | null = null;
let cachedSdk: typeof import('@aws-sdk/client-s3') | null = null;

async function getClient() {
  if (cachedClient && cachedSdk) return { client: cachedClient, sdk: cachedSdk };
  const env = readEnv();
  const name = '@aws-sdk/client-s3';
  const sdk = (await import(/* webpackIgnore: true */ /* @vite-ignore */ name)) as typeof import('@aws-sdk/client-s3');
  cachedSdk = sdk;
  cachedClient = new sdk.S3Client({
    region: 'auto',
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
  return { client: cachedClient, sdk };
}

export interface R2UploadInput {
  key: string;
  body: Buffer | Uint8Array | Blob | string;
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

export interface R2UploadResult {
  key: string;
  url: string;
  size: number;
}

export async function uploadToR2(input: R2UploadInput): Promise<R2UploadResult> {
  const env = readEnv();
  const { client, sdk } = await getClient();

  // Normalize body to Buffer for size accounting.
  let body: PutObjectCommandInput['Body'];
  let size = 0;
  if (Buffer.isBuffer(input.body) || input.body instanceof Uint8Array) {
    body = input.body;
    size = input.body.byteLength;
  } else if (typeof input.body === 'string') {
    const buf = Buffer.from(input.body, 'utf8');
    body = buf;
    size = buf.byteLength;
  } else {
    const buf = Buffer.from(await (input.body as Blob).arrayBuffer());
    body = buf;
    size = buf.byteLength;
  }

  await client.send(
    new sdk.PutObjectCommand({
      Bucket: env.bucket,
      Key: input.key,
      Body: body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl ?? 'public, max-age=31536000, immutable',
      Metadata: input.metadata,
    }),
  );

  const url = env.publicUrl
    ? `${env.publicUrl.replace(/\/$/, '')}/${input.key}`
    : await presignedGetUrl(input.key);

  return { key: input.key, url, size };
}

export async function deleteFromR2(key: string): Promise<void> {
  const env = readEnv();
  const { client, sdk } = await getClient();
  await client.send(new sdk.DeleteObjectCommand({ Bucket: env.bucket, Key: key }));
}

export async function presignedGetUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const env = readEnv();
  const { client, sdk } = await getClient();
  const presignName = '@aws-sdk/s3-request-presigner';
  const presigner = (await import(/* webpackIgnore: true */ /* @vite-ignore */ presignName)) as typeof import('@aws-sdk/s3-request-presigner');
  return presigner.getSignedUrl(
    client,
    new sdk.GetObjectCommand({ Bucket: env.bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * Build a stable storage key for a user-owned upload.
 * Path shape: `users/<userId>/files/<yyyy>/<mm>/<uuid>-<safeFileName>`
 */
export function buildFileKey(userId: string, fileName: string): string {
  const safe = fileName
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'file';
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `users/${userId}/files/${yyyy}/${mm}/${uuid}-${safe}`;
}
