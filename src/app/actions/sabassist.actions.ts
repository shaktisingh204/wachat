'use server';

/**
 * SabAssist remote-screen-share server actions.
 *
 * Direct Mongo access is the primary path; the Rust crates (`sabassist-*`)
 * mirror the same on-disk shapes and will be wired in when
 * `USE_RUST_SABASSIST` is enabled. Every doc is scoped to the caller's
 * `userId` (tenant id) via {@link getSession}, except for
 * {@link redeemSabassistAccessToken} which is intentionally public so the
 * customer browser can redeem a share link without a SabNode account.
 *
 * Real WebRTC plumbing is out of scope — see `@/lib/sabassist/transport.ts`
 * for the `IAssistTransport` contract and the in-browser `MockTransport`.
 */

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

/* ─── Shared helpers ────────────────────────────────────────────────── */

async function tenantId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?._id) {
    throw new Error('Not authenticated.');
  }
  return String(session.user._id);
}

function toObjectIdOrNull(id?: string | null): ObjectId | null {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function stringifyIds<T extends { _id: ObjectId | string }>(doc: T): T & { _id: string } {
  return { ...doc, _id: String(doc._id) } as T & { _id: string };
}

function generateToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function generatePin(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

/* ─── Sessions ──────────────────────────────────────────────────────── */

export type SabassistSessionStatus = 'scheduled' | 'active' | 'ended';
export type SabassistSessionMode = 'attended' | 'unattended';

interface SabassistSessionInput {
  customerName?: string;
  customerEmail?: string;
  callId?: string;
  mode: SabassistSessionMode;
  deviceId?: string;
  notes?: string;
}

export async function listSabassistSessions(
  opts: { q?: string; status?: SabassistSessionStatus | 'all'; mode?: SabassistSessionMode } = {},
) {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId };
  if (opts.status && opts.status !== 'all') filter.status = opts.status;
  if (opts.mode) filter.mode = opts.mode;
  if (opts.q) {
    filter.$or = [
      { customerName: { $regex: opts.q, $options: 'i' } },
      { customerEmail: { $regex: opts.q, $options: 'i' } },
      { notes: { $regex: opts.q, $options: 'i' } },
    ];
  }
  const rows = await db
    .collection('sabassist_sessions')
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

export async function getSabassistSession(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  const row = await db.collection('sabassist_sessions').findOne({ _id, userId });
  if (!row) return { success: false as const, error: 'not_found' };
  return { success: true as const, data: stringifyIds(row as never) };
}

export async function createSabassistSession(input: SabassistSessionInput) {
  const userId = await tenantId();
  if (input.mode !== 'attended' && input.mode !== 'unattended') {
    throw new Error('mode must be attended or unattended');
  }
  const { db } = await connectToDatabase();
  const now = new Date();
  const doc = {
    userId,
    technicianUserId: userId,
    customerName: input.customerName ?? null,
    customerEmail: input.customerEmail ?? null,
    callId: toObjectIdOrNull(input.callId),
    mode: input.mode,
    status: 'scheduled' as SabassistSessionStatus,
    deviceId: toObjectIdOrNull(input.deviceId),
    notes: input.notes ?? null,
    startedAt: null as Date | null,
    endedAt: null as Date | null,
    durationSecs: null as number | null,
    recordingFileId: null as string | null,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('sabassist_sessions').insertOne(doc);
  revalidatePath('/dashboard/sabvoice/assist');
  return { success: true as const, id: String(result.insertedId) };
}

/**
 * Flips a session to `active` and stamps `startedAt`. Idempotent — calling
 * twice is a no-op rather than an error so the technician console can
 * safely retry on flaky networks.
 */
export async function startSabassistSession(args: { sessionId: string }) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(args.sessionId);
  if (!_id) throw new Error('Invalid sessionId.');
  const { db } = await connectToDatabase();
  const now = new Date();
  const r = await db.collection('sabassist_sessions').findOneAndUpdate(
    { _id, userId, status: { $in: ['scheduled', 'active'] } },
    { $set: { status: 'active', startedAt: now, updatedAt: now } },
    { returnDocument: 'after' },
  );
  if (!r) throw new Error('Session not found or already ended.');
  // logSabassistAction is internal; call it server-side so the audit
  // trail always reflects start/stop transitions.
  await db.collection('sabassist_actions_log').insertOne({
    userId,
    sessionId: _id,
    ts: now,
    actorUserId: userId,
    action: 'connect',
    payloadJson: { via: 'startSabassistSession' },
  });
  revalidatePath(`/dashboard/sabvoice/assist/${args.sessionId}`);
  return { success: true as const };
}

export async function endSabassistSession(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid sessionId.');
  const { db } = await connectToDatabase();
  const now = new Date();
  const before = await db
    .collection('sabassist_sessions')
    .findOne({ _id, userId });
  if (!before) throw new Error('Session not found.');
  let durationSecs: number | null = null;
  if (before.startedAt instanceof Date) {
    durationSecs = Math.max(
      0,
      Math.round((now.getTime() - before.startedAt.getTime()) / 1000),
    );
  }
  await db.collection('sabassist_sessions').updateOne(
    { _id, userId },
    {
      $set: {
        status: 'ended' as SabassistSessionStatus,
        endedAt: now,
        durationSecs,
        updatedAt: now,
      },
    },
  );
  await db.collection('sabassist_actions_log').insertOne({
    userId,
    sessionId: _id,
    ts: now,
    actorUserId: userId,
    action: 'disconnect',
    payloadJson: { via: 'endSabassistSession', durationSecs },
  });
  revalidatePath('/dashboard/sabvoice/assist');
  revalidatePath(`/dashboard/sabvoice/assist/${id}`);
  return { success: true as const };
}

export async function updateSabassistSession(
  id: string,
  patch: Partial<{
    status: SabassistSessionStatus;
    recordingFileId: string;
    notes: string;
    customerName: string;
    customerEmail: string;
  }>,
) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid sessionId.');
  const { db } = await connectToDatabase();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.status) set.status = patch.status;
  if (patch.recordingFileId !== undefined) set.recordingFileId = patch.recordingFileId;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.customerName !== undefined) set.customerName = patch.customerName;
  if (patch.customerEmail !== undefined) set.customerEmail = patch.customerEmail;
  await db.collection('sabassist_sessions').updateOne({ _id, userId }, { $set: set });
  revalidatePath(`/dashboard/sabvoice/assist/${id}`);
  return { success: true as const };
}

