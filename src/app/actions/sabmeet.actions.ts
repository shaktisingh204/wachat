'use server';

/**
 * SabMeet module server actions.
 *
 * Backed by Mongo collections (`meet_rooms`, `meet_participants`,
 * `meet_recordings`, `meet_polls`, `meet_qna`, `meet_dialins`). The Rust
 * crates `sabmeet-rooms`, etc., own the HTTP surface — these actions are
 * the Next.js bridge until `USE_RUST_SABMEET` is flipped on. (Collection
 * names preserved for backward compat with existing data.)
 *
 * Every doc is scoped by `userId` (multi-tenant). Auth is read from
 * `getServerSession` (NextAuth) — falls back to system tenant in dev.
 */

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type Filter, type WithId, type Document } from 'mongodb';
import { revalidatePath } from 'next/cache';

// ─── Types ────────────────────────────────────────────────────────────

export type SabmeetRoomStatus = 'scheduled' | 'live' | 'ended' | 'canceled';
export type SabmeetParticipantRole = 'host' | 'cohost' | 'participant' | 'viewer';
export type SabmeetRecordingStatus = 'recording' | 'processing' | 'ready' | 'failed';
export type SabmeetPollStatus = 'draft' | 'open' | 'closed';
export type SabmeetDialInPinPolicy = 'required' | 'optional' | 'none';

