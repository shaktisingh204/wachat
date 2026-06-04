'use server';

import 'server-only';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
// C4 flags + C2 revocation store for the staged Mongo→Postgres auth migration.
// Defaults (off) keep this byte-identical to today.
import {
  shouldWritePg,
  shouldWriteMongo,
  shouldReadPg,
  pgReadAllowsFallback,
  authPgRead,
} from '@/lib/identity/auth-flags';
import { pgRevocationStore } from '@/lib/identity/pg-stores';
// V-4: inline parameterized Postgres access for account preferences.
// Preferences live in sabnode_identity.users.profile->'preferences', mirroring
// the Mongo users.preferences shape. All PG paths are flag-gated; defaults
// (off/mongo) keep behaviour byte-identical to the Mongo-only implementation.
import { pgQuery } from '@/lib/postgres';

/**
 * V-4 helper: read the `preferences` object out of the Postgres
 * `sabnode_identity.users.profile` JSONB, keyed on legacy_mongo_id.
 * Returns the preferences sub-object, or:
 *   - `undefined` on a hard error/miss (caller decides fallback), or
 *   - `{}` when the row exists but has no preferences yet.
 * Distinguishes "no row" (returns undefined → miss) from "row, empty prefs".
 */
async function pgReadPreferences(
  userId: string,
): Promise<Record<string, unknown> | undefined> {
  const { rows } = await pgQuery<{ preferences: Record<string, unknown> | null }>(
    `SELECT (profile->'preferences') AS preferences
       FROM sabnode_identity.users
      WHERE legacy_mongo_id = $1`,
    [userId],
  );
  if (rows.length === 0) return undefined; // no PG row → treat as miss
  return (rows[0].preferences ?? {}) as Record<string, unknown>;
}

/**
 * V-4 helper: write a single preferences key into the Postgres
 * `sabnode_identity.users.profile` JSONB (best-effort; never fatal).
 * Uses jsonb_set with create_missing=true and COALESCE so a null profile /
 * missing preferences object is created rather than no-op'd. The path is the
 * dotted Mongo key (e.g. 'loginAlerts', 'appearance') under preferences.
 */
async function pgWritePreferenceKey(
  userId: string,
  key: string,
  value: unknown,
): Promise<void> {
  // jsonb_set's create_missing only creates the LEAF key, not intermediate
  // parents — so first guarantee profile.preferences exists (as {}), then set
  // the leaf key under it. Two nested jsonb_set calls keep this a single
  // parameterized statement.
  await pgQuery(
    `UPDATE sabnode_identity.users
        SET profile = jsonb_set(
              jsonb_set(
                COALESCE(profile, '{}'::jsonb),
                ARRAY['preferences'],
                COALESCE(profile->'preferences', '{}'::jsonb),
                true
              ),
              ARRAY['preferences', $2],
              $3::jsonb,
              true
            ),
            updated_at = now()
      WHERE legacy_mongo_id = $1`,
    [userId, key, JSON.stringify(value)],
  );
}

async function requireUserId(): Promise<string> {
  const session = await getSession();
  const id = (session as any)?.user?._id ?? (session as any)?.user?.id;
  if (!id) throw new Error('Not authenticated');
  return String(id);
}

/**
 * Revoke every active session for the current user. Bumps a sentinel
 * row in `revoked_tokens` so `verifyJwt` rejects any token issued
 * before this moment. Also clears the local cookie so the calling
 * device immediately drops to /login on next nav.
 */
export async function signOutEverywhere(): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const now = new Date();
  // Mongo user-wide revocation sentinel remains the default; skipped only under pg-only.
  if (shouldWriteMongo()) {
    const { db } = await connectToDatabase();
    await db.collection('revoked_tokens').updateOne(
      { userId, kind: 'user-wide' },
      { $set: { userId, kind: 'user-wide', revokedBefore: now, updatedAt: now } },
      { upsert: true },
    );
  }
  // Dual-write the per-user revocation sentinel into Postgres (best-effort, never fatal).
  if (shouldWritePg()) {
    try {
      await pgRevocationStore.revokeAllForUser(userId, now);
    } catch (pgErr) {
      console.error('[ACCOUNT] Postgres revokeAllForUser failed (non-fatal):', pgErr);
    }
  }
  const cookieStore = await cookies();
  cookieStore.delete('session');
  revalidatePath('/dashboard/settings/security');
  return { ok: true };
}