export async function deleteSabassistSession(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid sessionId.');
  const { db } = await connectToDatabase();
  await db.collection('sabassist_sessions').deleteOne({ _id, userId });
  revalidatePath('/dashboard/sabvoice/assist');
  return { success: true as const };
}

/* ─── Access tokens ─────────────────────────────────────────────────── */

interface IssueAccessTokenInput {
  sessionId: string;
  /** TTL in seconds. Clamped to [30, 86_400]. Default 900. */
  ttlSecs?: number;
  /** Attended mode — generate a 6-digit PIN the customer must enter. */
  requirePin?: boolean;
  /** Unattended mode — bind the token to a specific device fingerprint. */
  deviceFingerprint?: string;
}

export async function issueSabassistAccessToken(args: IssueAccessTokenInput) {
  const userId = await tenantId();
  const _sessionId = toObjectIdOrNull(args.sessionId);
  if (!_sessionId) throw new Error('Invalid sessionId.');
  const { db } = await connectToDatabase();
  const owned = await db
    .collection('sabassist_sessions')
    .findOne({ _id: _sessionId, userId });
  if (!owned) throw new Error('Session not found.');

  const ttl = Math.min(Math.max(args.ttlSecs ?? 900, 30), 86_400);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 1000);
  const token = generateToken();
  const oneTimePin = args.requirePin ? generatePin() : null;

  const result = await db.collection('sabassist_access_tokens').insertOne({
    userId,
    sessionId: _sessionId,
    token,
    expiresAt,
    used: false,
    usedAt: null,
    oneTimePin,
    deviceFingerprint: args.deviceFingerprint ?? null,
    createdAt: now,
  });

  return {
    success: true as const,
    id: String(result.insertedId),
    token,
    sessionId: args.sessionId,
    expiresAt: expiresAt.toISOString(),
    oneTimePin: oneTimePin ?? undefined,
  };
}

