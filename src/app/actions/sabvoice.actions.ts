'use server';

/**
 * SabVoice (Cloud-PBX) server actions.
 *
 * Direct Mongo access is the primary path; the Rust crates (`sabvoice-*`)
 * mirror the same on-disk shapes and are wired in when `USE_RUST_SABVOICE`
 * is enabled. Every doc is scoped to the caller's `userId` (tenant id).
 *
 * Real SIP / Twilio / Plivo integration is intentionally out of scope —
 * provider plumbing is stubbed (`provider: 'mock'`) and the DID-search
 * helper returns synthetic numbers. Replace `provider: 'mock'` with the
 * real provider id and wire upstream API calls when the integration
 * lands.
 */

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

function toObjectIdOrNull(id?: string): ObjectId | null {
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

/* ─── DIDs ──────────────────────────────────────────────────────────── */

interface VoiceDidInput {
  number: string;
  country: string;
  provider: 'twilio' | 'plivo' | 'mock';
  capabilities?: string[];
  status?: 'active' | 'pending' | 'released';
  label?: string;
  providerRef?: string;
  monthlyCost?: number;
  currency?: string;
  routeToIvrId?: string;
  routeToQueueId?: string;
  routeToUserId?: string;
}

export async function listVoiceDids(opts: { q?: string; status?: string } = {}) {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId };
  if (opts.status && opts.status !== 'all') filter.status = opts.status;
  if (opts.q) {
    filter.$or = [
      { number: { $regex: opts.q, $options: 'i' } },
      { label: { $regex: opts.q, $options: 'i' } },
    ];
  }
  const rows = await db
    .collection('sabvoice_dids')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

/**
 * Mock-mode DID search. Returns 10 synthetic available numbers.
 * Replace with real Twilio / Plivo `availablePhoneNumbers.list(...)` call.
 */
export async function searchAvailableDids(params: {
  country: string;
  areaCode?: string;
  contains?: string;
  limit?: number;
}) {
  await tenantId();
  const area = params.areaCode || '415';
  const country = params.country.trim().toLowerCase();
  const limit = Math.min(params.limit ?? 10, 50);
  const prefix =
    country === 'us' || country === 'ca'
      ? `+1${area}`
      : country === 'in'
        ? `+91${area}`
        : country === 'gb'
          ? `+44${area}`
          : `+${area}`;
  const items = Array.from({ length: limit }).map((_, i) => ({
    number: `${prefix}${String(1000 + i).padStart(4, '0')}`,
    country,
    capabilities: ['voice', 'sms'],
    monthlyCost: 1.15,
    currency: 'USD',
    provider: 'mock' as const,
  }));
  return { success: true as const, items };
}

export async function purchaseVoiceDid(input: VoiceDidInput) {
  const userId = await tenantId();
  if (!input.number?.trim()) throw new Error('number is required');
  if (!input.country?.trim()) throw new Error('country is required');
  const { db } = await connectToDatabase();
  const dup = await db
    .collection('sabvoice_dids')
    .findOne({ userId, number: input.number.trim() });
  if (dup) throw new Error('A DID with this number is already provisioned.');
  const now = new Date();
  // TODO: integrate real provisioning API call (twilio/plivo) here when
  // provider plumbing is wired — currently we just record the intent.
  const doc = {
    userId,
    number: input.number.trim(),
    country: input.country.trim().toLowerCase(),
    capabilities: input.capabilities ?? ['voice'],
    status: input.status ?? 'active',
    label: input.label ?? null,
    provider: input.provider,
    providerRef: input.providerRef ?? null,
    monthlyCost: input.monthlyCost ?? 1.15,
    currency: input.currency ?? 'USD',
    routeToIvrId: toObjectIdOrNull(input.routeToIvrId),
    routeToQueueId: toObjectIdOrNull(input.routeToQueueId),
    routeToUserId: toObjectIdOrNull(input.routeToUserId),
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('sabvoice_dids').insertOne(doc);
  revalidatePath('/dashboard/sabvoice/dids');
  return { success: true as const, id: String(result.insertedId) };
}

export async function updateVoiceDid(id: string, patch: Partial<VoiceDidInput>) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.status) set.status = patch.status;
  if (patch.capabilities) set.capabilities = patch.capabilities;
  if (patch.monthlyCost != null) set.monthlyCost = patch.monthlyCost;
  if (patch.currency) set.currency = patch.currency;
  if (patch.routeToIvrId !== undefined)
    set.routeToIvrId = toObjectIdOrNull(patch.routeToIvrId);
  if (patch.routeToQueueId !== undefined)
    set.routeToQueueId = toObjectIdOrNull(patch.routeToQueueId);
  if (patch.routeToUserId !== undefined)
    set.routeToUserId = toObjectIdOrNull(patch.routeToUserId);
  await db.collection('sabvoice_dids').updateOne({ _id, userId }, { $set: set });
  revalidatePath('/dashboard/sabvoice/dids');
  return { success: true as const };
}

