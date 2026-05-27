'use server';

import 'server-only';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

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
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection('revoked_tokens').updateOne(
    { userId, kind: 'user-wide' },
    { $set: { userId, kind: 'user-wide', revokedBefore: now, updatedAt: now } },
    { upsert: true },
  );
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
  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { 'preferences.loginAlerts': !!enabled, updatedAt: new Date() } },
  );
  revalidatePath('/dashboard/settings/security');
  return { ok: true };
}

type NotificationPrefs = Record<string, boolean>;

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const userId = await requireUserId();
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
  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { 'preferences.notifications': sanitized, updatedAt: new Date() } },
  );
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
  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { 'preferences.appearance': next, updatedAt: new Date() } },
  );
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
