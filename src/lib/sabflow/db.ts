import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { Collection } from 'mongodb';
import type { SabFlowDoc, FlowNotificationSettings, RecentSubmissionRow } from './types';
import type { FlowSession } from './execution/types';
import type { WhatsAppConfig } from './whatsapp/types';

/* ══════════════════════════════════════════════════════════
   Version history types
   ══════════════════════════════════════════════════════════ */

/** A persisted snapshot of a SabFlowDoc at a point in time. */
export interface Version {
  /** MongoDB ObjectId string */
  _id: string;
  flowId: string;
  snapshot: SabFlowDoc;
  savedAt: Date;
  /** User-supplied label, or "Auto-save" when omitted. */
  label: string;
  userId: string;
}

/** Raw MongoDB document shape for the versions collection. */
interface VersionDoc {
  _id: ObjectId;
  flowId: string;
  snapshot: SabFlowDoc;
  savedAt: Date;
  label: string;
  userId: string;
}

const MAX_VERSIONS = 20;

export async function getSabFlowCollection(): Promise<Collection<SabFlowDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<SabFlowDoc>('sabflows');
}

// ── getSabFlowsByUserId ────────────────────────────────────────────────────

/**
 * Returns all SabFlowDocs owned by the given user, sorted by last updated.
 * Full documents are returned (caller can project if needed).
 */
export async function getSabFlowsByUserId(userId: string): Promise<SabFlowDoc[]> {
  const col = await getSabFlowCollection();
  return col.find({ userId }).sort({ updatedAt: -1 }).toArray();
}

// ── getSabFlowById ─────────────────────────────────────────────────────────

/**
 * Returns a single SabFlowDoc by its MongoDB ObjectId string.
 * Returns null when the id is invalid or the document does not exist.
 */
export async function getSabFlowById(id: string): Promise<SabFlowDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await getSabFlowCollection();
  return col.findOne({ _id: new ObjectId(id) });
}

// ── saveSabFlow ────────────────────────────────────────────────────────────

/**
 * Upserts a SabFlowDoc into the collection.
 * When `flow._id` is present the document is replaced in-place;
 * otherwise a new document is inserted.
 */
export async function saveSabFlow(flow: SabFlowDoc): Promise<void> {
  const col = await getSabFlowCollection();

  if (flow._id) {
    const { _id, ...rest } = flow;
    await col.replaceOne(
      { _id },
      { _id, ...rest, updatedAt: new Date() } as SabFlowDoc,
      { upsert: true },
    );
  } else {
    const now = new Date();
    await col.insertOne({
      ...flow,
      createdAt: flow.createdAt ?? now,
      updatedAt: now,
    } as SabFlowDoc);
  }
}

// ── deleteSabFlow ──────────────────────────────────────────────────────────

/**
 * Deletes a SabFlowDoc by its MongoDB ObjectId string.
 * Silently does nothing when the id is invalid or the document is missing.
 */
export async function deleteSabFlow(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await getSabFlowCollection();
  await col.deleteOne({ _id: new ObjectId(id) });
}

// ── Version helpers ────────────────────────────────────────────────────────

async function getVersionCollection(): Promise<Collection<VersionDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<VersionDoc>('sabflow_versions');
  // Index for fast per-flow queries + deletion of oldest entries.
  await col.createIndex({ flowId: 1, savedAt: -1 }, { background: true });
  return col;
}

/**
 * Saves a snapshot of the flow as a new version entry.
 * Deletes the oldest version(s) when the per-flow cap (20) is exceeded.
 * Returns the inserted ObjectId as a hex string.
 */
export async function saveVersion(
  flowId: string,
  snapshot: SabFlowDoc,
  label?: string,
  userId?: string,
): Promise<string> {
  const col = await getVersionCollection();

  const doc: VersionDoc = {
    _id: new ObjectId(),
    flowId,
    snapshot,
    savedAt: new Date(),
    label: label?.trim() || 'Auto-save',
    userId: userId ?? '',
  };

  await col.insertOne(doc);

  // Enforce the cap: find all versions for this flow ordered newest→oldest,
  // skip the ones we want to keep, delete the rest.
  const all = await col
    .find({ flowId }, { projection: { _id: 1 } })
    .sort({ savedAt: -1 })
    .toArray();

  if (all.length > MAX_VERSIONS) {
    const toDelete = all.slice(MAX_VERSIONS).map((d) => d._id);
    await col.deleteMany({ _id: { $in: toDelete } });
  }

  return doc._id.toHexString();
}

/**
 * Returns all versions for a flow, newest first, with _id serialised to string.
 */
export async function getVersions(flowId: string): Promise<Version[]> {
  const col = await getVersionCollection();
  const docs = await col
    .find({ flowId })
    .sort({ savedAt: -1 })
    .toArray();

  return docs.map((d) => ({
    _id: d._id.toHexString(),
    flowId: d.flowId,
    snapshot: d.snapshot,
    savedAt: d.savedAt,
    label: d.label,
    userId: d.userId,
  }));
}