export async function releaseVoiceDid(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  // TODO: call provider release API when integration is wired.
  await db
    .collection('sabvoice_dids')
    .updateOne(
      { _id, userId },
      { $set: { status: 'released', updatedAt: new Date() } },
    );
  revalidatePath('/dashboard/sabvoice/dids');
  return { success: true as const };
}

/* ─── IVRs ──────────────────────────────────────────────────────────── */

type VoiceIvrNodeType =
  | 'menu'
  | 'playback'
  | 'forward'
  | 'voicemail'
  | 'hangup'
  | 'conditional';

interface VoiceIvrNode {
  type: VoiceIvrNodeType;
  id?: string;
  prompt?: string;
  key?: string;
  to?: string;
  fileId?: string;
  condition?: string;
  children?: VoiceIvrNode[];
  [k: string]: unknown;
}

interface VoiceIvrInput {
  name: string;
  description?: string;
  status?: 'draft' | 'active' | 'archived';
  rootNode?: VoiceIvrNode;
  greetingFileId?: string;
}

const VALID_NODE_TYPES = new Set<VoiceIvrNodeType>([
  'menu',
  'playback',
  'forward',
  'voicemail',
  'hangup',
  'conditional',
]);

function validateIvrTree(node: unknown): void {
  if (!node || typeof node !== 'object') throw new Error('IVR node must be an object.');
  const n = node as VoiceIvrNode;
  if (!VALID_NODE_TYPES.has(n.type)) {
    throw new Error(`Unknown IVR node type: ${String(n.type)}`);
  }
  if (Array.isArray(n.children)) n.children.forEach(validateIvrTree);
}

export async function listVoiceIvrs(opts: { q?: string; status?: string } = {}) {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId };
  if (opts.status && opts.status !== 'all') filter.status = opts.status;
  if (opts.q) filter.name = { $regex: opts.q, $options: 'i' };
  const rows = await db
    .collection('sabvoice_ivrs')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

export async function getVoiceIvr(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) return { success: false as const, data: null };
  const { db } = await connectToDatabase();
  const row = await db.collection('sabvoice_ivrs').findOne({ _id, userId });
  if (!row) return { success: false as const, data: null };
  return { success: true as const, data: stringifyIds(row as never) };
}

