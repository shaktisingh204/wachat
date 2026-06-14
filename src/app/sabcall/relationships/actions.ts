'use server';

/**
 * SabCall relationships — "never lose touch" (Superphone-style). Surfaces VIP
 * contacts you haven't reached in a while so they never go cold, and lets you
 * mark a contact touched (or call them) from one place. Project-scoped by the
 * `userId` field (= workspace id), like the rest of SabCall.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabcallWorkspaceId } from '@/lib/sabcall/workspace';
import { getErrorMessage } from '@/lib/utils';

async function ws(): Promise<string> {
  const id = await getSabcallWorkspaceId();
  if (!id) throw new Error('No SabCall project selected.');
  return id;
}

export interface TouchSettings {
  enabled: boolean;
  cadenceDays: number;
  scope: 'vip' | 'all';
}

export interface DueContact {
  _id: string;
  name: string;
  phone: string;
  company?: string;
  lastTouchedAt: string | null;
}

export async function getTouchSettings(): Promise<TouchSettings> {
  const userId = await ws();
  const { db } = await connectToDatabase();
  const doc = await db.collection('sabcall_touch_settings').findOne({ userId });
  return {
    enabled: !!doc?.enabled,
    cadenceDays: Number(doc?.cadenceDays ?? 30),
    scope: (doc?.scope as 'vip' | 'all') ?? 'vip',
  };
}

export async function saveTouchSettings(
  input: TouchSettings,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const userId = await ws();
    const { db } = await connectToDatabase();
    await db.collection('sabcall_touch_settings').updateOne(
      { userId },
      {
        $set: {
          userId,
          enabled: !!input.enabled,
          cadenceDays: Math.max(1, Math.min(Number(input.cadenceDays) || 30, 3650)),
          scope: input.scope === 'all' ? 'all' : 'vip',
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    revalidatePath('/sabcall/relationships');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}

export async function listDueContacts(): Promise<
  { ok: true; contacts: DueContact[] } | { ok: false; error: string }
> {
  try {
    const userId = await ws();
    const settings = await getTouchSettings();
    const { db } = await connectToDatabase();
    const cutoff = new Date(Date.now() - settings.cadenceDays * 24 * 3600 * 1000);
    const filter: Record<string, unknown> = {
      userId,
      status: 'active',
      $or: [
        { lastTouchedAt: { $exists: false } },
        { lastTouchedAt: null },
        { lastTouchedAt: { $lt: cutoff } },
      ],
    };
    if (settings.scope === 'vip') filter.vip = true;
    const rows = await db
      .collection('sabcall_contacts')
      .find(filter)
      .sort({ lastTouchedAt: 1 })
      .limit(200)
      .toArray();
    return {
      ok: true,
      contacts: rows.map((r) => ({
        _id: String(r._id),
        name: String(r.name ?? ''),
        phone: String(r.phone ?? ''),
        company: (r.company as string | undefined) ?? undefined,
        lastTouchedAt: r.lastTouchedAt
          ? new Date(r.lastTouchedAt as string).toISOString()
          : null,
      })),
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function markTouched(
  contactId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const userId = await ws();
    let oid: ObjectId;
    try {
      oid = new ObjectId(contactId);
    } catch {
      return { success: false, error: 'Invalid id.' };
    }
    const { db } = await connectToDatabase();
    await db
      .collection('sabcall_contacts')
      .updateOne({ _id: oid, userId }, { $set: { lastTouchedAt: new Date() } });
    revalidatePath('/sabcall/relationships');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}
