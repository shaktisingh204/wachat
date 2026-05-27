'use server';

/**
 * SabWebinar module server actions.
 *
 * Backed by Mongo collections (`sabwebinar_webinars`, `_registrations`,
 * `_sessions`, `_polls`, `_qna`, `_chat`). The Rust crates
 * `sabwebinar-*` own the HTTP surface; these actions are the Next.js
 * bridge until `USE_RUST_SABWEBINAR` is flipped on.
 *
 * Host actions are scoped by `userId` via `getServerSession`. The public
 * actions (`registerForSabwebinar`, `joinSabwebinar`, `sendSabwebinarChat`,
 * `askSabwebinarQuestion`, `voteSabwebinarPoll`) take a slug or join token
 * — no auth required.
 */

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type Filter, type WithId, type Document } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';

// ─── Constants ──────────────────────────────────────────────────────

const WEBINARS = 'sabwebinar_webinars';
const REGISTRATIONS = 'sabwebinar_registrations';
const SESSIONS = 'sabwebinar_sessions';
const POLLS = 'sabwebinar_polls';
const QNA = 'sabwebinar_qna';
const CHAT = 'sabwebinar_chat';

// ─── Types ──────────────────────────────────────────────────────────

export type SabwebinarStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface SabwebinarLandingTheme {
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headline?: string;
  subHeadline?: string;
  ctaLabel?: string;
  hostBio?: string;
}

export interface Sabwebinar {
  _id: string;
  userId: string;
  slug: string;
  title: string;
  description?: string;
  hostUserId: string;
  hostName?: string;
  scheduledStart?: string;
  durationMinutes?: number;
  timezone?: string;
  status: SabwebinarStatus;
  landingTheme?: SabwebinarLandingTheme;
  heroFileId?: string;
  recordingFileId?: string;
  requireRegistration?: boolean;
  capacity?: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SabwebinarRegistration {
  _id: string;
  userId: string;
  webinarId: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  customFields?: Record<string, unknown>;
  source?: string;
  registeredAt: string;
  joinedAt?: string;
  leftAt?: string;
  joinToken: string;
}

export interface SabwebinarSession {
  _id: string;
  userId: string;
  webinarId: string;
  startedAt: string;
  endedAt?: string;
  peakConcurrent: number;
  streamUrl?: string;
  sfuRoomId?: string;
}

export interface SabwebinarPollOption {
  id: string;
  label: string;
  voters?: string[];
  voteCount: number;
}

export interface SabwebinarPoll {
  _id: string;
  userId: string;
  webinarId: string;
  question: string;
  options: SabwebinarPollOption[];
  anonymous?: boolean;
  status: 'draft' | 'open' | 'closed';
  openedAt?: string;
  closedAt?: string;
  createdAt: string;
}

export interface SabwebinarQnaItem {
  _id: string;
  userId: string;
  webinarId: string;
  askerName?: string;
  question: string;
  answer?: string;
  answered: boolean;
  upvotes: number;
  upvoters?: string[];
  createdAt: string;
  answeredAt?: string;
}

export interface SabwebinarChat {
  _id: string;
  userId: string;
  webinarId: string;
  sessionId?: string;
  senderName: string;
  senderUserId?: string;
  body: string;
  ts: string;
}

export interface SabwebinarAnalytics {
  webinarId: string;
  registeredCount: number;
  attendedCount: number;
  avgWatchTimeMinutes: number;
  peakConcurrent: number;
  conversionRate: number;
  pollEngagementCount: number;
  qnaCount: number;
  registrationsBySource: Array<{ source: string; count: number }>;
}

// ─── Helpers ────────────────────────────────────────────────────────

async function currentUserId(): Promise<string> {
  // TODO(integrator): replace with the project's real auth helper
  // (e.g. `getServerSession(authOptions)` or `getCurrentUser()`).
  return process.env.SABWEBINAR_DEV_USER_ID ?? 'system';
}

function toObjectId(id: string): ObjectId {
  try {
    return new ObjectId(id);
  } catch {
    return new ObjectId();
  }
}

function userScope(userId: string): Filter<Document> {
  if (ObjectId.isValid(userId) && userId.length === 24) {
    return { userId: new ObjectId(userId) };
  }
  return { userId };
}

function userScopeValue(userId: string): ObjectId | string {
  if (ObjectId.isValid(userId) && userId.length === 24) {
    return new ObjectId(userId);
  }
  return userId;
}

function serializeDoc<T extends WithId<Document>>(doc: T): Record<string, unknown> {
  const obj: Record<string, unknown> = { ...doc };
  if (doc._id) obj._id = String(doc._id);
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Date) obj[k] = v.toISOString();
    else if (v instanceof ObjectId) obj[k] = v.toHexString();
  }
  return obj;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomSlugSuffix(n = 6): string {
  return randomBytes(Math.ceil(n / 2))
    .toString('hex')
    .slice(0, n);
}