export async function createVoiceIvr(input: VoiceIvrInput) {
  const userId = await tenantId();
  if (!input.name?.trim()) throw new Error('name is required');
  const root: VoiceIvrNode = input.rootNode ?? {
    type: 'menu',
    prompt: 'Press 1 for sales, 2 for support.',
    children: [],
  };
  validateIvrTree(root);
  const { db } = await connectToDatabase();
  const now = new Date();
  const doc = {
    userId,
    name: input.name.trim(),
    description: input.description ?? null,
    status: input.status ?? 'draft',
    rootNode: root,
    greetingFileId: input.greetingFileId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('sabvoice_ivrs').insertOne(doc);
  revalidatePath('/dashboard/sabvoice/ivr');
  return { success: true as const, id: String(result.insertedId) };
}

export async function updateVoiceIvr(id: string, patch: Partial<VoiceIvrInput>) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name) set.name = patch.name.trim();
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.status) set.status = patch.status;
  if (patch.rootNode) {
    validateIvrTree(patch.rootNode);
    set.rootNode = patch.rootNode;
  }
  if (patch.greetingFileId !== undefined) set.greetingFileId = patch.greetingFileId;
  const { db } = await connectToDatabase();
  await db.collection('sabvoice_ivrs').updateOne({ _id, userId }, { $set: set });
  revalidatePath('/dashboard/sabvoice/ivr');
  return { success: true as const };
}

export async function deleteVoiceIvr(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  await db
    .collection('sabvoice_ivrs')
    .updateOne({ _id, userId }, { $set: { status: 'archived', updatedAt: new Date() } });
  revalidatePath('/dashboard/sabvoice/ivr');
  return { success: true as const };
}

/* ─── Queues ────────────────────────────────────────────────────────── */

interface VoiceQueueInput {
  name: string;
  description?: string;
  strategy?: 'round_robin' | 'least_busy' | 'simultaneous';
  agentIds?: string[];
  maxWaitSecs?: number;
  fallback?: string;
  holdMusicFileId?: string;
  status?: 'active' | 'archived';
}

export async function listVoiceQueues(opts: { q?: string; status?: string } = {}) {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId };
  if (opts.status && opts.status !== 'all') filter.status = opts.status;
  if (opts.q) filter.name = { $regex: opts.q, $options: 'i' };
  const rows = await db
    .collection('sabvoice_queues')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

export async function createVoiceQueue(input: VoiceQueueInput) {
  const userId = await tenantId();
  if (!input.name?.trim()) throw new Error('name is required');
  const { db } = await connectToDatabase();
  const now = new Date();
  const doc = {
    userId,
    name: input.name.trim(),
    description: input.description ?? null,
    strategy: input.strategy ?? 'round_robin',
    agentIds: (input.agentIds ?? []).map((s) => toObjectIdOrNull(s)).filter(Boolean) as ObjectId[],
    maxWaitSecs: input.maxWaitSecs ?? 60,
    fallback: input.fallback ?? 'voicemail',
    holdMusicFileId: input.holdMusicFileId ?? null,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('sabvoice_queues').insertOne(doc);
  revalidatePath('/dashboard/sabvoice/queues');
  return { success: true as const, id: String(result.insertedId) };
}

export async function updateVoiceQueue(id: string, patch: Partial<VoiceQueueInput>) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name) set.name = patch.name.trim();
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.strategy) set.strategy = patch.strategy;
  if (patch.agentIds)
    set.agentIds = patch.agentIds.map((s) => toObjectIdOrNull(s)).filter(Boolean);
  if (patch.maxWaitSecs != null) set.maxWaitSecs = patch.maxWaitSecs;
  if (patch.fallback !== undefined) set.fallback = patch.fallback;
  if (patch.holdMusicFileId !== undefined) set.holdMusicFileId = patch.holdMusicFileId;
  if (patch.status) set.status = patch.status;
  const { db } = await connectToDatabase();
  await db.collection('sabvoice_queues').updateOne({ _id, userId }, { $set: set });
  revalidatePath('/dashboard/sabvoice/queues');
  return { success: true as const };
}

export async function deleteVoiceQueue(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  await db
    .collection('sabvoice_queues')
    .updateOne({ _id, userId }, { $set: { status: 'archived', updatedAt: new Date() } });
  revalidatePath('/dashboard/sabvoice/queues');
  return { success: true as const };
}

/* ─── Calls (CDR) ───────────────────────────────────────────────────── */

