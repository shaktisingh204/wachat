import "server-only";

import type { Collection, Db, IndexDescription, ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

import type {
  CrmRecord,
  FieldMetadata,
  ObjectMetadata,
} from "./types";

/* ------------------------------------------------------------------ *
 * Collection names
 *
 * Every SabCRM document is tenant-scoped by `projectId` and (where it
 * represents user-owned state) by `userId`. Persisted documents mirror the
 * shared API shapes from `types.ts` but drop the serialized `id: string`
 * field in favour of Mongo's native `_id: ObjectId`; the `*.server.ts`
 * mappers convert between the two.
 * ------------------------------------------------------------------ */

export const SABCRM_COLLECTIONS = {
  objects: "sabcrm_objects",
  records: "sabcrm_records",
  views: "sabcrm_views",
  activities: "sabcrm_activities",
  favorites: "sabcrm_favorites",
} as const;

/* ------------------------------------------------------------------ *
 * Persisted document shapes (server-only)
 *
 * `Mongo<T>` strips the serialized `id` field and adds `_id` plus the
 * tenant-scoping columns that never round-trip to the client untouched.
 * ------------------------------------------------------------------ */

type WithMongoId = { _id: ObjectId };

/**
 * A persisted custom/overridden object definition for one project.
 *
 * Standard objects live in code (`STANDARD_OBJECTS`); this collection only
 * stores fully-custom objects and per-project customizations (e.g. extra
 * custom fields appended to a standard object).
 */
export type SabcrmObjectDoc = WithMongoId &
  Omit<ObjectMetadata, "fields"> & {
    projectId: string;
    /** All fields, including any custom fields appended to a standard object. */
    fields: FieldMetadata[];
    /** Set when this doc customizes a standard object rather than defining a new one. */
    extendsStandard?: boolean;
    createdAt: string;
    updatedAt: string;
  };

/** A persisted CRM record. */
export type SabcrmRecordDoc = WithMongoId &
  Omit<CrmRecord, "id"> & {
    projectId: string;
  };

/**
 * A persisted saved view (a filtered/sorted presentation of one object).
 *
 * `SavedView` is not part of the shared `types.ts` contract, so the canonical
 * shape is defined here and consumed by `views.server.ts`, which maps `_id`
 * to a serialized `id` for the client.
 */
export type SabcrmViewDoc = WithMongoId & {
  projectId: string;
  /** Owner of a private view; omitted for project-shared views. */
  userId?: string;
  /** Object slug this view belongs to. */
  object: string;
  name: string;
  /** Presentation mode. */
  kind: "table" | "board";
  /** Field key -> value filters. */
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  /** Ordered field keys shown as columns / card fields. */
  fields?: string[];
  /** SELECT field used to group a board view into columns. */
  groupByField?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * A persisted timeline activity attached to a record (note / task / comment /
 * call / meeting / email).
 *
 * Not part of the shared `types.ts` contract; canonical shape defined here and
 * consumed by `activities.server.ts`.
 */
export type SabcrmActivityDoc = WithMongoId & {
  projectId: string;
  /**
   * Timeline entry kind. NOTE/TASK/CALL/MEETING/EMAIL log the standard CRM
   * interaction set; COMMENT is a free-form reply. Stored verbatim so the set
   * is forward-compatible.
   */
  type: "NOTE" | "TASK" | "CALL" | "MEETING" | "EMAIL" | "COMMENT";
  /** Short title / subject line. */
  title: string;
  body: string;
  /** Object slug of the record this activity is attached to. */
  targetObject: string;
  /** Serialized id of the record this activity is attached to. */
  targetRecordId: string;
  /** Author user id. */
  authorId: string;
  /**
   * SabFiles attachments (refs into the user's SabFiles library — never raw
   * external URLs). Optional for backwards compatibility with rows written
   * before attachments existed; the runtime normalises a missing value to `[]`.
   */
  attachments?: Array<{
    fileId: string;
    name: string;
    contentType?: string;
    size?: number;
    url?: string;
  }>;
  /** @-mentions resolved against workspace members. Optional (see attachments). */
  mentions?: Array<{ userId: string; displayName?: string }>;
  /** TASK-only: workflow status. */
  status?: "TODO" | "IN_PROGRESS" | "DONE";
  /** TASK-only: assignee user id. */
  assigneeId?: string;
  /** TASK-only: due date. */
  dueAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A persisted favorite / pinned record for one user within a project.
 *
 * Not part of the shared `types.ts` contract; canonical shape defined here.
 */
export type SabcrmFavoriteDoc = WithMongoId & {
  projectId: string;
  userId: string;
  /** Object slug of the favorited record. */
  object: string;
  /** Serialized id of the favorited record. */
  recordId: string;
  createdAt: string;
};

/* ------------------------------------------------------------------ *
 * Typed collection accessors
 * ------------------------------------------------------------------ */

async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export async function sabcrmObjects(): Promise<Collection<SabcrmObjectDoc>> {
  const db = await getDb();
  return db.collection<SabcrmObjectDoc>(SABCRM_COLLECTIONS.objects);
}

export async function sabcrmRecords(): Promise<Collection<SabcrmRecordDoc>> {
  const db = await getDb();
  return db.collection<SabcrmRecordDoc>(SABCRM_COLLECTIONS.records);
}

export async function sabcrmViews(): Promise<Collection<SabcrmViewDoc>> {
  const db = await getDb();
  return db.collection<SabcrmViewDoc>(SABCRM_COLLECTIONS.views);
}

export async function sabcrmActivities(): Promise<Collection<SabcrmActivityDoc>> {
  const db = await getDb();
  return db.collection<SabcrmActivityDoc>(SABCRM_COLLECTIONS.activities);
}

export async function sabcrmFavorites(): Promise<Collection<SabcrmFavoriteDoc>> {
  const db = await getDb();
  return db.collection<SabcrmFavoriteDoc>(SABCRM_COLLECTIONS.favorites);
}

/* ------------------------------------------------------------------ *
 * Index management
 *
 * Idempotent — runs once per process. Every index leads with `projectId`
 * so all reads are tenant-scoped and covered.
 * ------------------------------------------------------------------ */

let indexesEnsured = false;

export async function ensureSabcrmIndexes(): Promise<void> {
  if (indexesEnsured) return;

  const [objects, records, views, activities, favorites] = await Promise.all([
    sabcrmObjects(),
    sabcrmRecords(),
    sabcrmViews(),
    sabcrmActivities(),
    sabcrmFavorites(),
  ]);

  await Promise.all([
    objects.createIndexes([
      { key: { projectId: 1, slug: 1 }, unique: true },
      { key: { projectId: 1, updatedAt: -1 } },
    ] as IndexDescription[]),

    records.createIndexes([
      { key: { projectId: 1, object: 1, updatedAt: -1 } },
      { key: { projectId: 1, object: 1, createdAt: -1 } },
      { key: { projectId: 1, createdBy: 1 } },
    ] as IndexDescription[]),

    views.createIndexes([
      { key: { projectId: 1, object: 1, name: 1 } },
      { key: { projectId: 1, object: 1, isDefault: 1 } },
      { key: { projectId: 1, userId: 1 } },
    ] as IndexDescription[]),

    activities.createIndexes([
      {
        key: {
          projectId: 1,
          targetObject: 1,
          targetRecordId: 1,
          createdAt: -1,
        },
      },
      { key: { projectId: 1, type: 1, status: 1, assigneeId: 1, dueAt: 1 } },
    ] as IndexDescription[]),

    favorites.createIndexes([
      {
        key: { projectId: 1, userId: 1, object: 1, recordId: 1 },
        unique: true,
      },
      { key: { projectId: 1, userId: 1, createdAt: -1 } },
    ] as IndexDescription[]),
  ]);

  indexesEnsured = true;
}