export interface SabmeetRoom {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  agenda?: string[];
  hostUserId: string;
  cohostUserIds?: string[];
  inviteeUserIds?: string[];
  inviteeEmails?: string[];
  scheduledStart?: string;
  scheduledEnd?: string;
  timezone?: string;
  joinCode: string;
  passcode?: string;
  lobbyEnabled: boolean;
  recordingEnabled: boolean;
  requireAuth: boolean;
  sfuRoomId?: string;
  status: SabmeetRoomStatus;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SabmeetParticipant {
  _id: string;
  userId: string;
  roomId: string;
  participantUserId?: string;
  guestEmail?: string;
  displayName: string;
  role: SabmeetParticipantRole;
  joinedAt: string;
  leftAt?: string;
  durationSecs?: number;
}

export interface SabmeetRecording {
  _id: string;
  userId: string;
  roomId: string;
  startedAt: string;
  endedAt?: string;
  durationSecs?: number;
  fileId?: string;
  audioFileId?: string;
  transcriptFileId?: string;
  status: SabmeetRecordingStatus;
  errorMessage?: string;
}

export interface SabmeetPollOption {
  id: string;
  label: string;
  voteCount: number;
}

export interface SabmeetPoll {
  _id: string;
  userId: string;
  roomId: string;
  question: string;
  options: SabmeetPollOption[];
  multiSelect: boolean;
  anonymous: boolean;
  status: SabmeetPollStatus;
}

export interface SabmeetQna {
  _id: string;
  userId: string;
  roomId: string;
  askerName?: string;
  question: string;
  answered: boolean;
  answer?: string;
  upvotes: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

const ROOMS = 'meet_rooms';
const PARTICIPANTS = 'meet_participants';
const RECORDINGS = 'meet_recordings';
const POLLS = 'meet_polls';
const QNA = 'meet_qna';
const DIALINS = 'meet_dialins';

async function currentUserId(): Promise<string> {
  // TODO(integrator): replace with the project's real auth helper
  // (`getServerSession(authOptions)` or `getCurrentUser()`); fall through
  // to a sentinel string in dev so SabMeet routes are usable without auth.
  return process.env.SABMEET_DEV_USER_ID ?? process.env.MEET_DEV_USER_ID ?? 'system';
}

function toObjectId(id: string): ObjectId {
  try {
    return new ObjectId(id);
  } catch {
    return new ObjectId();
  }
}

function userScope(userId: string): Filter<Document> {
  // For real ObjectId user ids use that; for the dev sentinel match the string.
  if (ObjectId.isValid(userId) && userId.length === 24) {
    return { userId: new ObjectId(userId) };
  }
  return { userId };
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

function genJoinCode(): string {
  const charset = 'abcdefghijkmnpqrstuvwxyz23456789';
  const seg = (n: number) =>
    Array.from({ length: n }, () => charset[Math.floor(Math.random() * charset.length)]).join('');
  return `${seg(3)}-${seg(4)}-${seg(3)}`;
}

// ─── Rooms ────────────────────────────────────────────────────────────

export async function listSabmeetRooms(params?: {
  when?: 'upcoming' | 'past' | 'live' | 'all';
  q?: string;
}): Promise<{ success: boolean; data: SabmeetRoom[] }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const now = new Date();
  const filter: Filter<Document> = { ...userScope(userId) };

  switch (params?.when ?? 'upcoming') {
    case 'all':
      break;
    case 'live':
      filter.status = 'live';
      break;
    case 'past':
      filter.$or = [{ status: 'ended' }, { scheduledEnd: { $lt: now } }];
      break;
    default:
      filter.$or = [
        { scheduledStart: { $gte: now } },
        { scheduledStart: { $exists: false } },
        { status: 'live' },
      ];
  }

  if (params?.q) {
    const rx = new RegExp(params.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$and = [{ $or: [{ name: rx }, { description: rx }, { joinCode: rx }] }];
  }

  const docs = await db
    .collection(ROOMS)
    .find(filter)
    .sort({ scheduledStart: 1, createdAt: -1 })
    .limit(100)
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as SabmeetRoom[] };
}

export async function getSabmeetRoom(id: string): Promise<{ success: boolean; data: SabmeetRoom | null }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const doc = await db.collection(ROOMS).findOne({ _id: toObjectId(id), ...userScope(userId) });
  return { success: true, data: doc ? (serializeDoc(doc) as unknown as SabmeetRoom) : null };
}

export async function getSabmeetRoomByJoinCode(
  joinCode: string,
): Promise<{ success: boolean; data: SabmeetRoom | null }> {
  const { db } = await connectToDatabase();
  const doc = await db.collection(ROOMS).findOne({ joinCode });
  return { success: true, data: doc ? (serializeDoc(doc) as unknown as SabmeetRoom) : null };
}

export interface CreateSabmeetRoomInput {
  name: string;
  description?: string;
  agenda?: string[];
  scheduledStart?: string;
  scheduledEnd?: string;
  timezone?: string;
  inviteeEmails?: string[];
  passcode?: string;
  lobbyEnabled?: boolean;
  recordingEnabled?: boolean;
  requireAuth?: boolean;
}

export async function createSabmeetRoom(input: CreateSabmeetRoomInput): Promise<{
  success: boolean;
  data: SabmeetRoom;
}> {
  if (!input.name?.trim()) throw new Error('name is required');
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const now = new Date();
  const userScopeVal = ObjectId.isValid(userId) && userId.length === 24
    ? new ObjectId(userId)
    : userId;
  const doc: Record<string, unknown> = {
    userId: userScopeVal,
    name: input.name.trim(),
    description: input.description,
    agenda: input.agenda ?? [],
    hostUserId: userScopeVal,
    cohostUserIds: [],
    inviteeUserIds: [],
    inviteeEmails: input.inviteeEmails ?? [],
    scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
    scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : undefined,
    timezone: input.timezone,
    joinCode: genJoinCode(),
    passcode: input.passcode,
    lobbyEnabled: input.lobbyEnabled ?? true,
    recordingEnabled: input.recordingEnabled ?? false,
    requireAuth: input.requireAuth ?? false,
    status: 'scheduled' as SabmeetRoomStatus,
    createdAt: now,
  };
  const result = await db.collection(ROOMS).insertOne(doc as Document);
  revalidatePath('/dashboard/sabmeet');
  const inserted = await db.collection(ROOMS).findOne({ _id: result.insertedId });
  return { success: true, data: serializeDoc(inserted as WithId<Document>) as unknown as SabmeetRoom };
}

export async function updateSabmeetRoom(
  id: string,
  patch: Partial<SabmeetRoom>,
): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of [
    'name',
    'description',
    'agenda',
    'timezone',
    'passcode',
    'lobbyEnabled',
    'recordingEnabled',
    'requireAuth',
    'sfuRoomId',
    'inviteeEmails',
  ] as const) {
    if (patch[k] !== undefined) set[k] = patch[k];
  }
  if (patch.scheduledStart) set.scheduledStart = new Date(patch.scheduledStart);
  if (patch.scheduledEnd) set.scheduledEnd = new Date(patch.scheduledEnd);
  if (patch.status) {
    set.status = patch.status;
    if (patch.status === 'live') set.startedAt = new Date();
    if (patch.status === 'ended' || patch.status === 'canceled') set.endedAt = new Date();
  }
  await db
    .collection(ROOMS)
    .updateOne({ _id: toObjectId(id), ...userScope(userId) }, { $set: set });
  revalidatePath('/dashboard/sabmeet');
  return { success: true };
}

