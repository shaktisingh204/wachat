'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getTemplates } from '@/app/actions/template.actions';

async function getClient() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error('R2 not configured');
  }
  
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  
  return { client, PutObjectCommand, getSignedUrl, bucket: R2_BUCKET, publicUrl: R2_PUBLIC_URL };
}

export async function getPresignedUploadUrl(fileName: string, mimeType: string) {
  const session = await getSession();
  const userId = (session as any)?.user?._id || (session as any)?.user?.id;
  if (!userId) throw new Error('Unauthorized');
  
  const safe = fileName.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'file';
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const key = `users/${userId}/wachat_media/${yyyy}/${mm}/${uuid}-${safe}`;

  const { client, PutObjectCommand, getSignedUrl, bucket, publicUrl } = await getClient();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
  });
  
  const url = await getSignedUrl(client, command, { expiresIn: 3600 });
  
  return {
    uploadUrl: url,
    publicUrl: publicUrl ? `${publicUrl.replace(/\/$/, '')}/${key}` : `https://${bucket}.r2.cloudflarestorage.com/${key}`,
  };
}

export async function getMediaLibraryMeta(projectId: string) {
  const { db } = await connectToDatabase();
  const meta = await db.collection('wachat_media_meta').find({ projectId }).toArray();
  return meta.map(m => ({
    mediaId: m.mediaId,
    tags: m.tags || [],
    folder: m.folder || null,
    nameOverride: m.nameOverride || null,
  }));
}

export async function updateMediaMeta(projectId: string, mediaId: string, tags: string[], folder: string | null) {
  const { db } = await connectToDatabase();
  await db.collection('wachat_media_meta').updateOne(
    { projectId, mediaId },
    { $set: { tags, folder } },
    { upsert: true }
  );
  return { success: true };
}

export async function renameMediaLocal(projectId: string, mediaId: string, newName: string) {
  const { db } = await connectToDatabase();
  await db.collection('wachat_media_meta').updateOne(
    { projectId, mediaId },
    { $set: { nameOverride: newName } },
    { upsert: true }
  );
  return { success: true };
}

export async function getMediaUsage(projectId: string) {
  const templates = await getTemplates(projectId);
  const usage: Record<string, number> = {};
  
  for (const t of templates) {
    const jsonStr = JSON.stringify(t.components || []);
    // We count instances of URLs in the template components JSON
    // Instead of parsing each structure perfectly, a regex match on URLs will find all occurrences.
    const urlMatches = jsonStr.match(/https?:\/\/[^"'\s]+/g) || [];
    for (const url of urlMatches) {
        usage[url] = (usage[url] || 0) + 1;
    }
    if (t.headerMediaUrl) {
        usage[t.headerMediaUrl] = (usage[t.headerMediaUrl] || 0) + 1;
    }
  }
  
  return usage;
}

