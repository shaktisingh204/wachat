/**
 * SabFlow share-link helpers.
 *
 * Provides create / revoke / resolve operations for per-doc share tokens.
 * Tokens are stored in the `sabflow_share_links` MongoDB collection.
 *
 * C.8.3 — share-link token API.
 */

import 'server-only';
import { nanoid } from 'nanoid';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export type ShareLinkRole = 'viewer' | 'editor';

export interface ShareLinkDoc {
  _id?: ObjectId;
  docId: string;
  token: string;
  role: ShareLinkRole;
  createdBy: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
}

const COLLECTION = 'sabflow_share_links';

async function col() {
  const { db } = await connectToDatabase();
  return db.collection<ShareLinkDoc>(COLLECTION);
}

/**
 * Create a new share token for a doc.
 *
 * @param docId       The SabFlow doc/flow being shared.
 * @param role        Access level to grant — `'viewer'` or `'editor'`.
 * @param expiresInDays  Number of days until the link expires (default: 7).
 * @param userId      The user who is creating the link.
 * @returns           The generated token string (21 chars, nanoid).
 */
export async function createShareLink(
  docId: string,
  role: ShareLinkRole,
  expiresInDays: number,
  userId: string,
): Promise<string> {
  const token = nanoid(21);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

  const doc: ShareLinkDoc = {
    docId,
    token,
    role,
    createdBy: userId,
    expiresAt,
    createdAt: now,
  };

  const c = await col();
  await c.insertOne(doc);
  return token;
}

/**
 * Revoke a share token by marking it with `revokedAt`.
 * No-ops silently if the token does not exist.
 */
export async function revokeShareLink(token: string): Promise<void> {
  const c = await col();
  await c.updateOne(
    { token, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

/**
 * Resolve a share token to its docId and role.
 *
 * Returns `null` when the token does not exist, is revoked, or has expired.
 */
export async function resolveShareLink(
  token: string,
): Promise<{ docId: string; role: ShareLinkRole } | null> {
  const c = await col();
  const now = new Date();
  const link = await c.findOne({
    token,
    revokedAt: { $exists: false },
    expiresAt: { $gt: now },
  });
  if (!link) return null;
  return { docId: link.docId, role: link.role };
}

/**
 * List all active (non-revoked, non-expired) share links for a doc.
 */
export async function listShareLinks(docId: string): Promise<ShareLinkDoc[]> {
  const c = await col();
  const now = new Date();
  return c
    .find({
      docId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: now },
    })
    .sort({ createdAt: -1 })
    .toArray();
}
