'use server';

import { revalidatePath } from 'next/cache';
import type { ObjectId, WithId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { ApiKey, User } from '@/lib/definitions';
import { rustClient, RustApiError } from '@/lib/rust-client';

export async function generateApiKey(name: string): Promise<{ success: boolean, apiKey?: string, error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Authentication required.' };

  if (!name) return { success: false, error: 'API key name is required.' };

  try {
    const result = await rustClient.wachatApiKeysAdmin.generate({ name });
    revalidatePath('/dashboard/api');
    // Return the plain text key to the user ONCE.
    return { success: true, apiKey: result.apiKey };
  } catch (e) {
    if (e instanceof RustApiError) {
      return { success: false, error: e.message || 'Failed to generate API key.' };
    }
    return { success: false, error: 'Failed to generate API key.' };
  }
}

export async function getApiKeysForUser(): Promise<Omit<ApiKey, 'key'>[]> {
  const session = await getSession();
  if (!session?.user) return [];

  try {
    const summaries = await rustClient.wachatApiKeysAdmin.list();
    // Map Rust DTO ({ id, lastUsedAt, ... }) onto the legacy `ApiKey`-minus-`key`
    // shape the dashboard reads (`_id`, `lastUsed`, `createdAt`). Callers only
    // ever do `.toString()` on `_id`, which is identity for strings, so we can
    // safely cast the Rust string id to `ObjectId` at the type level.
    return summaries.map((s) => ({
      _id: s._id as unknown as ObjectId,
      name: s.name,
      revoked: s.revoked,
      requestCount: s.requestCount,
      createdAt: new Date(s.createdAt),
      lastUsed: s.lastUsedAt ? new Date(s.lastUsedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

export async function revokeApiKey(keyId: string): Promise<{ success: boolean, error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Authentication required.' };

  if (!keyId) return { success: false, error: 'Invalid key ID.' };

  try {
    const result = await rustClient.wachatApiKeysAdmin.revoke(keyId);
    if (!result.success) {
      return { success: false, error: 'API key not found or you do not have permission.' };
    }
    revalidatePath('/dashboard/api');
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError) {
      if (e.status === 404) {
        return { success: false, error: 'API key not found or you do not have permission.' };
      }
      return { success: false, error: e.message || 'Failed to revoke API key.' };
    }
    return { success: false, error: 'Failed to revoke API key.' };
  }
}

/**
 * @deprecated Inbound API-key verification has moved to the Rust
 * `wachat-public-api` crate, which hashes with SHA-256 (byte-compatible with
 * the admin generator) and gates calls server-side. The legacy Next.js
 * `/api/v1/*` route handlers that import this should be migrated to either
 * proxy through `wachat-public-api` or be deleted entirely.
 *
 * This stub exists only to keep those route handlers compiling during the
 * migration window — it always returns `{ success: false }`, so any route
 * still pointed at it will respond 401 until it is rewritten.
 */
export async function authenticateApiKey(_apiKey: string): Promise<{ success: boolean; user?: WithId<User> }> {
  return { success: false };
}