/**
 * Returns a single Version (with full snapshot) by its id.
 * Returns `null` when the id is invalid or the version does not belong
 * to the given flow.
 */
export async function getVersionById(
  flowId: string,
  versionId: string,
): Promise<Version | null> {
  if (!ObjectId.isValid(versionId)) return null;
  const col = await getVersionCollection();
  const doc = await col.findOne({ _id: new ObjectId(versionId), flowId });
  if (!doc) return null;
  return {
    _id: doc._id.toHexString(),
    flowId: doc.flowId,
    snapshot: doc.snapshot,
    savedAt: doc.savedAt,
    label: doc.label,
    userId: doc.userId,
  };
}

/**
 * Overwrites the live flow with the snapshot stored in `versionId`.
 * Throws when either the version or the flow is not found.
 * Returns the updated SabFlowDoc.
 */
export async function restoreVersion(
  flowId: string,
  versionId: string,
): Promise<SabFlowDoc> {
  if (!ObjectId.isValid(versionId)) {
    throw new Error('Version not found');
  }

  const versionCol = await getVersionCollection();
  const version = await versionCol.findOne({
    _id: new ObjectId(versionId),
    flowId,
  });

  if (!version) {
    throw new Error('Version not found');
  }

  const flowCol = await getSabFlowCollection();
  if (!ObjectId.isValid(flowId)) {
    throw new Error('Flow not found');
  }

  const flowOid = new ObjectId(flowId);
  const { _id: _snapId, ...snapFields } = version.snapshot;

  const updated: SabFlowDoc = {
    ...snapFields,
    _id: flowOid,
    updatedAt: new Date(),
  };

  await flowCol.replaceOne({ _id: flowOid }, updated as SabFlowDoc);

  return updated;
}

// ── Session helpers ────────────────────────────────────────────────────────

type SessionDoc = FlowSession & { expiresAt: Date };

async function getSessionCollection(): Promise<Collection<SessionDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<SessionDoc>('sabflow_sessions');
  // Ensure TTL index exists (24 h). createIndex is idempotent.
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
  return col;
}

/**
 * Inserts a new FlowSession into `sabflow_sessions` with a 24-hour TTL.
 */
export async function createSession(session: FlowSession): Promise<void> {
  const col = await getSessionCollection();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await col.insertOne({ ...session, expiresAt } as SessionDoc);
}

/**
 * Returns a FlowSession by its `id` field (UUID string), or null if not found / expired.
 */
export async function getSession(sessionId: string): Promise<FlowSession | null> {
  const col = await getSessionCollection();
  const doc = await col.findOne({ id: sessionId });
  if (!doc) return null;
  // Exclude Mongo internals before returning
  const { expiresAt: _exp, ...session } = doc as SessionDoc & { _id: unknown };
  return session as unknown as FlowSession;
}

/**
 * Applies a partial update to an existing session and refreshes the TTL.
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<FlowSession>,
): Promise<void> {
  const col = await getSessionCollection();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await col.updateOne(
    { id: sessionId },
    { $set: { ...updates, expiresAt } },
  );
}

// ── Submission helpers ─────────────────────────────────────────────────────

interface SubmissionDoc {
  flowId: string;
  sessionId: string;
  variables: Record<string, unknown>;
  completedAt: Date;
}

async function getSubmissionCollection(): Promise<Collection<SubmissionDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<SubmissionDoc>('sabflow_submissions');
}

/**
 * Persists a completed flow submission.
 */
export async function saveSubmission(data: {
  flowId: string;
  sessionId: string;
  variables: Record<string, unknown>;
  completedAt: Date;
}): Promise<void> {
  const col = await getSubmissionCollection();
  await col.insertOne(data);
}

/**
 * Returns paginated submissions for a given flowId, newest first.
 */