interface VoiceCallInput {
  fromNumber: string;
  toNumber: string;
  direction: 'inbound' | 'outbound';
  agentId?: string;
  queueId?: string;
  ivrId?: string;
  didId?: string;
  startedAt?: string;
  endedAt?: string;
  durationSecs?: number;
  status: 'completed' | 'missed' | 'abandoned' | 'voicemail' | 'failed';
  recordingFileId?: string;
  provider?: 'twilio' | 'plivo' | 'mock';
  providerCallSid?: string;
  notes?: string;
  tags?: string[];
}

export async function listVoiceCallCdrs(opts: {
  q?: string;
  status?: string;
  direction?: string;
  from?: string;
  to?: string;
} = {}) {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId };
  if (opts.status && opts.status !== 'all') filter.status = opts.status;
  if (opts.direction) filter.direction = opts.direction;
  if (opts.q) {
    filter.$or = [
      { fromNumber: { $regex: opts.q, $options: 'i' } },
      { toNumber: { $regex: opts.q, $options: 'i' } },
      { notes: { $regex: opts.q, $options: 'i' } },
    ];
  }
  const range: Record<string, Date> = {};
  if (opts.from) range.$gte = new Date(opts.from) as never;
  if (opts.to) range.$lte = new Date(opts.to) as never;
  if (Object.keys(range).length) filter.startedAt = range;
  const rows = await db
    .collection('sabvoice_calls')
    .find(filter)
    .sort({ startedAt: -1 })
    .limit(500)
    .toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