function genJoinToken(): string {
  return randomBytes(24).toString('hex');
}

function genOptionId(): string {
  return randomBytes(4).toString('hex');
}

// ─── Webinar CRUD ───────────────────────────────────────────────────

export async function listSabwebinars(params?: {
  status?: SabwebinarStatus | 'all';
  q?: string;
}): Promise<{ success: boolean; data: Sabwebinar[] }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const filter: Filter<Document> = { ...userScope(userId) };
  if (params?.status && params.status !== 'all') filter.status = params.status;
  if (params?.q) {
    const rx = new RegExp(params.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { slug: rx }];
  }
  const docs = await db
    .collection(WEBINARS)
    .find(filter)
    .sort({ scheduledStart: -1, createdAt: -1 })
    .limit(200)
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as Sabwebinar[] };
}

export async function getSabwebinar(
  id: string,
): Promise<{ success: boolean; data: Sabwebinar | null }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const doc = await db.collection(WEBINARS).findOne({ _id: toObjectId(id), ...userScope(userId) });
  return { success: true, data: doc ? (serializeDoc(doc) as unknown as Sabwebinar) : null };
}

export async function getSabwebinarBySlug(
  slug: string,
): Promise<{ success: boolean; data: Sabwebinar | null }> {
  const { db } = await connectToDatabase();
  const doc = await db.collection(WEBINARS).findOne({ slug });
  return { success: true, data: doc ? (serializeDoc(doc) as unknown as Sabwebinar) : null };
}

export interface CreateSabwebinarInput {
  title: string;
  description?: string;
  slug?: string;
  hostName?: string;
  scheduledStart?: string;
  durationMinutes?: number;
  timezone?: string;
  capacity?: number;
  requireRegistration?: boolean;
  landingTheme?: SabwebinarLandingTheme;
  heroFileId?: string;
}

export async function createSabwebinar(
  input: CreateSabwebinarInput,
): Promise<{ success: boolean; data: Sabwebinar }> {
  if (!input.title?.trim()) throw new Error('title is required');
  const userId = await currentUserId();
  const scope = userScopeValue(userId);
  const { db } = await connectToDatabase();
  const now = new Date();

  const baseSlug = input.slug?.trim() ? slugify(input.slug) : slugify(input.title);
  const slug = baseSlug ? `${baseSlug}-${randomSlugSuffix()}` : `webinar-${randomSlugSuffix(8)}`;

  const doc: Record<string, unknown> = {
    userId: scope,
    slug,
    title: input.title.trim(),
    description: input.description,
    hostUserId: scope,
    hostName: input.hostName,
    scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
    durationMinutes: input.durationMinutes,
    timezone: input.timezone,
    status: 'draft' as SabwebinarStatus,
    landingTheme: input.landingTheme,
    heroFileId: input.heroFileId,
    requireRegistration: input.requireRegistration ?? true,
    capacity: input.capacity,
    createdAt: now,
  };
  const result = await db.collection(WEBINARS).insertOne(doc as Document);
  revalidatePath('/dashboard/sabwebinar');
  const inserted = await db.collection(WEBINARS).findOne({ _id: result.insertedId });
  return { success: true, data: serializeDoc(inserted as WithId<Document>) as unknown as Sabwebinar };
}

export async function updateSabwebinar(
  id: string,
  patch: Partial<Sabwebinar>,
): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of [
    'title',
    'description',
    'hostName',
    'timezone',
    'durationMinutes',
    'capacity',
    'requireRegistration',
    'landingTheme',
    'heroFileId',
    'recordingFileId',
  ] as const) {
    if (patch[k] !== undefined) set[k] = patch[k];
  }
  if (patch.scheduledStart) set.scheduledStart = new Date(patch.scheduledStart);
  if (patch.status) {
    set.status = patch.status;
    if (patch.status === 'live') set.startedAt = new Date();
    if (patch.status === 'ended' || patch.status === 'cancelled') set.endedAt = new Date();
  }
  await db
    .collection(WEBINARS)
    .updateOne({ _id: toObjectId(id), ...userScope(userId) }, { $set: set });
  revalidatePath('/dashboard/sabwebinar');
  revalidatePath(`/dashboard/sabwebinar/${id}`);
  return { success: true };
}

