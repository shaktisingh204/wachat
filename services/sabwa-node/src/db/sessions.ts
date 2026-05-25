/**
 * `sabwa_sessions` collection helpers.
 *
 * Schema mirrors the Rust engine's `services/sabwa-engine/src/db/sessions.rs`
 * 1:1 so a single Mongo database can be operated by either engine.
 *
 * All date fields are written as BSON `Date` values (native JS `Date`
 * round-trips through the Mongo driver as a BSON DateTime), and the
 * encrypted Baileys auth-state blob is stored as a generic BSON Binary
 * on `authState`.
 */

import {
  Binary,
  ObjectId,
  type Collection,
  type Db,
  type WithId,
} from 'mongodb';

export const COLLECTION = 'sabwa_sessions';

// ---------------------------------------------------------------------------
// Wire / row shapes
// ---------------------------------------------------------------------------

export type SessionStatus =
  | 'pending'
  | 'connected'
  | 'logged_out'
  | 'banned'
  | 'error';

export type PairMethod = 'qr' | 'code';

export type RateProfile = 'safe' | 'normal' | 'aggressive';

export interface DeviceMeta {
  platform?: string;
  appVersion?: string;
  batteryLevel?: number;
}

export interface BanSignal {
  ts: Date;
  kind: string;
  detail?: string;
}

/** Raw Mongo document shape. */
export interface SabwaSessionDoc {
  _id?: ObjectId;
  projectId: ObjectId;
  userId: ObjectId;
  phoneE164?: string;
  pushName?: string;
  profilePicUrl?: string;
  status: SessionStatus;
  pairMethod: PairMethod;
  /** Encrypted Baileys auth blob (see wa/auth-state.ts). */
  authState?: Binary;
  deviceMeta?: DeviceMeta;
  lastConnectedAt?: Date;
  lastSeenAt?: Date;
  workerNodeId?: string;
  banSignals?: BanSignal[];
  rateLimitProfile: RateProfile;
  warmupEnabled?: boolean;
  dailyResetTimezone?: string;
  overrides?: Record<string, number>;
  /** Optional human label set by the operator. */
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Wire-shape projection used by routes / Next.js clients. */
export interface SessionSummary {
  sessionId: string;
  projectId: string;
  userId: string;
  phoneE164?: string;
  pushName?: string;
  status: SessionStatus;
  profilePicUrl?: string;
  lastConnectedAt?: string;
  pairMethod?: PairMethod;
  rateLimitProfile?: RateProfile;
  label?: string;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function toSummary(doc: WithId<SabwaSessionDoc> | SabwaSessionDoc): SessionSummary {
  return {
    sessionId: doc._id ? doc._id.toHexString() : '',
    projectId: doc.projectId.toHexString(),
    userId: doc.userId.toHexString(),
    phoneE164: doc.phoneE164,
    pushName: doc.pushName,
    status: doc.status,
    profilePicUrl: doc.profilePicUrl,
    lastConnectedAt: doc.lastConnectedAt
      ? doc.lastConnectedAt.toISOString()
      : undefined,
    pairMethod: doc.pairMethod,
    rateLimitProfile: doc.rateLimitProfile,
    label: doc.label,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function col(db: Db): Collection<SabwaSessionDoc> {
  return db.collection<SabwaSessionDoc>(COLLECTION);
}

export interface InsertPendingInput {
  projectId: string;
  userId: string;
  pairMethod: PairMethod;
  phoneE164?: string;
}

/**
 * Insert a brand-new `pending` session row. Returns the hex-encoded
 * `_id` so the route can hand it back to the caller immediately.
 */
export async function insertPending(
  db: Db,
  input: InsertPendingInput,
): Promise<{ sessionId: string; doc: SabwaSessionDoc }> {
  let projectOid: ObjectId;
  let userOid: ObjectId;
  try {
    projectOid = new ObjectId(input.projectId);
  } catch {
    throw new Error(`invalid projectId: ${input.projectId}`);
  }
  try {
    userOid = new ObjectId(input.userId);
  } catch {
    throw new Error(`invalid userId: ${input.userId}`);
  }

  const now = new Date();
  const doc: SabwaSessionDoc = {
    projectId: projectOid,
    userId: userOid,
    phoneE164: input.phoneE164,
    status: 'pending',
    pairMethod: input.pairMethod,
    rateLimitProfile: 'normal',
    banSignals: [],
    createdAt: now,
    updatedAt: now,
  };

  const res = await col(db).insertOne(doc as SabwaSessionDoc);
  return { sessionId: res.insertedId.toHexString(), doc: { ...doc, _id: res.insertedId } };
}

/** Look up a single session by its hex id. Returns `null` when absent. */
export async function findById(
  db: Db,
  sessionId: string,
): Promise<SessionSummary | null> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(sessionId);
  } catch {
    return null;
  }
  const doc = await col(db).findOne({ _id: oid });
  return doc ? toSummary(doc) : null;
}

/** List every session belonging to a project. */
export async function findByProject(
  db: Db,
  projectId: string,
): Promise<SessionSummary[]> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(projectId);
  } catch {
    return [];
  }
  const docs = await col(db).find({ projectId: oid }).toArray();
  return docs.map(toSummary);
}

