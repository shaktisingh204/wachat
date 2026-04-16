/**
 * SabFlow — AWS S3 storage adapter
 *
 * `@aws-sdk/client-s3` is an optional dependency.  We load it dynamically so
 * that the rest of the codebase can keep working when S3 is not installed /
 * not configured.  If the SDK is missing, every method throws a clear error
 * — swap `SABFLOW_STORAGE_PROVIDER` to `local` to avoid hitting this path.
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import type { StorageAdapter, StorageUploadResult } from './adapter';

interface S3Config {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

function readConfig(): S3Config {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_S3_REGION;

  if (!bucket || !region) {
    throw new Error(
      'S3 not configured — set AWS_S3_BUCKET and AWS_S3_REGION env vars.',
    );
  }

  return {
    bucket,
    region,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

/** Runtime type-checked reference to the AWS SDK module. */
type S3SdkModule = typeof import('@aws-sdk/client-s3');

/** Load the AWS SDK lazily — returns null when the package isn't installed. */
async function loadSdk(): Promise<S3SdkModule | null> {
  try {
    // `@aws-sdk/client-s3` is optional. If the package isn't installed, the
    // dynamic import throws and we return null so callers can surface a clean
    // "S3 not configured" error to the user.
    const mod = (await import('@aws-sdk/client-s3')) as S3SdkModule;
    return mod;
  } catch {
    return null;
  }
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, '_');
  if (!base || base === '.' || base === '..') return 'file';
  return base.length > 180 ? base.slice(-180) : base;
}

export class S3StorageAdapter implements StorageAdapter {
  async upload(
    file: Buffer,
    filename: string,
    contentType: string,
  ): Promise<StorageUploadResult> {
    const sdk = await loadSdk();
    if (!sdk) {
      throw new Error(
        'S3 not configured — install @aws-sdk/client-s3 to use the S3 provider.',
      );
    }

    const cfg = readConfig();
    const client = new sdk.S3Client({
      region: cfg.region,
      credentials:
        cfg.accessKeyId && cfg.secretAccessKey
          ? {
              accessKeyId: cfg.accessKeyId,
              secretAccessKey: cfg.secretAccessKey,
            }
          : undefined,
    });

    const key = `sabflow/${uuidv4()}-${sanitizeFilename(filename)}`;

    await client.send(
      new sdk.PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      }),
    );

    const url = `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${encodeURI(key)}`;
    return { url, key };
  }

  async delete(key: string): Promise<void> {
    const sdk = await loadSdk();
    if (!sdk) {
      throw new Error(
        'S3 not configured — install @aws-sdk/client-s3 to use the S3 provider.',
      );
    }

    const cfg = readConfig();
    const client = new sdk.S3Client({
      region: cfg.region,
      credentials:
        cfg.accessKeyId && cfg.secretAccessKey
          ? {
              accessKeyId: cfg.accessKeyId,
              secretAccessKey: cfg.secretAccessKey,
            }
          : undefined,
    });

    await client.send(
      new sdk.DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const sdk = await loadSdk();
    if (!sdk) {
      throw new Error(
        'S3 not configured — install @aws-sdk/client-s3 to use the S3 provider.',
      );
    }

    // Signed URLs live in a separate subpackage — load it dynamically too.
    let presigner: typeof import('@aws-sdk/s3-request-presigner');
    try {
      presigner = (await import(
        '@aws-sdk/s3-request-presigner'
      )) as typeof import('@aws-sdk/s3-request-presigner');
    } catch {
      throw new Error(
        'S3 presigner not configured — install @aws-sdk/s3-request-presigner.',
      );
    }

    const cfg = readConfig();
    const client = new sdk.S3Client({
      region: cfg.region,
      credentials:
        cfg.accessKeyId && cfg.secretAccessKey
          ? {
              accessKeyId: cfg.accessKeyId,
              secretAccessKey: cfg.secretAccessKey,
            }
          : undefined,
    });

    return presigner.getSignedUrl(
      client,
      new sdk.GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