export async function deleteSabwebinar(id: string): Promise<{ success: boolean }> {
  return updateSabwebinar(id, { status: 'cancelled' });
}

// ─── Lifecycle (start / end) ────────────────────────────────────────

export async function startSabwebinar(id: string): Promise<{
  success: boolean;
  sessionId: string;
  streamUrl: string;
}> {
  const userId = await currentUserId();
  const scope = userScopeValue(userId);
  const { db } = await connectToDatabase();
  const webinarOid = toObjectId(id);
  const now = new Date();

  // Flip the webinar to `live`.
  await db.collection(WEBINARS).updateOne(
    { _id: webinarOid, ...userScope(userId) },
    { $set: { status: 'live', startedAt: now, updatedAt: now } },
  );

  // Stubbed stream URL — real provider plugs in via `webinarTransport`.
  const streamUrl = `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8?webinar=${id}`;

  const sessionDoc: Record<string, unknown> = {
    userId: scope,
    webinarId: webinarOid,
    startedAt: now,
    peakConcurrent: 0,
    streamUrl,
  };
  const result = await db.collection(SESSIONS).insertOne(sessionDoc as Document);
  revalidatePath(`/dashboard/sabwebinar/${id}`);
  return { success: true, sessionId: String(result.insertedId), streamUrl };
}

export async function endSabwebinar(
  id: string,
  opts?: { recordingFileId?: string },
): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const webinarOid = toObjectId(id);
  const now = new Date();
  const set: Record<string, unknown> = { status: 'ended', endedAt: now, updatedAt: now };
  if (opts?.recordingFileId) set.recordingFileId = opts.recordingFileId;
  await db.collection(WEBINARS).updateOne({ _id: webinarOid, ...userScope(userId) }, { $set: set });

  // Close the latest open session.
  await db
    .collection(SESSIONS)
    .updateOne(
      { webinarId: webinarOid, endedAt: { $exists: false } },
      { $set: { endedAt: now } },
      { sort: { startedAt: -1 } } as never,
    );
  revalidatePath(`/dashboard/sabwebinar/${id}`);
  return { success: true };
}

// ─── Registrations ──────────────────────────────────────────────────

export interface RegisterForSabwebinarInput {
  slug: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  source?: string;
  customFields?: Record<string, unknown>;
}

/** **Public** — landing-page registration; no auth. */
export async function registerForSabwebinar(input: RegisterForSabwebinarInput): Promise<{
  success: boolean;
  data: { registrationId: string; joinToken: string };
}> {
  if (!input.name?.trim()) throw new Error('name is required');
  if (!input.email?.trim()) throw new Error('email is required');
  const { db } = await connectToDatabase();
  const webinar = await db.collection(WEBINARS).findOne({ slug: input.slug });
  if (!webinar) throw new Error('webinar not found');

  if (typeof webinar.capacity === 'number' && webinar.capacity > 0) {
    const count = await db
      .collection(REGISTRATIONS)
      .countDocuments({ webinarId: webinar._id });
    if (count >= webinar.capacity) throw new Error('webinar is full');
  }

  const token = genJoinToken();
  const doc: Record<string, unknown> = {
    userId: webinar.userId,
    webinarId: webinar._id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone,
    company: input.company,
    customFields: input.customFields,
    source: input.source,
    registeredAt: new Date(),
    joinToken: token,
  };
  const result = await db.collection(REGISTRATIONS).insertOne(doc as Document);
  return {
    success: true,
    data: { registrationId: String(result.insertedId), joinToken: token },
  };
}

/** **Public** — record a join event by join token. */
export async function joinSabwebinar(joinToken: string): Promise<{ success: boolean }> {
  const { db } = await connectToDatabase();
  await db.collection(REGISTRATIONS).updateOne({ joinToken }, { $set: { joinedAt: new Date() } });
  return { success: true };
}

export async function listSabwebinarRegistrations(
  webinarId: string,
): Promise<{ success: boolean; data: SabwebinarRegistration[] }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(REGISTRATIONS)
    .find({ webinarId: toObjectId(webinarId), ...userScope(userId) })
    .sort({ registeredAt: -1 })
    .limit(1000)
    .toArray();
  return {
    success: true,
    data: docs.map(serializeDoc) as unknown as SabwebinarRegistration[],
  };
}

// ─── Chat ───────────────────────────────────────────────────────────

export interface SendSabwebinarChatInput {
  webinarId: string;
  sessionId?: string;
  senderName: string;
  body: string;
}