/** Flip a session's `status` and stamp `updatedAt`. */
export async function updateStatus(
  db: Db,
  sessionId: string,
  status: SessionStatus,
): Promise<void> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(sessionId);
  } catch {
    return;
  }
  const now = new Date();
  const set: Partial<SabwaSessionDoc> = { status, updatedAt: now };
  if (status === 'connected') set.lastConnectedAt = now;
  await col(db).updateOne({ _id: oid }, { $set: set });
}

export interface UpdateIdentityInput {
  phoneE164?: string;
  pushName?: string;
  profilePicUrl?: string;
}

/** Persist the WhatsApp identity we learn post-pair. */
export async function updateIdentity(
  db: Db,
  sessionId: string,
  input: UpdateIdentityInput,
): Promise<void> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(sessionId);
  } catch {
    return;
  }
  const set: Partial<SabwaSessionDoc> = { updatedAt: new Date() };
  if (input.phoneE164) set.phoneE164 = input.phoneE164;
  if (input.pushName) set.pushName = input.pushName;
  if (input.profilePicUrl) set.profilePicUrl = input.profilePicUrl;
  if (Object.keys(set).length <= 1) return; // only `updatedAt`
  await col(db).updateOne({ _id: oid }, { $set: set });
}

/**
 * Persist a freshly-encrypted `authState` blob. The caller is responsible
 * for encrypting — this helper is just the Mongo write.
 */
export async function updateAuthState(
  db: Db,
  sessionId: string,
  ciphertext: Buffer,
): Promise<void> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(sessionId);
  } catch {
    return;
  }
  await col(db).updateOne(
    { _id: oid },
    {
      $set: {
        authState: new Binary(ciphertext),
        updatedAt: new Date(),
      },
    },
  );
}

export interface UpdateMetadataInput {
  label?: string;
  rateLimitProfile?: RateProfile;
  warmupEnabled?: boolean;
  dailyResetTimezone?: string;
  overrides?: Record<string, number>;
}

/** Patch label and/or rate-limit profile. No-op if neither field provided. */
export async function updateMetadata(
  db: Db,
  sessionId: string,
  input: UpdateMetadataInput,
): Promise<void> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(sessionId);
  } catch {
    return;
  }
  const set: Partial<SabwaSessionDoc> = { updatedAt: new Date() };
  if (input.label !== undefined) set.label = input.label;
  if (input.rateLimitProfile !== undefined) set.rateLimitProfile = input.rateLimitProfile;
  if (input.warmupEnabled !== undefined) set.warmupEnabled = input.warmupEnabled;
  if (input.dailyResetTimezone !== undefined) set.dailyResetTimezone = input.dailyResetTimezone;
  if (input.overrides !== undefined) set.overrides = input.overrides;
  if (Object.keys(set).length <= 1) return;
  await col(db).updateOne({ _id: oid }, { $set: set });
}

/** Hard-delete a session row (used after a `logout`). */
export async function deleteSession(db: Db, sessionId: string): Promise<void> {
  let oid: ObjectId;
  try {
    oid = new ObjectId(sessionId);
  } catch {
    return;
  }
  await col(db).deleteOne({ _id: oid });
}
