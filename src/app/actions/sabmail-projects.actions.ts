'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ObjectId, type Db, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { invalidateProjectsCache } from '@/lib/server-cache';
import { SABMAIL_PROJECT_COOKIE } from '@/lib/sabmail/workspace';
import {
  SABMAIL_COLLECTIONS,
  ensureSabmailIndexes,
  getSabmailCollections,
} from '@/lib/sabmail/db/collections';
import { encryptMailboxCreds, hasMailboxCredsKey } from '@/lib/sabmail/credentials';
import { sabmailEngine } from '@/lib/sabmail/engine-client';
import type { SabmailAccount } from '@/lib/sabmail/types';
import { getErrorMessage } from '@/lib/utils';
import type { Project } from '@/lib/definitions';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail projects + mandatory setup. Mirrors `sabsms-projects.actions.ts`.
 *
 * A SabMail "project" is a `kind:'mail'` row in the shared `projects`
 * collection; its `_id` string is the `workspaceId` every SabMail
 * collection scopes by.
 *
 * Flow enforced by `src/app/sabmail/layout.tsx`:
 *   create → select (sets the `sabmail_project` cookie) → complete setup
 *   (`sabmail.setupComplete = true`) → module unlocks.
 *
 * Setup gate = business profile + at least one connected mailbox.
 * ──────────────────────────────────────────────────────────────────── */

export type SabmailSetupStep = 'profile' | 'connection';
export type SabmailRegion = 'IN' | 'US' | 'OTHER';
export type SabmailIntent = 'personal' | 'team' | 'platform';

export interface SabmailProjectRow {
  id: string;
  name: string;
  setupComplete: boolean;
  intent: SabmailIntent | null;
}

export interface SabmailSetupState {
  projectId: string;
  name: string;
  intent: SabmailIntent | null;
  region: SabmailRegion | null;
  businessName: string | null;
  businessProfile: { website?: string; industry?: string; useCase?: string } | null;
  steps: { profile: boolean; connection: boolean };
  accountCount: number;
  complete: boolean;
}

/** Safe (no-secret) projection of a connected mailbox. */
export interface SabmailAccountRow {
  id: string;
  provider: SabmailAccount['provider'];
  email: string;
  displayName: string | null;
  status: SabmailAccount['status'];
  lastError: string | null;
  lastSyncedAt: string | null;
  imapHost: string | null;
}

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };

/* ── internal: load + authorize a mail project ───────────────────────── */

async function requireMailProject(
  projectId: string,
): Promise<
  | { ok: true; db: Db; userId: ObjectId; project: WithId<Project> }
  | { ok: false; error: string }
