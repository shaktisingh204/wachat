/**
 * WaChat completion campaign — canned-messages backfill.
 *
 *   npx tsx scripts/wachat/backfill/canned-messages.ts            # dry-run (default)
 *   npx tsx scripts/wachat/backfill/canned-messages.ts --apply    # actually write
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SCRIPT EXISTS
 * ---------------------------------------------------------------------------
 * The legacy native-Mongo path (`src/app/actions/project.actions.ts` →
 * `saveCannedMessageAction` / `getCannedMessages`) stored canned replies in the
 * `canned_messages` collection, scoped by `projectId` only, with
 * `createdBy = session.user.name` (a display name string).
 *
 * That path has been REPLACED by the `wachat-canned-messages` Rust crate
 * (mounted at `/v1/wachat/canned-messages`, see
 * `rust/crates/wachat-canned-messages/src/handlers.rs`). The crate owns a NEW
 * collection `wa_canned_messages`, scoped by BOTH `userId` (ObjectId) AND
 * `projectId` (ObjectId), with:
 *   - `userId`     : ObjectId  (NEW — resolved from the project's owner)
 *   - `createdBy`  : string    (NOW the userId hex, not the display name)
 *   - `updatedAt`  : Date      (NEW)
 *
 * The new read path (`getCannedMessages` in
 * `src/app/actions/wachat-canned-messages.actions.ts`) filters on
 * `{ userId, projectId }`, so any row left behind in `canned_messages` is
 * INVISIBLE to users until copied into `wa_canned_messages` with the right
 * `userId`. This script performs that copy/transform.
 *
 * ---------------------------------------------------------------------------
 * SHAPE MAPPING  (legacy `canned_messages`  →  new `wa_canned_messages`)
 * ---------------------------------------------------------------------------
 *   _id          ObjectId   →   _id          ObjectId   (PRESERVED — natural key)
 *   projectId    ObjectId   →   projectId    ObjectId   (copied as-is)
 *   (none)                  →   userId       ObjectId   (resolved: projects.userId)
 *   name         string     →   name         string
 *   type         string     →   type         string
 *   content      { text? | mediaUrl?, caption?, fileName? }  →  content  (copied)
 *   isFavourite  boolean    →   isFavourite  boolean    (defaults false if absent)
 *   createdBy    string     →   createdBy    string     (REWRITTEN to userId hex)
 *   createdAt    Date       →   createdAt    Date       (preserved; defaults now)
 *   (none)                  →   updatedAt    Date       (= createdAt, or now)
 *
 * We PRESERVE the original `_id`. This is what makes the script idempotent and
 * safe to re-run: a row is considered "already migrated" iff a doc with the
 * same `_id` already exists in `wa_canned_messages`. Re-running never creates
 * duplicates and never overwrites a row the crate has since edited.
 *
 * ---------------------------------------------------------------------------
 * SKIP / WARNING CASES (logged, never written)
 * ---------------------------------------------------------------------------
 *   - project not found for a legacy row's projectId  → orphan, skipped
 *   - project has no `userId`                          → cannot scope, skipped
 *   - row already present in wa_canned_messages by _id → already migrated, skipped
 *
 * Requires: MONGODB_URI and MONGODB_DB (loaded from `.env` below, or export
 * them before running). Read-only unless `--apply` is passed.
 */

import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Load .env the same way scripts/wachat-index-and-dedup-migration.js does, so
// connectToDatabase() finds MONGODB_URI / MONGODB_DB when run standalone.
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

import { ObjectId, type Document } from 'mongodb';
import { connectToDatabase } from '../../../src/lib/mongodb';

const LOG = '[BACKFILL canned-messages]';
const APPLY = process.argv.includes('--apply');

const LEGACY_COLL = 'canned_messages';
const NEW_COLL = 'wa_canned_messages';

interface LegacyCanned extends Document {
  _id: ObjectId;
  projectId?: ObjectId | string;
  name?: string;
  type?: string;
  content?: {
    text?: string;
    mediaUrl?: string;
    caption?: string;
    fileName?: string;
  };
  isFavourite?: boolean;
  createdBy?: string;
  createdAt?: Date;
}

/** Coerce a projectId that may be stored as ObjectId or string. */
function toObjectId(v: ObjectId | string | undefined): ObjectId | null {
  if (!v) return null;
  if (v instanceof ObjectId) return v;
  if (typeof v === 'string' && ObjectId.isValid(v)) return new ObjectId(v);
  return null;
}

