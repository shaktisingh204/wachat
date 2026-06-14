'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getSabsignWorkspaceId } from '@/lib/sabsign/workspace';
import { newWebhookSecret, WEBHOOK_EVENTS } from '@/lib/sabsign/webhooks';

/* SabSign webhook subscription management (per workspace). */

async function requireWorkspace(): Promise<string> {
  const session = await getSession();
  if (!session?.user?._id) throw new Error('Unauthorized');
  const ws = await getSabsignWorkspaceId();
  if (!ws) throw new Error('Select a SabSign project first.');
  return ws;
}

export interface WebhookRow {
  id: string;
  url: string;
  events: string[] | 'all';
  active: boolean;
  secretPreview: string;
  createdAt?: string;
}

export async function listWebhooks(): Promise<WebhookRow[]> {
  const ws = await requireWorkspace();
  const { db } = await connectToDatabase();
  const docs = await db
    .collection('esign_webhooks')
    .find({ workspaceId: ws })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    url: d.url,
    events: d.events,
    active: d.active !== false,
    secretPreview: typeof d.secret === 'string' ? `${d.secret.slice(0, 12)}…` : '',
    createdAt: (d.createdAt as Date | undefined)?.toISOString?.(),
  }));
}

export async function createWebhook(input: {
  url: string;
  events?: string[];
}): Promise<{ id: string; secret: string } | { error: string }> {
  const ws = await requireWorkspace();
  const url = input.url?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return { error: 'A valid http(s) URL is required.' };
  }
  const filtered = (input.events ?? []).filter((e) =>
    (WEBHOOK_EVENTS as string[]).includes(e),
  );
  const events: string[] | 'all' = filtered.length ? filtered : 'all';
  const secret = newWebhookSecret();
  const { db } = await connectToDatabase();
  const res = await db.collection('esign_webhooks').insertOne({
    workspaceId: ws,
    url,
    events,
    secret,
    active: true,
    createdAt: new Date(),
  } as never);
  revalidatePath('/sabsign/api');
  return { id: res.insertedId.toString(), secret };
}

export async function setWebhookActive(id: string, active: boolean): Promise<{ ok: true }> {
  const ws = await requireWorkspace();
  if (!ObjectId.isValid(id)) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  await db
    .collection('esign_webhooks')
    .updateOne({ _id: new ObjectId(id), workspaceId: ws }, { $set: { active } });
  revalidatePath('/sabsign/api');
  return { ok: true };
}

export async function deleteWebhook(id: string): Promise<{ ok: true }> {
  const ws = await requireWorkspace();
  if (!ObjectId.isValid(id)) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  await db.collection('esign_webhooks').deleteOne({ _id: new ObjectId(id), workspaceId: ws });
  revalidatePath('/sabsign/api');
  return { ok: true };
}