/** **Public** — both host and attendees send through this. */
export async function sendSabwebinarChat(
  input: SendSabwebinarChatInput,
): Promise<{ success: boolean; data: SabwebinarChat }> {
  if (!input.body?.trim()) throw new Error('body is required');
  if (!input.senderName?.trim()) throw new Error('senderName is required');
  const { db } = await connectToDatabase();
  const webinarOid = toObjectId(input.webinarId);
  const webinar = await db.collection(WEBINARS).findOne({ _id: webinarOid });
  if (!webinar) throw new Error('webinar not found');

  const doc: Record<string, unknown> = {
    userId: webinar.userId,
    webinarId: webinarOid,
    sessionId: input.sessionId ? toObjectId(input.sessionId) : undefined,
    senderName: input.senderName.trim(),
    body: input.body.trim(),
    ts: new Date(),
  };
  const result = await db.collection(CHAT).insertOne(doc as Document);
  const inserted = await db.collection(CHAT).findOne({ _id: result.insertedId });
  return {
    success: true,
    data: serializeDoc(inserted as WithId<Document>) as unknown as SabwebinarChat,
  };
}

export async function listSabwebinarChat(
  webinarId: string,
  opts?: { since?: string; limit?: number },
): Promise<{ success: boolean; data: SabwebinarChat[] }> {
  const { db } = await connectToDatabase();
  const filter: Filter<Document> = { webinarId: toObjectId(webinarId) };
  if (opts?.since) filter.ts = { $gt: new Date(opts.since) };
  const docs = await db
    .collection(CHAT)
    .find(filter)
    .sort({ ts: 1 })
    .limit(Math.min(opts?.limit ?? 200, 500))
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as SabwebinarChat[] };
}

// ─── Q&A ────────────────────────────────────────────────────────────

export interface AskSabwebinarQuestionInput {
  webinarId: string;
  question: string;
  askerName?: string;
}

/** **Public** — attendees ask without auth. */
export async function askSabwebinarQuestion(
  input: AskSabwebinarQuestionInput,
): Promise<{ success: boolean; data: SabwebinarQnaItem }> {
  if (!input.question?.trim()) throw new Error('question is required');
  const { db } = await connectToDatabase();
  const webinarOid = toObjectId(input.webinarId);
  const webinar = await db.collection(WEBINARS).findOne({ _id: webinarOid });
  if (!webinar) throw new Error('webinar not found');

  const doc: Record<string, unknown> = {
    userId: webinar.userId,
    webinarId: webinarOid,
    question: input.question.trim(),
    askerName: input.askerName,
    answered: false,
    upvotes: 0,
    upvoters: [],
    createdAt: new Date(),
  };
  const result = await db.collection(QNA).insertOne(doc as Document);
  const inserted = await db.collection(QNA).findOne({ _id: result.insertedId });
  return {
    success: true,
    data: serializeDoc(inserted as WithId<Document>) as unknown as SabwebinarQnaItem,
  };
}

export async function answerSabwebinarQuestion(
  qnaId: string,
  answer: string,
): Promise<{ success: boolean }> {
  if (!answer?.trim()) throw new Error('answer is required');
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  await db.collection(QNA).updateOne(
    { _id: toObjectId(qnaId), ...userScope(userId) },
    {
      $set: {
        answer: answer.trim(),
        answered: true,
        answeredAt: new Date(),
      },
    },
  );
  return { success: true };
}

export async function listSabwebinarQna(
  webinarId: string,
): Promise<{ success: boolean; data: SabwebinarQnaItem[] }> {
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(QNA)
    .find({ webinarId: toObjectId(webinarId) })
    .sort({ upvotes: -1, createdAt: -1 })
    .limit(500)
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as SabwebinarQnaItem[] };
}

// ─── Polls ──────────────────────────────────────────────────────────

export interface CreateSabwebinarPollInput {
  webinarId: string;
  question: string;
  options: string[];
  anonymous?: boolean;
}

export async function createSabwebinarPoll(
  input: CreateSabwebinarPollInput,
): Promise<{ success: boolean; data: SabwebinarPoll }> {
  if (!input.question?.trim()) throw new Error('question is required');
  const opts = (input.options ?? []).map((s) => s.trim()).filter(Boolean);
  if (opts.length < 2) throw new Error('at least two options are required');
  const userId = await currentUserId();
  const scope = userScopeValue(userId);
  const { db } = await connectToDatabase();
  const doc: Record<string, unknown> = {
    userId: scope,
    webinarId: toObjectId(input.webinarId),
    question: input.question.trim(),
    options: opts.map((label) => ({
      id: genOptionId(),
      label,
      voters: [],
      voteCount: 0,
    })),
    anonymous: input.anonymous ?? false,
    status: 'draft',
    createdAt: new Date(),
  };
  const result = await db.collection(POLLS).insertOne(doc as Document);
  const inserted = await db.collection(POLLS).findOne({ _id: result.insertedId });
  return {
    success: true,
    data: serializeDoc(inserted as WithId<Document>) as unknown as SabwebinarPoll,
  };
}