export async function cancelSabmeetRoom(id: string): Promise<{ success: boolean }> {
  return updateSabmeetRoom(id, { status: 'canceled' });
}

// ─── Participants ─────────────────────────────────────────────────────

export async function listSabmeetParticipants(
  roomId: string,
  opts?: { activeOnly?: boolean },
): Promise<{ success: boolean; data: SabmeetParticipant[] }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const filter: Filter<Document> = { ...userScope(userId), roomId: toObjectId(roomId) };
  if (opts?.activeOnly) filter.leftAt = { $exists: false };
  const docs = await db
    .collection(PARTICIPANTS)
    .find(filter)
    .sort({ joinedAt: -1 })
    .limit(500)
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as SabmeetParticipant[] };
}

export interface JoinSabmeetRoomInput {
  roomId: string;
  displayName: string;
  participantUserId?: string;
  guestEmail?: string;
  role?: SabmeetParticipantRole;
}

export async function joinSabmeetRoom(input: JoinSabmeetRoomInput): Promise<{
  success: boolean;
  data: SabmeetParticipant;
}> {
  if (!input.displayName?.trim()) throw new Error('displayName is required');
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const now = new Date();
  const userScopeVal = ObjectId.isValid(userId) && userId.length === 24
    ? new ObjectId(userId)
    : userId;
  const doc: Record<string, unknown> = {
    userId: userScopeVal,
    roomId: toObjectId(input.roomId),
    participantUserId: input.participantUserId
      ? toObjectId(input.participantUserId)
      : undefined,
    guestEmail: input.guestEmail,
    displayName: input.displayName.trim(),
    role: input.role ?? 'participant',
    joinedAt: now,
    createdAt: now,
  };
  const result = await db.collection(PARTICIPANTS).insertOne(doc as Document);
  const inserted = await db.collection(PARTICIPANTS).findOne({ _id: result.insertedId });
  return {
    success: true,
    data: serializeDoc(inserted as WithId<Document>) as unknown as SabmeetParticipant,
  };
}

export async function leaveSabmeetRoom(participantId: string): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const before = await db
    .collection(PARTICIPANTS)
    .findOne({ _id: toObjectId(participantId), ...userScope(userId) });
  if (!before) return { success: false };
  const leftAt = new Date();
  const durationSecs = Math.max(
    0,
    Math.floor(
      (leftAt.getTime() - (before.joinedAt as Date).getTime()) / 1000,
    ),
  );
  await db
    .collection(PARTICIPANTS)
    .updateOne(
      { _id: toObjectId(participantId), ...userScope(userId) },
      { $set: { leftAt, durationSecs } },
    );
  return { success: true };
}

// ─── Recordings ───────────────────────────────────────────────────────

export async function listSabmeetRecordings(
  roomId: string,
): Promise<{ success: boolean; data: SabmeetRecording[] }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(RECORDINGS)
    .find({ ...userScope(userId), roomId: toObjectId(roomId) })
    .sort({ startedAt: -1 })
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as SabmeetRecording[] };
}