export async function getSubmissions(
  flowId: string,
  limit = 50,
  skip = 0,
): Promise<{ submissions: unknown[]; total: number }> {
  const col = await getSubmissionCollection();
  const [submissions, total] = await Promise.all([
    col.find({ flowId }).sort({ completedAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments({ flowId }),
  ]);
  return { submissions, total };
}

/**
 * Returns the count of submissions for a flowId since the start of today (UTC).
 */
export async function getTodaySubmissionCount(flowId: string): Promise<number> {
  const col = await getSubmissionCollection();
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  return col.countDocuments({ flowId, completedAt: { $gte: startOfToday } });
}

/**
 * Returns the last `limit` submissions across all flows owned by the user,
 * joined with the flow name. Sorted newest first.
 */
export async function getRecentSubmissions(
  userId: string,
  limit = 10,
): Promise<RecentSubmissionRow[]> {
  const { db } = await connectToDatabase();

  // Aggregate: join submissions with sabflows on flowId = sabflows._id (string vs ObjectId)
  // sabflow_submissions.flowId is stored as a string of the ObjectId
  const rows = await db
    .collection<SubmissionDoc>('sabflow_submissions')
    .aggregate<RecentSubmissionRow & { _id: ObjectId }>([
      // Sort first so $limit trims the right docs
      { $sort: { completedAt: -1 } },
      {
        $addFields: {
          flowObjectId: { $toObjectId: '$flowId' },
        },
      },
      {
        $lookup: {
          from: 'sabflows',
          localField: 'flowObjectId',
          foreignField: '_id',
          as: 'flow',
        },
      },
      { $unwind: '$flow' },
      // Only include flows owned by this user
      { $match: { 'flow.userId': userId } },
      { $limit: limit },
      {
        $project: {
          submissionId: { $toString: '$_id' },
          flowId: 1,
          flowName: '$flow.name',
          completedAt: 1,
        },
      },
    ])
    .toArray();

  return rows.map(({ submissionId, flowId, flowName, completedAt }) => ({
    submissionId,
    flowId,
    flowName,
    completedAt,
  }));
}

// ── Notification settings helpers ──────────────────────────────────────────

interface NotificationSettingsDoc extends FlowNotificationSettings {
  _id?: ObjectId;
}

async function getNotificationSettingsCollection(): Promise<
  Collection<NotificationSettingsDoc>
> {
  const { db } = await connectToDatabase();
  const col = db.collection<NotificationSettingsDoc>('sabflow_notification_settings');
  // Unique index on flowId for efficient upserts
  await col.createIndex({ flowId: 1 }, { unique: true, background: true });
  return col;
}

/**
 * Returns the notification settings for a flow, or null if none have been saved.
 */
export async function getNotificationSettings(
  flowId: string,
): Promise<FlowNotificationSettings | null> {
  const col = await getNotificationSettingsCollection();
  const doc = await col.findOne({ flowId });
  if (!doc) return null;
  const { _id: _unused, ...rest } = doc;
  return rest as FlowNotificationSettings;
}

/**
 * Upserts (creates or fully replaces) the notification settings for a flow.
 */
export async function saveNotificationSettings(
  settings: FlowNotificationSettings,
): Promise<void> {
  const col = await getNotificationSettingsCollection();
  await col.replaceOne(
    { flowId: settings.flowId },
    settings as NotificationSettingsDoc,
    { upsert: true },
  );
}

// ── WhatsApp config helpers ────────────────────────────────────────────────

interface WhatsAppConfigDoc extends WhatsAppConfig {
  _id?: ObjectId;
}

async function getWhatsAppConfigCollection(): Promise<Collection<WhatsAppConfigDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<WhatsAppConfigDoc>('sabflow_whatsapp_configs');
  await col.createIndex({ flowId: 1 }, { unique: true, background: true });
  return col;
}

/**
 * Returns the stored WhatsApp configuration for a flow, or null when none
 * has been saved yet.  `accessToken` is returned as-is (still encrypted).
 */
export async function getWhatsAppConfig(
  flowId: string,
): Promise<WhatsAppConfig | null> {
  const col = await getWhatsAppConfigCollection();
  const doc = await col.findOne({ flowId });
  if (!doc) return null;
  const { _id: _unused, ...rest } = doc;
  return rest as WhatsAppConfig;
}

/**
 * Upserts (creates or fully replaces) the WhatsApp configuration for a flow.
 * Callers are expected to have encrypted `accessToken` already.
 */
export async function saveWhatsAppConfig(config: WhatsAppConfig): Promise<void> {
  const col = await getWhatsAppConfigCollection();
  const now = new Date();
  const toSave: WhatsAppConfigDoc = {
    ...config,
    createdAt: config.createdAt ?? now,
    updatedAt: now,
  };
  await col.replaceOne(
    { flowId: config.flowId },
    toSave,
    { upsert: true },
  );
}

/**
 * Finds the most recent active session for (flowId, phone).  Used by the
 * WhatsApp webhook to resume existing conversations instead of starting a
 * new one on every inbound message.
 *
 * Convention: sessions started via WhatsApp store the sender's phone number
 * on `variables.waPhone`.  Returns null when no active session is found.
 */
export async function getWhatsAppSessionByPhone(
  flowId: string,
  phone: string,
): Promise<FlowSession | null> {
  const col = await getSessionCollection();
  const doc = await col.findOne(
    {
      flowId,
      status: 'active',
      'variables.waPhone': phone,
    },
    { sort: { updatedAt: -1 } },
  );
  if (!doc) return null;
  const { expiresAt: _exp, ...session } = doc as SessionDoc & { _id: unknown };
  return session as unknown as FlowSession;
}