> {
  const session = await getSession();
  const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!rawId || !ObjectId.isValid(String(rawId))) {
    return { ok: false, error: 'Not authenticated.' };
  }
  if (!projectId || !ObjectId.isValid(projectId)) {
    return { ok: false, error: 'Invalid project id.' };
  }
  const userId = new ObjectId(String(rawId));
  const { db } = await connectToDatabase();
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    kind: 'mail',
    $or: [{ userId }, { 'agents.userId': userId }],
  });
  if (!project) {
    return { ok: false, error: 'Project not found or you do not have access.' };
  }
  return { ok: true, db, userId, project: project as WithId<Project> };
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabmailProjects(): Promise<SabmailProjectRow[]> {
  try {
    const session = await getSession();
    const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!rawId || !ObjectId.isValid(String(rawId))) return [];
    const userId = new ObjectId(String(rawId));

    const { db } = await connectToDatabase();
    const docs = await db
      .collection('projects')
      .find(
        { kind: 'mail', $or: [{ userId }, { 'agents.userId': userId }] },
        { projection: { name: 1, sabmail: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => {
      const doc = d as WithId<Project>;
      return {
        id: String(doc._id),
        name: doc.name,
        setupComplete: !!doc.sabmail?.setupComplete,
        intent: (doc.sabmail?.intent as SabmailIntent | undefined) ?? null,
      };
    });
  } catch (err) {
    console.error('[sabmail] listSabmailProjects failed:', err);
    return [];
  }
}

/* ── create ───────────────────────────────────────────────────────────── */

export async function createSabmailProject(input: {
  name: string;
}): Promise<Ok<{ projectId: string; name: string }> | Err> {
  try {
    const name = input.name?.trim();
    if (!name) return { success: false, error: 'Project name is required.' };
    if (name.length > 120) {
      return { success: false, error: 'Project name is too long (max 120 chars).' };
    }

    const session = await getSession();
    const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!rawId || !ObjectId.isValid(String(rawId))) {
      return { success: false, error: 'Not authenticated.' };
    }
    const userId = new ObjectId(String(rawId));
    const { db } = await connectToDatabase();

    const existing = await db
      .collection('projects')
      .findOne({ userId, name, kind: 'mail' }, { projection: { _id: 1 } });
    if (existing) {
      return { success: false, error: 'You already have a SabMail project with that name.' };
    }

    const now = new Date();
    const ins = await db.collection('projects').insertOne({
      userId,
      name,
      accessToken: '',
      phoneNumbers: [],
      // Discriminator so other modules' pickers skip this workspace and the
      // SabMail picker shows it.
      kind: 'mail',
      sabmail: { setupComplete: false, setupSteps: {} },
      createdAt: now,
    } as never);

    invalidateProjectsCache(String(userId));
    revalidatePath('/sabmail/projects');
    return { success: true, projectId: ins.insertedId.toString(), name };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/* ── select / clear (cookie is the server-side source of truth) ───────── */

export async function setActiveSabmailProject(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireMailProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const cookieStore = await cookies();
  cookieStore.set(SABMAIL_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return { success: true };
}

export async function clearActiveSabmailProject(): Promise<{ success: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(SABMAIL_PROJECT_COOKIE);
  return { success: true };
}

/* ── setup state ──────────────────────────────────────────────────────── */

export async function getSabmailSetupState(
  projectId: string,
): Promise<SabmailSetupState | null> {
  const auth = await requireMailProject(projectId);
  if (!auth.ok) return null;
  const { db, project } = auth;
  const sabmail = project.sabmail ?? {};
  const workspaceId = String(project._id);

  const accountCount = await db
    .collection(SABMAIL_COLLECTIONS.accounts)
    .countDocuments({ workspaceId });

  const steps = {
    profile: !!sabmail.setupSteps?.profile,
    connection: !!sabmail.setupSteps?.connection || accountCount > 0,
  };

  return {
    projectId: workspaceId,
    name: project.name,
    intent: (sabmail.intent as SabmailIntent | undefined) ?? null,
    region: (sabmail.region as SabmailRegion | undefined) ?? null,
    businessName: sabmail.businessName ?? null,
    businessProfile: sabmail.businessProfile ?? null,
    steps,
    accountCount,
    complete: !!sabmail.setupComplete,
  };
}

/* ── step writers ─────────────────────────────────────────────────────── */

export async function saveSabmailProfileStep(
  projectId: string,
  input: {
    businessName: string;
    intent: SabmailIntent;
    region: SabmailRegion;
    businessProfile?: { website?: string; industry?: string; useCase?: string };
  },
): Promise<{ success: true } | Err> {
  const auth = await requireMailProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  const businessName = input.businessName?.trim();
  if (!businessName) return { success: false, error: 'Display / business name is required.' };
  if (!['personal', 'team', 'platform'].includes(input.intent)) {
    return { success: false, error: 'Pick how you will use SabMail.' };
  }
  if (!['IN', 'US', 'OTHER'].includes(input.region)) {
    return { success: false, error: 'Pick a region.' };
  }

  await auth.db.collection('projects').updateOne(
    { _id: auth.project._id },
    {
      $set: {
        'sabmail.businessName': businessName,
        'sabmail.intent': input.intent,
        'sabmail.region': input.region,
        'sabmail.businessProfile': {
          website: input.businessProfile?.website?.trim() || undefined,
          industry: input.businessProfile?.industry?.trim() || undefined,
          useCase: input.businessProfile?.useCase?.trim() || undefined,
        },
        'sabmail.setupSteps.profile': true,
      },
    },
  );
  return { success: true };
}

/* ── accounts ─────────────────────────────────────────────────────────── */

function toAccountRow(doc: WithId<SabmailAccount>): SabmailAccountRow {
  return {
    id: String(doc._id),
    provider: doc.provider,
    email: doc.email,
    displayName: doc.displayName ?? null,
    status: doc.status,
    lastError: doc.lastError ?? null,
    lastSyncedAt: doc.lastSyncedAt ? new Date(doc.lastSyncedAt).toISOString() : null,
    imapHost: doc.imap?.host ?? null,
  };
}

export async function listSabmailAccounts(): Promise<SabmailAccountRow[]> {
  try {
    const session = await getSession();
    const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!rawId) return [];
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get(SABMAIL_PROJECT_COOKIE)?.value;
    if (!workspaceId || !ObjectId.isValid(workspaceId)) return [];
    // Authorize the workspace before reading its accounts.
    const auth = await requireMailProject(workspaceId);
    if (!auth.ok) return [];

    const { cols } = await getSabmailCollections();
    const docs = await cols.accounts
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return docs.map((d) => toAccountRow(d as WithId<SabmailAccount>));
  } catch (err) {
    console.error('[sabmail] listSabmailAccounts failed:', err);
    return [];
  }
}

interface ImapSmtpConnectInput {
  email: string;
  displayName?: string;
  imap: { host: string; port: number; secure: boolean; user: string; pass: string };
  smtp?: { host: string; port: number; secure: boolean; user: string; pass: string };
}

/** Live-verify IMAP credentials with imapflow. Throws a friendly message on failure. */
async function verifyImap(imap: ImapSmtpConnectInput['imap']): Promise<void> {
  const mod = (await import('imapflow')) as unknown as {
    ImapFlow: new (opts: unknown) => unknown;
  };
  const client = new mod.ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: { user: imap.user, pass: imap.pass },
    logger: false,
    // Fail fast rather than hang the action.
    socketTimeout: 15_000,
  }) as { connect: () => Promise<void>; logout: () => Promise<void>; close: () => void };
  try {
    await client.connect();
  } finally {
    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/** Live-verify SMTP credentials with nodemailer. Throws a friendly message on failure. */
async function verifySmtp(smtp: NonNullable<ImapSmtpConnectInput['smtp']>): Promise<void> {
  const mod = (await import('nodemailer')) as unknown as {
    default?: { createTransport: (opts: unknown) => { verify: () => Promise<unknown> } };
    createTransport?: (opts: unknown) => { verify: () => Promise<unknown> };
  };
  const nodemailer = mod.default ?? mod;
  const transport = nodemailer.createTransport!({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 15_000,
  });
  await transport.verify();
}

/**
 * Connect a mailbox over IMAP/SMTP: verify the credentials live, encrypt
 * them, and upsert the account (idempotent per workspace+email). This is the
 * Phase-0 connection path that satisfies the setup gate; Gmail/Outlook OAuth
 * land in Phase 1.
 */
export async function connectSabmailImapAccount(
  projectId: string,
  input: ImapSmtpConnectInput,
): Promise<Ok<{ accountId: string }> | Err> {
  const auth = await requireMailProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };

  if (!hasMailboxCredsKey()) {
    return {
      success: false,
      error: 'Mailbox encryption key not configured. Set SABMAIL_CREDS_KEY (64 hex chars).',
    };
  }

  const email = input.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Enter a valid email address.' };
  }
  if (!input.imap?.host || !input.imap?.user || !input.imap?.pass) {
    return { success: false, error: 'IMAP host, username and password are required.' };
  }

  const workspaceId = String(auth.project._id);

  // Live verification — refuse to store credentials that don't actually work.
  try {
    await verifyImap(input.imap);
  } catch (err) {
    return { success: false, error: `IMAP connection failed: ${getErrorMessage(err)}` };
  }
  if (input.smtp?.host) {
    if (!input.smtp.user || !input.smtp.pass) {
      return { success: false, error: 'SMTP username and password are required when an SMTP host is set.' };
    }
    try {
      await verifySmtp(input.smtp);
    } catch (err) {
      return { success: false, error: `SMTP connection failed: ${getErrorMessage(err)}` };
    }
  }

  const credsBlob: Record<string, unknown> = {
    imapUser: input.imap.user,
    imapPass: input.imap.pass,
  };
  if (input.smtp?.host) {
    credsBlob.smtpUser = input.smtp.user;
    credsBlob.smtpPass = input.smtp.pass;
  }
  const credentialsCipher = encryptMailboxCreds(workspaceId, credsBlob);

  await ensureSabmailIndexes();
  const { cols } = await getSabmailCollections();
  const now = new Date();

  // Only-defined fields in `$set` (avoid storing BSON `undefined`); clear any
  // prior error with `$unset`.
  const set: Record<string, unknown> = {
    provider: 'imap',
    imap: { host: input.imap.host.trim(), port: input.imap.port, secure: input.imap.secure },
    credentialsCipher,
    status: 'active',
    updatedAt: now,
  };
  if (input.displayName?.trim()) set.displayName = input.displayName.trim();
  if (input.smtp?.host) {
    set.smtp = { host: input.smtp.host.trim(), port: input.smtp.port, secure: input.smtp.secure };
  }
  const update = {
    $set: set,
    $setOnInsert: { workspaceId, email, createdAt: now },
    $unset: { lastError: '', lastErrorAt: '' },
  };

  const result = await cols.accounts.updateOne({ workspaceId, email }, update as never, {
    upsert: true,
  });
  let accountId = result.upsertedId ? String(result.upsertedId) : '';
  if (!accountId) {
    const doc = await cols.accounts.findOne({ workspaceId, email }, { projection: { _id: 1 } });
    accountId = doc ? String(doc._id) : '';
  }

  await auth.db
    .collection('projects')
    .updateOne({ _id: auth.project._id }, { $set: { 'sabmail.setupSteps.connection': true } });
  // Best-effort: nudge the (future) sync engine. No-op when disabled.
  if (accountId) void sabmailEngine.requestSync({ workspaceId, accountId });

  revalidatePath('/sabmail/accounts');
  return { success: true, accountId };
}