export async function setSabwebinarPollStatus(
  pollId: string,
  status: 'draft' | 'open' | 'closed',
): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const set: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === 'open') set.openedAt = new Date();
  if (status === 'closed') set.closedAt = new Date();
  await db
    .collection(POLLS)
    .updateOne({ _id: toObjectId(pollId), ...userScope(userId) }, { $set: set });
  return { success: true };
}

/** **Public** — vote without auth. */
export async function voteSabwebinarPoll(input: {
  pollId: string;
  optionId: string;
  voter?: string;
}): Promise<{ success: boolean }> {
  const { db } = await connectToDatabase();
  const poll = await db
    .collection(POLLS)
    .findOne({ _id: toObjectId(input.pollId), status: 'open' });
  if (!poll) throw new Error('poll not open');
  const voter = (input.voter ?? '').trim();
  if (!poll.anonymous && voter) {
    const optionsRaw = (poll as unknown as { options?: SabwebinarPollOption[] }).options ?? [];
    const already = optionsRaw.some((o) => (o.voters ?? []).includes(voter));
    if (already) throw new Error('already voted');
  }
  const update: Record<string, unknown> = {
    $inc: { 'options.$[opt].voteCount': 1 },
  };
  if (!poll.anonymous && voter) {
    update.$push = { 'options.$[opt].voters': voter };
  }
  await db.collection(POLLS).updateOne(
    { _id: toObjectId(input.pollId) },
    update,
    { arrayFilters: [{ 'opt.id': input.optionId }] } as never,
  );
  return { success: true };
}

export async function listSabwebinarPolls(
  webinarId: string,
): Promise<{ success: boolean; data: SabwebinarPoll[] }> {
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(POLLS)
    .find({ webinarId: toObjectId(webinarId) })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as SabwebinarPoll[] };
}

// ─── Analytics ──────────────────────────────────────────────────────

export async function getSabwebinarAnalytics(
  webinarId: string,
): Promise<{ success: boolean; data: SabwebinarAnalytics }> {
  const { db } = await connectToDatabase();
  const webinarOid = toObjectId(webinarId);
  const scope: Filter<Document> = { webinarId: webinarOid };

  const [regs, sessions, polls, qnaCount] = await Promise.all([
    db.collection(REGISTRATIONS).find(scope).limit(10000).toArray(),
    db.collection(SESSIONS).find(scope).limit(100).toArray(),
    db.collection(POLLS).find(scope).limit(200).toArray(),
    db.collection(QNA).countDocuments(scope),
  ]);

  const registeredCount = regs.length;
  let attendedCount = 0;
  let watchSecsTotal = 0;
  let watchSamples = 0;
  const bySource = new Map<string, number>();
  for (const r of regs) {
    const src = (r as { source?: string }).source ?? 'direct';
    bySource.set(src, (bySource.get(src) ?? 0) + 1);
    const joined = (r as { joinedAt?: Date }).joinedAt;
    const left = (r as { leftAt?: Date }).leftAt;
    if (joined) attendedCount += 1;
    if (joined instanceof Date && left instanceof Date) {
      const dur = (left.getTime() - joined.getTime()) / 1000;
      if (dur > 0) {
        watchSecsTotal += dur;
        watchSamples += 1;
      }
    }
  }
  const peakConcurrent = sessions.reduce(
    (acc, s) => Math.max(acc, (s as { peakConcurrent?: number }).peakConcurrent ?? 0),
    0,
  );
  const pollEngagementCount = polls.reduce((acc, p) => {
    const options = (p as { options?: SabwebinarPollOption[] }).options ?? [];
    return acc + options.reduce((s, o) => s + (o.voteCount ?? 0), 0);
  }, 0);

  const registrationsBySource = Array.from(bySource.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return {
    success: true,
    data: {
      webinarId,
      registeredCount,
      attendedCount,
      avgWatchTimeMinutes: watchSamples > 0 ? watchSecsTotal / watchSamples / 60 : 0,
      peakConcurrent,
      conversionRate: registeredCount > 0 ? attendedCount / registeredCount : 0,
      pollEngagementCount,
      qnaCount,
      registrationsBySource,
    },
  };
}
