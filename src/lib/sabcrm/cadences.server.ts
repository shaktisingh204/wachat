import 'server-only';

/**
 * SabCRM — multichannel cadence TEMPLATE config runtime (server-only).
 *
 * Persists cadence templates in `sabcrm_cadences` (projectId-scoped, the
 * native-Mongo config pattern of `./scoring.server.ts` / `./sequences.server`).
 * A cadence template is an ordered list of multichannel steps
 * (email / sms / whatsapp / task / wait) — the channel-aware companion to the
 * Rust `sabcrm-sequences` engine's email/task/wait steps. The pure step model
 * + validation lives in `./cadence-channels`; the per-step send routing lives in
 * `./cadence-channels.server`. This module only stores + reads the definitions.
 *
 * It is config metadata, so a `sabcrm_*` config collection MAY bump its own
 * `updatedAt` (the no-bump rule only applies to record `data.*` writes).
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  normalizeSteps,
  type CadenceStep,
  type CadenceTemplate,
  type CadenceTemplateInput,
} from './cadence-channels';

export {
  type CadenceStep,
  type CadenceTemplate,
  type CadenceTemplateInput,
  type CadenceChannel,
  type CadenceAbVariant,
} from './cadence-channels';

const CADENCES_COLL = 'sabcrm_cadences';

/** Raw Mongo doc for a cadence template. */
interface CadenceDoc {
  _id: ObjectId | string;
  projectId: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  steps?: CadenceStep[];
  createdAt?: string;
  updatedAt?: string;
}

/** Hex-stringify a Mongo `_id` regardless of stored type. */
function idHex(id: ObjectId | string): string {
  return id instanceof ObjectId ? id.toHexString() : String(id);
}

/** Normalize a persisted doc into the API {@link CadenceTemplate} shape. */
function toTemplate(doc: CadenceDoc): CadenceTemplate {
  return {
    id: idHex(doc._id),
    projectId: doc.projectId,
    objectSlug: doc.objectSlug,
    name: doc.name,
    enabled: doc.enabled !== false,
    steps: Array.isArray(doc.steps) ? doc.steps : [],
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? '',
  };
}

/* -------------------------------------------------------------------------- */
/* Config CRUD                                                                  */
/* -------------------------------------------------------------------------- */

/** All cadence templates for a project (newest first). */
export async function listCadenceTemplates(
  projectId: string,
): Promise<CadenceTemplate[]> {
  if (!projectId) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(CADENCES_COLL)
    .find({ projectId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()) as unknown as CadenceDoc[];
  return docs.map(toTemplate);
}

/** One cadence template by id (scoped to the project), or null. */
export async function getCadenceTemplate(
  projectId: string,
  id: string,
): Promise<CadenceTemplate | null> {
  if (!projectId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(CADENCES_COLL)
    .findOne({ _id: new ObjectId(id), projectId })) as CadenceDoc | null;
  return doc ? toTemplate(doc) : null;
}

/** Enabled templates that target a given object. */
export async function listEnabledCadencesForObject(
  projectId: string,
  objectSlug: string,
): Promise<CadenceTemplate[]> {
  if (!projectId || !objectSlug) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(CADENCES_COLL)
    .find({ projectId, objectSlug, enabled: { $ne: false } })
    .limit(50)
    .toArray()) as unknown as CadenceDoc[];
  return docs.map(toTemplate);
}

/** Insert (no id) or update (valid id) a template; returns the saved shape. */
export async function upsertCadenceTemplate(
  projectId: string,
  input: CadenceTemplateInput,
): Promise<CadenceTemplate> {
  const { db } = await connectToDatabase();
  const now = new Date().toISOString();
  const fields = {
    objectSlug: input.objectSlug,
    name: input.name?.trim() || 'Untitled cadence',
    enabled: input.enabled !== false,
    steps: normalizeSteps(input.steps),
    updatedAt: now,
  };

  if (input.id && ObjectId.isValid(input.id)) {
    await db
      .collection(CADENCES_COLL)
      .updateOne(
        { _id: new ObjectId(input.id), projectId },
        { $set: fields, $setOnInsert: { createdAt: now, projectId } },
        { upsert: true },
      );
    const saved = await getCadenceTemplate(projectId, input.id);
    if (saved) return saved;
  }

  const res = await db
    .collection(CADENCES_COLL)
    .insertOne({ projectId, createdAt: now, ...fields });
  return toTemplate({ _id: res.insertedId, projectId, createdAt: now, ...fields });
}

/** Delete a template by id. Returns true when a doc was removed. */
export async function deleteCadenceTemplate(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!projectId || !ObjectId.isValid(id)) return false;
  const { db } = await connectToDatabase();
  const res = await db
    .collection(CADENCES_COLL)
    .deleteOne({ _id: new ObjectId(id), projectId });
  return res.deletedCount > 0;
}