interface AccountPreferences {
  loginAlerts: boolean;
  twoFactorEnabled: boolean;
}

export async function getAccountPreferences(): Promise<AccountPreferences> {
  const userId = await requireUserId();
  // V-4: prefer Postgres profile.preferences when the read flag opts in.
  if (shouldReadPg()) {
    try {
      const prefs = await pgReadPreferences(userId);
      if (prefs !== undefined) {
        return {
          loginAlerts: (prefs.loginAlerts as boolean | undefined) ?? true,
          twoFactorEnabled: !!prefs.twoFactorEnabled,
        };
      }
      // PG miss (no row): only fall back to Mongo unless reads are pg-only.
      if (authPgRead() === 'pg' && !pgReadAllowsFallback()) {
        return { loginAlerts: true, twoFactorEnabled: false };
      }
    } catch (pgErr) {
      console.error('[ACCOUNT] Postgres getAccountPreferences read failed:', pgErr);
      // pg-only never falls back to Mongo even on error (lockout-safe default).
      if (authPgRead() === 'pg' && !pgReadAllowsFallback()) {
        return { loginAlerts: true, twoFactorEnabled: false };
      }
    }
  }
  const { db } = await connectToDatabase();
  const user = await db
    .collection('users')
    .findOne(
      { _id: new ObjectId(userId) },
      { projection: { 'preferences.loginAlerts': 1, 'preferences.twoFactorEnabled': 1 } },
    );
  return {
    loginAlerts: user?.preferences?.loginAlerts ?? true,
    twoFactorEnabled: !!user?.preferences?.twoFactorEnabled,
  };
}

export async function setLoginAlerts(enabled: boolean): Promise<{ ok: true }> {
  const userId = await requireUserId();
  // V-4: dual-write to Postgres profile.preferences.loginAlerts (best-effort).
  if (shouldWritePg()) {
    try {
      await pgWritePreferenceKey(userId, 'loginAlerts', !!enabled);
    } catch (pgErr) {
      console.error('[ACCOUNT] Postgres setLoginAlerts write failed (non-fatal):', pgErr);
    }
  }
  // Skip the Mongo write only under pg-only.
  if (shouldWriteMongo()) {
    const { db } = await connectToDatabase();
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { 'preferences.loginAlerts': !!enabled, updatedAt: new Date() } },
    );
  }
  revalidatePath('/dashboard/settings/security');
  return { ok: true };
}

type NotificationPrefs = Record<string, boolean>;

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const userId = await requireUserId();
  // V-4: prefer Postgres profile.preferences.notifications when reads opt in.
  if (shouldReadPg()) {
    try {
      const prefs = await pgReadPreferences(userId);
      if (prefs !== undefined) {
        return (prefs.notifications ?? {}) as NotificationPrefs;
      }
      if (authPgRead() === 'pg' && !pgReadAllowsFallback()) return {};
    } catch (pgErr) {
      console.error('[ACCOUNT] Postgres getNotificationPrefs read failed:', pgErr);
      if (authPgRead() === 'pg' && !pgReadAllowsFallback()) return {};
    }
  }
  const { db } = await connectToDatabase();
  const user = await db
    .collection('users')
    .findOne(
      { _id: new ObjectId(userId) },
      { projection: { 'preferences.notifications': 1 } },
    );
  return (user?.preferences?.notifications ?? {}) as NotificationPrefs;
}