export async function startSabmeetRecording(
  roomId: string,
): Promise<{ success: boolean; data: SabmeetRecording }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const now = new Date();
  const userScopeVal = ObjectId.isValid(userId) && userId.length === 24
    ? new ObjectId(userId)
    : userId;
  const doc = {
    userId: userScopeVal,
    roomId: toObjectId(roomId),
    startedAt: now,
    status: 'recording' as SabmeetRecordingStatus,
    createdAt: now,
  };
  const result = await db.collection(RECORDINGS).insertOne(doc);
  const inserted = await db.collection(RECORDINGS).findOne({ _id: result.insertedId });
  return {
    success: true,
    data: serializeDoc(inserted as WithId<Document>) as unknown as SabmeetRecording,
  };
}

/**
 * Mark a recording ready. `fileId` MUST come from SabFiles — never a free
 * URL. Callers should upload via `<SabFileUrlInput>` / `<SabFilePickerButton>`
 * and pass the returned SabFile id here.
 */
export async function completeSabmeetRecording(input: {
  recordingId: string;
  fileId: string;
  audioFileId?: string;
  transcriptFileId?: string;
  durationSecs?: number;
}): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  await db.collection(RECORDINGS).updateOne(
    { _id: toObjectId(input.recordingId), ...userScope(userId) },
    {
      $set: {
        status: 'ready',
        endedAt: new Date(),
        fileId: input.fileId,
        audioFileId: input.audioFileId,
        transcriptFileId: input.transcriptFileId,
        durationSecs: input.durationSecs,
        updatedAt: new Date(),
      },
    },
  );
  return { success: true };
}

// ─── Polls ────────────────────────────────────────────────────────────

export async function listSabmeetPolls(roomId: string): Promise<{ success: boolean; data: SabmeetPoll[] }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(POLLS)
    .find({ ...userScope(userId), roomId: toObjectId(roomId) })
    .sort({ createdAt: -1 })
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as SabmeetPoll[] };
}

export async function createSabmeetPoll(input: {
  roomId: string;
  question: string;
  options: string[];
  multiSelect?: boolean;
  anonymous?: boolean;
}): Promise<{ success: boolean; data: SabmeetPoll }> {
  if (!input.question?.trim()) throw new Error('question is required');
  if ((input.options ?? []).filter(o => o.trim()).length < 2)
    throw new Error('at least 2 options are required');
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const userScopeVal = ObjectId.isValid(userId) && userId.length === 24
    ? new ObjectId(userId)
    : userId;
  const doc = {
    userId: userScopeVal,
    roomId: toObjectId(input.roomId),
    question: input.question.trim(),
    options: input.options.map((label, i) => ({
      id: `opt_${i + 1}`,
      label: label.trim(),
      voters: [] as string[],
      voteCount: 0,
    })),
    multiSelect: input.multiSelect ?? false,
    anonymous: input.anonymous ?? false,
    status: 'open' as SabmeetPollStatus,
    createdAt: new Date(),
  };
  const result = await db.collection(POLLS).insertOne(doc);
  const inserted = await db.collection(POLLS).findOne({ _id: result.insertedId });
  return {
    success: true,
    data: serializeDoc(inserted as WithId<Document>) as unknown as SabmeetPoll,
  };
}

export async function voteSabmeetPoll(input: {
  pollId: string;
  optionIds: string[];
  voter: string;
}): Promise<{ success: boolean }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const poll = await db
    .collection(POLLS)
    .findOne({ _id: toObjectId(input.pollId), ...userScope(userId) });
  if (!poll || poll.status !== 'open') return { success: false };
  const options = (poll.options as SabmeetPollOption[]).map(o => {
    if (input.optionIds.includes(o.id)) {
      const voters = (poll.anonymous ? [] : (o as SabmeetPollOption & { voters?: string[] }).voters) ?? [];
      const already = voters.includes(input.voter);
      const nextVoters = already || poll.anonymous ? voters : [...voters, input.voter];
      return {
        ...o,
        voters: nextVoters,
        voteCount: poll.anonymous ? o.voteCount + 1 : nextVoters.length,
      };
    }
    return o;
  });
  await db
    .collection(POLLS)
    .updateOne(
      { _id: toObjectId(input.pollId), ...userScope(userId) },
      { $set: { options, updatedAt: new Date() } },
    );
  return { success: true };
}

