import 'server-only';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { presignedGetUrl } from '@/lib/r2';
import type { SabsmsMedia } from '@/lib/sabsms/types';

/**
 * Public-API MMS media resolver (V2.13 / V2.4 de-mock).
 *
 * The send route accepts `mediaSabFileIds` (SabFiles ids — raw URLs are
 * refused per the SabFiles policy). Until now those ids were passed to the
 * engine as bare `media: [{ sabFileId, mime: 'application/octet-stream',
 * bytes: 0 }]` metadata only — the worker builds provider SendOptions ONLY
 * from `mediaUrls`, so MMS silently degraded to a text SMS.
 *
 * This module closes that gap: it loads the SabFiles docs WORKSPACE-SCOPED
 * (in SabSMS, `workspaceId` is the owning user `_id` hex, which is the
 * `userId` on the `user_files` collection), 404s on missing/foreign ids,
 * and resolves each id to a publicly fetchable URL the provider (Twilio
 * MMS / etc.) can GET:
 *
 *   - the stored `url` when it is an absolute public R2/CDN URL
 *     (R2_PUBLIC_URL configured at upload time), OR
 *   - a freshly presigned GET URL derived from the object `key` otherwise
 *     (the stored `url` may be a session-gated `/api/sabfiles/raw/<id>`
 *     redirect, which a provider can't fetch).
 *
 * It also returns real `mime` + `bytes` for the engine `media[]` metadata.
 */

/** Mongo collection backing the classic SabFiles library (per `files.actions.ts`). */
const USER_FILES_COLLECTION = 'user_files';

/** Presigned GET URL lifetime for provider fetch — generous so MMS delivery retries succeed. */
const MEDIA_PRESIGN_TTL_SECONDS = 24 * 60 * 60;

export interface ResolvedMedia {
  /** Resolved `media[]` metadata for the engine doc (real mime + bytes). */
  media: SabsmsMedia[];
  /** Publicly fetchable URLs for the provider — what actually sends MMS. */
  mediaUrls: string[];
}

export type ResolveMediaOutcome =
  | { ok: true; resolved: ResolvedMedia }
  | { ok: false; status: 404 | 422; code: string; message: string };

interface UserFileDoc {
  _id?: ObjectId;
  userId: string;
  name?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  key?: string;
}

/** True for an absolute http(s) URL a remote provider can fetch directly. */
function isAbsolutePublicUrl(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

/**
 * Resolve `mediaSabFileIds` → provider-fetchable URLs + engine media
 * metadata. Caller has already validated the ids are 24-hex strings.
 */
export async function resolveMmsMedia(
  workspaceId: string,
  mediaSabFileIds: string[],
): Promise<ResolveMediaOutcome> {
  const ids = [...new Set(mediaSabFileIds)];
  if (ids.length === 0) {
    return { ok: true, resolved: { media: [], mediaUrls: [] } };
  }

  const objectIds = ids.map((id) => new ObjectId(id));
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection<UserFileDoc>(USER_FILES_COLLECTION)
    .find({ _id: { $in: objectIds }, userId: workspaceId })
    .toArray()) as UserFileDoc[];

  const byId = new Map(docs.map((d) => [String(d._id), d] as const));

  // 404 on any id that does not exist OR belongs to another workspace —
  // a foreign id is indistinguishable from a missing one (no enumeration).
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      status: 404,
      code: 'not_found',
      message: `Media file id(s) not found in your SabFiles library: ${missing.join(', ')}`,
    };
  }

  const media: SabsmsMedia[] = [];
  const mediaUrls: string[] = [];

  for (const id of ids) {
    const doc = byId.get(id)!;
    let url: string | null = null;
    if (isAbsolutePublicUrl(doc.url)) {
      url = doc.url;
    } else if (doc.key) {
      try {
        url = await presignedGetUrl(doc.key, MEDIA_PRESIGN_TTL_SECONDS);
      } catch {
        url = null;
      }
    }

    if (!url) {
      return {
        ok: false,
        status: 422,
        code: 'media_unresolvable',
        message: `Could not resolve a public URL for media file ${id} (no public URL or storage key). Re-upload the file to SabFiles.`,
      };
    }

    mediaUrls.push(url);
    media.push({
      sabFileId: id,
      mime: doc.mimeType || 'application/octet-stream',
      bytes: typeof doc.size === 'number' ? doc.size : 0,
    });
  }

  return { ok: true, resolved: { media, mediaUrls } };
}