export async function setNotificationPrefs(prefs: NotificationPrefs): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const sanitized: NotificationPrefs = {};
  for (const [k, v] of Object.entries(prefs)) {
    if (typeof k === 'string' && k.length <= 80) sanitized[k] = !!v;
  }
  // V-4: dual-write the whole notifications object to Postgres (best-effort).
  if (shouldWritePg()) {
    try {
      await pgWritePreferenceKey(userId, 'notifications', sanitized);
    } catch (pgErr) {
      console.error('[ACCOUNT] Postgres setNotificationPrefs write failed (non-fatal):', pgErr);
    }
  }
  if (shouldWriteMongo()) {
    const { db } = await connectToDatabase();
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { 'preferences.notifications': sanitized, updatedAt: new Date() } },
    );
  }
  revalidatePath('/dashboard/settings/notifications');
  return { ok: true };
}

interface AppearancePrefs {
  theme: 'system' | 'light' | 'dark';
  density: 'comfortable' | 'compact';
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
}

const APPEARANCE_DEFAULTS: AppearancePrefs = {
  theme: 'system',
  density: 'comfortable',
  sidebarCollapsed: false,
  reducedMotion: false,
};

export async function getAppearancePrefs(): Promise<AppearancePrefs> {
  const userId = await requireUserId();
  // V-4: prefer Postgres profile.preferences.appearance when reads opt in.
  if (shouldReadPg()) {
    try {
      const prefs = await pgReadPreferences(userId);
      if (prefs !== undefined) {
        return {
          ...APPEARANCE_DEFAULTS,
          ...((prefs.appearance ?? {}) as Partial<AppearancePrefs>),
        };
      }
      if (authPgRead() === 'pg' && !pgReadAllowsFallback()) return { ...APPEARANCE_DEFAULTS };
    } catch (pgErr) {
      console.error('[ACCOUNT] Postgres getAppearancePrefs read failed:', pgErr);
      if (authPgRead() === 'pg' && !pgReadAllowsFallback()) return { ...APPEARANCE_DEFAULTS };
    }
  }
  const { db } = await connectToDatabase();
  const user = await db
    .collection('users')
    .findOne(
      { _id: new ObjectId(userId) },
      { projection: { 'preferences.appearance': 1 } },
    );
  return { ...APPEARANCE_DEFAULTS, ...(user?.preferences?.appearance ?? {}) };
}

export async function setAppearancePrefs(input: Partial<AppearancePrefs>): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const next: AppearancePrefs = { ...APPEARANCE_DEFAULTS, ...input };
  // sanitize enums
  if (!['system', 'light', 'dark'].includes(next.theme)) next.theme = 'system';
  if (!['comfortable', 'compact'].includes(next.density)) next.density = 'comfortable';
  next.sidebarCollapsed = !!next.sidebarCollapsed;
  next.reducedMotion = !!next.reducedMotion;
  // V-4: dual-write the appearance object to Postgres (best-effort).
  if (shouldWritePg()) {
    try {
      await pgWritePreferenceKey(userId, 'appearance', next);
    } catch (pgErr) {
      console.error('[ACCOUNT] Postgres setAppearancePrefs write failed (non-fatal):', pgErr);
    }
  }
  if (shouldWriteMongo()) {
    const { db } = await connectToDatabase();
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { 'preferences.appearance': next, updatedAt: new Date() } },
    );
  }
  revalidatePath('/dashboard/settings/ui');
  return { ok: true };
}

interface ActiveSession {
  id: string;
  device: string;
  ip?: string;
  location?: string;
  current: boolean;
  lastSeenAt: string;
}

/**
 * Active sessions list. The codebase doesn't yet track per-jti
 * sessions in Mongo, so this returns the current device only — built
 * from the cookie that ran this action. As session-tracking lands,
 * extend by reading from a `user_sessions` collection.
 */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  await requireUserId();
  return [
    {
      id: 'current',
      device: 'This browser',
      current: true,
      lastSeenAt: new Date().toISOString(),
    },
  ];
}