export async function createVoiceCallCdr(input: VoiceCallInput) {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const now = new Date();
  const doc = {
    userId,
    fromNumber: input.fromNumber,
    toNumber: input.toNumber,
    direction: input.direction,
    agentId: toObjectIdOrNull(input.agentId),
    queueId: toObjectIdOrNull(input.queueId),
    ivrId: toObjectIdOrNull(input.ivrId),
    didId: toObjectIdOrNull(input.didId),
    startedAt: input.startedAt ? new Date(input.startedAt) : now,
    endedAt: input.endedAt ? new Date(input.endedAt) : null,
    durationSecs: input.durationSecs ?? 0,
    status: input.status,
    recordingFileId: input.recordingFileId ?? null,
    provider: input.provider ?? 'mock',
    providerCallSid: input.providerCallSid ?? null,
    notes: input.notes ?? null,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('sabvoice_calls').insertOne(doc);
  revalidatePath('/dashboard/sabvoice/calls');
  return { success: true as const, id: String(result.insertedId) };
}

export async function deleteVoiceCallCdr(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  await db.collection('sabvoice_calls').deleteOne({ _id, userId });
  revalidatePath('/dashboard/sabvoice/calls');
  return { success: true as const };
}

/* ─── Voicemail ─────────────────────────────────────────────────────── */

interface VoicemailInput {
  callId: string;
  fromNumber: string;
  toNumber?: string;
  audioFileId: string;
  durationSecs?: number;
  transcript?: string;
}

export async function listVoicemails(opts: { q?: string; status?: string } = {}) {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId };
  if (opts.status && opts.status !== 'all') filter.status = opts.status;
  if (opts.q) filter.fromNumber = { $regex: opts.q, $options: 'i' };
  const rows = await db
    .collection('sabvoice_voicemail')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

export async function createVoicemail(input: VoicemailInput) {
  const userId = await tenantId();
  const callId = toObjectIdOrNull(input.callId);
  if (!callId) throw new Error('callId must be a valid ObjectId');
  if (!input.audioFileId) throw new Error('audioFileId is required');
  const { db } = await connectToDatabase();
  const now = new Date();
  const doc = {
    userId,
    callId,
    fromNumber: input.fromNumber,
    toNumber: input.toNumber ?? null,
    audioFileId: input.audioFileId,
    durationSecs: input.durationSecs ?? null,
    transcript: input.transcript ?? null,
    listenedBy: [] as ObjectId[],
    status: 'new',
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection('sabvoice_voicemail').insertOne(doc);
  revalidatePath('/dashboard/sabvoice/voicemail');
  return { success: true as const, id: String(result.insertedId) };
}

export async function markVoicemailListened(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const listener = new ObjectId(userId);
  const { db } = await connectToDatabase();
  await db.collection('sabvoice_voicemail').updateOne(
    { _id, userId },
    {
      $addToSet: { listenedBy: listener },
      $set: { status: 'listened', updatedAt: new Date() },
    },
  );
  revalidatePath('/dashboard/sabvoice/voicemail');
  return { success: true as const };
}

export async function setVoicemailTranscript(id: string, transcript: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  await db
    .collection('sabvoice_voicemail')
    .updateOne({ _id, userId }, { $set: { transcript, updatedAt: new Date() } });
  revalidatePath('/dashboard/sabvoice/voicemail');
  return { success: true as const };
}

export async function deleteVoicemail(id: string) {
  const userId = await tenantId();
  const _id = toObjectIdOrNull(id);
  if (!_id) throw new Error('Invalid id.');
  const { db } = await connectToDatabase();
  await db
    .collection('sabvoice_voicemail')
    .updateOne({ _id, userId }, { $set: { status: 'archived', updatedAt: new Date() } });
  revalidatePath('/dashboard/sabvoice/voicemail');
  return { success: true as const };
}

/* ─── Agent presence ────────────────────────────────────────────────── */

type AgentPresenceStatus = 'available' | 'busy' | 'away' | 'offline';

interface AgentPresenceInput {
  agentUserId: string;
  status: AgentPresenceStatus;
  activeCallId?: string;
  queueIds?: string[];
  displayName?: string;
}

export async function listAgentPresence(opts: { status?: AgentPresenceStatus } = {}) {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId };
  if (opts.status) filter.status = opts.status;
  const rows = await db.collection('sabvoice_agents_presence').find(filter).toArray();
  return { success: true as const, data: rows.map((r) => stringifyIds(r as never)) };
}

export async function upsertAgentPresence(input: AgentPresenceInput) {
  const userId = await tenantId();
  const agentOid = toObjectIdOrNull(input.agentUserId);
  if (!agentOid) throw new Error('agentUserId must be a valid ObjectId.');
  const { db } = await connectToDatabase();
  const set: Record<string, unknown> = {
    status: input.status,
    lastChangeAt: new Date(),
  };
  if (input.activeCallId !== undefined)
    set.activeCallId = toObjectIdOrNull(input.activeCallId);
  if (input.queueIds)
    set.queueIds = input.queueIds.map((s) => toObjectIdOrNull(s)).filter(Boolean);
  if (input.displayName !== undefined) set.displayName = input.displayName;
  await db.collection('sabvoice_agents_presence').updateOne(
    { userId, agentUserId: agentOid },
    {
      $set: set,
      $setOnInsert: { userId, agentUserId: agentOid },
    },
    { upsert: true },
  );
  revalidatePath('/dashboard/sabvoice/agent-dashboard');
  return { success: true as const };
}

/* ─── Aggregate KPIs (live dashboard) ───────────────────────────────── */

export async function getVoiceLiveKpis() {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const [agents, callsToday, queues] = await Promise.all([
    db.collection('sabvoice_agents_presence').find({ userId }).toArray(),
    db
      .collection('sabvoice_calls')
      .countDocuments({
        userId,
        startedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    db.collection('sabvoice_queues').find({ userId, status: 'active' }).toArray(),
  ]);
  const byStatus = (status: string) =>
    agents.filter((a) => a.status === status).length;
  return {
    success: true as const,
    data: {
      agentsAvailable: byStatus('available'),
      agentsBusy: byStatus('busy'),
      agentsAway: byStatus('away'),
      agentsOffline: byStatus('offline'),
      activeQueues: queues.length,
      callsToday,
      activeCalls: agents.filter((a) => a.activeCallId).length,
    },
  };
}