/** Build the clean `content` sub-document the crate expects for this type. */
function buildContent(row: LegacyCanned): Record<string, string> {
  const c = row.content ?? {};
  const content: Record<string, string> = {};
  if (row.type === 'text') {
    if (c.text) content.text = c.text;
  } else {
    if (c.mediaUrl) content.mediaUrl = c.mediaUrl;
    if (c.caption) content.caption = c.caption;
    if (c.fileName) content.fileName = c.fileName;
  }
  return content;
}

async function main() {
  console.log(`${LOG} Starting ${APPLY ? 'APPLY' : 'DRY-RUN'} migration...`);

  const { client, db } = await connectToDatabase();
  console.log(`${LOG} Connected to ${process.env.MONGODB_DB}.`);

  try {
    const legacyColl = db.collection<LegacyCanned>(LEGACY_COLL);
    const newColl = db.collection<Document>(NEW_COLL);

    const total = await legacyColl.countDocuments({});
    console.log(`${LOG} Legacy ${LEGACY_COLL} rows: ${total}`);
    if (total === 0) {
      console.log(`${LOG} Nothing to migrate.`);
      return;
    }

    // Cache projectId(hex) -> userId(ObjectId) so we don't hit `projects` once
    // per row. null means "looked up, no usable owner".
    const ownerCache = new Map<string, ObjectId | null>();
    const projectsColl = db.collection<Document>('projects');

    async function resolveUserId(projectId: ObjectId): Promise<ObjectId | null> {
      const key = projectId.toHexString();
      if (ownerCache.has(key)) return ownerCache.get(key) ?? null;
      const project = await projectsColl.findOne(
        { _id: projectId },
        { projection: { userId: 1 } },
      );
      const owner = toObjectId(project?.userId as ObjectId | string | undefined);
      ownerCache.set(key, owner);
      return owner;
    }

    let migrated = 0;
    let alreadyMigrated = 0;
    let orphanNoProject = 0;
    let orphanNoOwner = 0;

    const cursor = legacyColl.find({});
    for await (const row of cursor) {
      const projectId = toObjectId(row.projectId);
      if (!projectId) {
        orphanNoProject++;
        console.warn(`${LOG}   SKIP _id=${row._id} — missing/invalid projectId`);
        continue;
      }

      // Idempotency: skip if a row with this _id already exists in the new coll.
      const existing = await newColl.findOne(
        { _id: row._id as unknown as ObjectId },
        { projection: { _id: 1 } },
      );
      if (existing) {
        alreadyMigrated++;
        continue;
      }

      const userId = await resolveUserId(projectId);
      if (!userId) {
        // Either the project was deleted or it has no owner — we cannot apply
        // the new userId scoping, so the row would be unreadable anyway.
        const project = ownerCache.get(projectId.toHexString());
        if (project === null) {
          // distinguish: was the project found at all?
          const exists = await projectsColl.countDocuments({ _id: projectId }, { limit: 1 });
          if (exists === 0) {
            orphanNoProject++;
            console.warn(`${LOG}   SKIP _id=${row._id} — project ${projectId.toHexString()} not found`);
          } else {
            orphanNoOwner++;
            console.warn(`${LOG}   SKIP _id=${row._id} — project ${projectId.toHexString()} has no userId`);
          }
        }
        continue;
      }

      const createdAt = row.createdAt instanceof Date ? row.createdAt : new Date();
      const newDoc: Document = {
        _id: row._id,
        userId,
        projectId,
        name: (row.name ?? '').trim(),
        type: row.type ?? 'text',
        content: buildContent(row),
        isFavourite: row.isFavourite === true,
        createdBy: userId.toHexString(), // crate stores the userId hex string here
        createdAt,
        updatedAt: createdAt,
      };

      if (APPLY) {
        // Guard against a racing concurrent insert with the same _id.
        await newColl.updateOne(
          { _id: row._id as unknown as ObjectId },
          { $setOnInsert: newDoc },
          { upsert: true },
        );
      } else {
        console.log(
          `${LOG}   WOULD COPY _id=${row._id} project=${projectId.toHexString()} ` +
          `user=${userId.toHexString()} name="${newDoc.name}" type=${newDoc.type}`,
        );
      }
      migrated++;
    }

    console.log(`\n${LOG} ${APPLY ? 'Migrated' : 'Would migrate'}: ${migrated}`);
    console.log(`${LOG} Already migrated (skipped): ${alreadyMigrated}`);
    console.log(`${LOG} Orphan — project not found: ${orphanNoProject}`);
    console.log(`${LOG} Orphan — project has no userId: ${orphanNoOwner}`);
    if (!APPLY) {
      console.log(`\n${LOG} DRY-RUN complete. Re-run with --apply to write.`);
    } else {
      console.log(`\n${LOG} APPLY complete.`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(`${LOG} FAILED:`, err);
  process.exitCode = 1;
});