export async function listSabassistAccessTokens(sessionId: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(sessionId);
  if (!_id) throw new Error('Invalid sessionId.');
  const { db } = await connectToDatabase();
  const rows = await db
    .collection('sabassist_access_tokens')
    .find({ userId, sessionId: _id })
    .sort({ createdAt: -1 })
    .toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

export async function revokeSabassistAccessToken(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid token id.');
  const { db } = await connectToDatabase();
  await db.collection('sabassist_access_tokens').updateOne(
    { _id, userId },
    { $set: { used: true, usedAt: new Date() } },
  );
  return { success: true as const };
}

/**
 * **PUBLIC.** Called from the customer-facing `/assist/[token]` page —
 * intentionally does not require {@link getSession}. The customer browser
 * provides the token (URL) + PIN (form input) and we validate against the
 * Mongo document.
 */
export async function redeemSabassistAccessToken(args: {
  token: string;
  pin?: string;
  deviceFingerprint?: string;
}) {
  if (!args.token?.trim()) {
    return { success: false as const, error: 'token_required' };
  }
  const { db } = await connectToDatabase();
  const row = await db
    .collection('sabassist_access_tokens')
    .findOne({ token: args.token });
  if (!row) return { success: false as const, error: 'not_found' };
  if (row.used) return { success: false as const, error: 'already_used' };
  if (!(row.expiresAt instanceof Date) || row.expiresAt.getTime() < Date.now()) {
    return { success: false as const, error: 'expired' };
  }
  if (row.oneTimePin && row.oneTimePin !== (args.pin ?? '')) {
    return { success: false as const, error: 'invalid_pin' };
  }
  if (
    row.deviceFingerprint &&
    row.deviceFingerprint !== (args.deviceFingerprint ?? '')
  ) {
    return { success: false as const, error: 'device_mismatch' };
  }
  const now = new Date();
  const flipped = await db.collection('sabassist_access_tokens').updateOne(
    { _id: row._id, used: false },
    { $set: { used: true, usedAt: now } },
  );
  if (flipped.matchedCount === 0) {
    return { success: false as const, error: 'already_used' };
  }
  const session = await db
    .collection('sabassist_sessions')
    .findOne({ _id: row.sessionId });
  if (!session) return { success: false as const, error: 'session_not_found' };
  // Log the customer-side connect; actorUserId = session.userId because
  // anonymous customers don't have a SabNode id.
  await db.collection('sabassist_actions_log').insertOne({
    userId: String(session.userId),
    sessionId: row.sessionId,
    ts: now,
    actorUserId: session.userId,
    action: 'connect',
    payloadJson: { via: 'redeem', source: 'customer_browser' },
  });
  return {
    success: true as const,
    sessionId: String(row.sessionId),
    mode: session.mode as SabassistSessionMode,
    userId: String(session.userId),
  };
}

/* ─── Action log ────────────────────────────────────────────────────── */

const VALID_ACTIONS = [
  'connect',
  'disconnect',
  'elevate',
  'file_transfer',
  'annotation',
  'reboot_request',
] as const;
export type SabassistActionKind = (typeof VALID_ACTIONS)[number];

export async function logSabassistAction(args: {
  sessionId: string;
  action: SabassistActionKind;
  payloadJson?: unknown;
  /** Optional override; default is the calling tenant. */
  actorUserId?: string;
}) {
  const userId = await tenantId();
  if (!VALID_ACTIONS.includes(args.action)) {
    throw new Error(`action must be one of ${VALID_ACTIONS.join(', ')}`);
  }
  const _sessionId = toObjectIdOrNull(args.sessionId);
  if (!_sessionId) throw new Error('Invalid sessionId.');
  const { db } = await connectToDatabase();
  const result = await db.collection('sabassist_actions_log').insertOne({
    userId,
    sessionId: _sessionId,
    ts: new Date(),
    actorUserId: args.actorUserId ?? userId,
    action: args.action,
    payloadJson: args.payloadJson ?? null,
  });
  return { success: true as const, id: String(result.insertedId) };
}

export async function listSabassistActions(sessionId: string, limit = 500) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(sessionId);
  if (!_id) throw new Error('Invalid sessionId.');
  const { db } = await connectToDatabase();
  const rows = await db
    .collection('sabassist_actions_log')
    .find({ userId, sessionId: _id })
    .sort({ ts: -1 })
    .limit(Math.min(limit, 2000))
    .toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

/* ─── Devices ───────────────────────────────────────────────────────── */

interface RegisterDeviceInput {
  label: string;
  deviceFingerprint: string;
  agentVersion?: string;
  osInfoJson?: unknown;
  ownerUserId?: string;
}

export async function listSabassistDevices(opts: { q?: string; online?: boolean } = {}) {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId };
  if (opts.online != null) filter.online = opts.online;
  if (opts.q) {
    filter.$or = [
      { label: { $regex: opts.q, $options: 'i' } },
      { deviceFingerprint: { $regex: opts.q, $options: 'i' } },
      { agentVersion: { $regex: opts.q, $options: 'i' } },
    ];
  }
  const rows = await db
    .collection('sabassist_devices')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

export async function registerSabassistDevice(input: RegisterDeviceInput) {
  const userId = await tenantId();
  if (!input.label?.trim()) throw new Error('label is required');
  if (!input.deviceFingerprint?.trim())
    throw new Error('deviceFingerprint is required');
  const { db } = await connectToDatabase();
  const now = new Date();
  const result = await db.collection('sabassist_devices').insertOne({
    userId,
    label: input.label.trim(),
    ownerUserId: input.ownerUserId ?? userId,
    deviceFingerprint: input.deviceFingerprint,
    lastSeenAt: null,
    online: false,
    agentVersion: input.agentVersion ?? null,
    osInfoJson: input.osInfoJson ?? null,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath('/dashboard/sabvoice/assist/devices');
  return { success: true as const, id: String(result.insertedId) };
}

export async function updateSabassistDevice(
  id: string,
  patch: Partial<{
    label: string;
    agentVersion: string;
    online: boolean;
    lastSeenAt: string;
  }>,
) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid device id.');
  const { db } = await connectToDatabase();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.agentVersion !== undefined) set.agentVersion = patch.agentVersion;
  if (patch.online !== undefined) set.online = patch.online;
  if (patch.lastSeenAt !== undefined) set.lastSeenAt = new Date(patch.lastSeenAt);
  await db.collection('sabassist_devices').updateOne({ _id, userId }, { $set: set });
  revalidatePath('/dashboard/sabvoice/assist/devices');
  return { success: true as const };
}

export async function deleteSabassistDevice(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid device id.');
  const { db } = await connectToDatabase();
  await db.collection('sabassist_devices').deleteOne({ _id, userId });
  revalidatePath('/dashboard/sabvoice/assist/devices');
  return { success: true as const };
}