// ─── Q&A ──────────────────────────────────────────────────────────────

export async function listSabmeetQna(roomId: string): Promise<{ success: boolean; data: SabmeetQna[] }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(QNA)
    .find({ ...userScope(userId), roomId: toObjectId(roomId) })
    .sort({ upvotes: -1, createdAt: 1 })
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as SabmeetQna[] };
}

export async function askSabmeetQuestion(input: {
  roomId: string;
  question: string;
  askerName?: string;
}): Promise<{ success: boolean }> {
  if (!input.question?.trim()) throw new Error('question is required');
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const userScopeVal = ObjectId.isValid(userId) && userId.length === 24
    ? new ObjectId(userId)
    : userId;
  await db.collection(QNA).insertOne({
    userId: userScopeVal,
    roomId: toObjectId(input.roomId),
    askerName: input.askerName,
    question: input.question.trim(),
    answered: false,
    upvotes: 0,
    upvoters: [] as string[],
    createdAt: new Date(),
  });
  return { success: true };
}

export async function answerSabmeetQuestion(input: {
  qnaId: string;
  answer: string;
}): Promise<{ success: boolean }> {
  if (!input.answer?.trim()) throw new Error('answer is required');
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  await db.collection(QNA).updateOne(
    { _id: toObjectId(input.qnaId), ...userScope(userId) },
    {
      $set: {
        answered: true,
        answer: input.answer.trim(),
        answeredAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
  return { success: true };
}

// ─── Analytics ────────────────────────────────────────────────────────

export interface SabmeetRoomAnalytics {
  totalAttendees: number;
  uniqueAttendees: number;
  peakConcurrent: number;
  avgDurationSecs: number;
  totalRecordings: number;
}

export async function getSabmeetRoomAnalytics(
  roomId: string,
): Promise<{ success: boolean; data: SabmeetRoomAnalytics }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const filter = { ...userScope(userId), roomId: toObjectId(roomId) };
  const parts = await db.collection(PARTICIPANTS).find(filter).toArray();

  const totalAttendees = parts.length;
  const uniqueAttendees = new Set(
    parts.map(p =>
      String(p.participantUserId ?? p.guestEmail ?? p.displayName ?? ''),
    ),
  ).size;
  const durations = parts
    .map(p => (typeof p.durationSecs === 'number' ? (p.durationSecs as number) : 0))
    .filter(n => n > 0);
  const avgDurationSecs =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  // peakConcurrent — sweep join/leave events.
  type Event = { t: number; delta: 1 | -1 };
  const events: Event[] = [];
  for (const p of parts) {
    const join = p.joinedAt as Date | undefined;
    const leave = p.leftAt as Date | undefined;
    if (join) events.push({ t: join.getTime(), delta: 1 });
    if (leave) events.push({ t: leave.getTime(), delta: -1 });
  }
  events.sort((a, b) => a.t - b.t || a.delta - b.delta);
  let peak = 0;
  let cur = 0;
  for (const e of events) {
    cur += e.delta;
    if (cur > peak) peak = cur;
  }

  const totalRecordings = await db.collection(RECORDINGS).countDocuments(filter);

  return {
    success: true,
    data: {
      totalAttendees,
      uniqueAttendees,
      peakConcurrent: peak,
      avgDurationSecs,
      totalRecordings,
    },
  };
}

// ─── Dial-ins ─────────────────────────────────────────────────────────

export interface SabmeetDialIn {
  _id: string;
  regionCode: string;
  label: string;
  phoneNumber: string;
  pinPolicy: SabmeetDialInPinPolicy;
  tollFree?: boolean;
  isDefault?: boolean;
  language?: string;
  active: boolean;
}

export async function listSabmeetDialIns(): Promise<{ success: boolean; data: SabmeetDialIn[] }> {
  const userId = await currentUserId();
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(DIALINS)
    .find({ ...userScope(userId), active: true })
    .sort({ regionCode: 1, label: 1 })
    .toArray();
  return { success: true, data: docs.map(serializeDoc) as unknown as SabmeetDialIn[] };
}