export async function deleteSabmailAccount(
  accountId: string,
): Promise<{ success: true } | Err> {
  try {
    if (!ObjectId.isValid(accountId)) {
      return { success: false, error: 'Invalid account id.' };
    }
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get(SABMAIL_PROJECT_COOKIE)?.value;
    if (!workspaceId) return { success: false, error: 'No active SabMail project.' };
    const auth = await requireMailProject(workspaceId);
    if (!auth.ok) return { success: false, error: auth.error };

    const { cols } = await getSabmailCollections();
    await cols.accounts.deleteOne({ _id: new ObjectId(accountId), workspaceId });
    revalidatePath('/sabmail/accounts');
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/* ── finish ───────────────────────────────────────────────────────────── */

/**
 * Re-validate prerequisites against ACTUAL stored data (not just UI flags)
 * and flip `setupComplete`. This is the single gate the layout trusts.
 */
export async function completeSabmailSetup(
  projectId: string,
): Promise<{ success: true } | Err> {
  const auth = await requireMailProject(projectId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { db, project } = auth;
  const workspaceId = String(project._id);
  const sabmail = project.sabmail ?? {};

  if (!sabmail.businessName || !sabmail.intent) {
    return { success: false, error: 'Complete the profile step first.' };
  }

  const accountCount = await db
    .collection(SABMAIL_COLLECTIONS.accounts)
    .countDocuments({ workspaceId });
  if (accountCount === 0) {
    return { success: false, error: 'Connect at least one mailbox first.' };
  }

  await db.collection('projects').updateOne(
    { _id: project._id },
    {
      $set: {
        'sabmail.setupComplete': true,
        'sabmail.setupCompletedAt': new Date(),
        'sabmail.setupSteps': { profile: true, connection: true },
      },
    },
  );

  invalidateProjectsCache(String(project.userId));
  revalidatePath('/sabmail');
  return { success: true };
}
