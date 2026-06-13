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
  reports: "sabcrm_reports",
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
 * A persisted saved report definition.
 *
 * A "report" stores the *definition* of an analytics query (which object,
 * which metric, how to group/filter/chart) independently from its data.
 * Calling `runReport` executes the aggregation against `sabcrm_records`
 * and returns a time-series or breakdown data series.
 *
 * Not part of the shared `types.ts` contract; canonical shape defined here
 * and consumed by `reports.server.ts`.
 */
export type SabcrmReportDoc = WithMongoId & {
  projectId: string;
  /** Display name shown in the reports list. */
  name: string;
  /** Optional description. */
  description?: string;
  /**
   * Object slug this report runs against (e.g. `opportunities`, `companies`).
   * Must resolve to a real object in the project at run time.
   */
  object: string;
  /**
   * The metric to compute.
   * - `count`  — number of records matching the filters (no metricField needed).
   * - `sum`    — sum of a NUMBER / CURRENCY field value.
   * - `avg`    — average of a NUMBER / CURRENCY field value.
   * - `min`    — minimum value.
   * - `max`    — maximum value.
   */
  metric: "count" | "sum" | "avg" | "min" | "max";
  /**
   * Field key to aggregate. Required for `sum`/`avg`/`min`/`max`.
   * Must be a NUMBER or CURRENCY field on the object.
   */
  metricField?: string;
  /**
   * Optional field key to group results by before computing the metric.
   * Groupable types: SELECT, BOOLEAN, DATE (bucketed by day), DATE_TIME
   * (bucketed by day). When omitted the report returns a single-row result.
   */
  groupByField?: string;
  /**
   * Optional time-series granularity applied to a DATE / DATE_TIME `groupByField`.
   * When the `groupByField` is a date field, this controls the bucket size.
   * Ignored for non-date group-by fields.
   */
  timeBucket?: "day" | "week" | "month" | "quarter" | "year";
  /**
   * Persisted exact-match filters applied before the aggregation
   * (equivalent to `RecordQuery.filters`). Field key → exact value.
   */
  filters?: Record<string, unknown>;
  /**
   * Preferred chart type for the UI to render. The server computes the same
   * data series regardless; this is purely a display hint stored alongside
   * the definition.
   */
  chartType?: "bar" | "line" | "pie" | "number" | "table" | "funnel";
  /** Report kind — standard | funnel | velocity | pivot | cohort. */
  kind?: "standard" | "funnel" | "velocity" | "pivot" | "cohort";
  /** Pipeline driving a funnel / velocity report. */
  pipelineId?: string;
  /** Pivot: column group-by field (row field = groupByField). */
  pivotColField?: string;
  /** Cohort: the date field whose period forms the cohort rows. */
  cohortDateField?: string;
  /** Cohort: period granularity. */
  cohortInterval?: "day" | "week" | "month" | "quarter" | "year";
  /** User id of the report owner (creator). */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

export async function sabcrmReports(): Promise<Collection<SabcrmReportDoc>> {
  const db = await getDb();
  return db.collection<SabcrmReportDoc>(SABCRM_COLLECTIONS.reports);
}

/* ------------------------------------------------------------------ *
 * Index management
 *
 * Idempotent — runs once per process. Every index leads with `projectId`
 * so all reads are tenant-scoped and covered.
 *
 * Index rationale (additive annotations):
 *
 * sabcrm_records
 * ──────────────
 * • {projectId,object,updatedAt}  — primary list query, newest-first sort.
 * • {projectId,object,createdAt}  — list + picker sort by insertion order.
 * • {projectId,createdBy}         — owner-scoped audits / filtering.
 * • {projectId,object}            — covered entry-point for groupRecords /
 *                                   searchRecordsForPicker when sort is
 *                                   pushed to a covered $sort stage.
 *   (Note: the two compound indexes above already cover this access pattern
 *    via index prefix, so no separate two-key index is needed.)
 * • {projectId,"data.assigneeId",updatedAt}
 *                                 — listMyAssignments: filter by assignee,
 *                                   sort by updatedAt, optionally narrow by
 *                                   object (handled in-memory after fetch).
 * • Wildcard on data.*            — covers projectId+object+data.<any key>
 *                                   queries such as RELATION back-references
 *                                   (listRelatedRecords: data.<fieldKey>=id),
 *                                   ONE_TO_MANY inverse scans, and typed
 *                                   filter conditions (eq/in/isEmpty …).
 *                                   Mongo's $** wildcard index handles all
 *                                   `data.*` paths without enumerating every
 *                                   field key at index-creation time.
 * • Text index on data.*          — powers the free-text `search` branch of
 *                                   buildFilter (regex fallback is kept as a
 *                                   code-level alternative; the text index
 *                                   accelerates it when the query planner
 *                                   selects it).  Only one $text index is
 *                                   allowed per collection; it is created
 *                                   with a wildcard to cover every TEXT /
 *                                   EMAIL / PHONE / LINK value regardless of
 *                                   the object's runtime field set.
 *
 * sabcrm_activities
 * ─────────────────
 * • {projectId,targetObject,targetRecordId,createdAt}
 *                                 — timeline reads (listActivities).
 * • {projectId,type,status,assigneeId,dueAt}
 *                                 — task-list queries (type=TASK, status,
 *                                   assignee, due-date range).
 * • {projectId,assigneeId,dueAt}  — "my tasks" dashboard: all TASK-type
 *                                   activities assigned to a user sorted by
 *                                   due date, across all records.
 * • {projectId,targetObject,createdAt}
 *                                 — list all activities for an object type
 *                                   (e.g. "all notes on companies") without
 *                                   a specific targetRecordId.
 * ------------------------------------------------------------------ */

let indexesEnsured = false;

export async function ensureSabcrmIndexes(): Promise<void> {
  if (indexesEnsured) return;

  const [objects, records, views, activities, favorites, reports] = await Promise.all([
    sabcrmObjects(),
    sabcrmRecords(),
    sabcrmViews(),
    sabcrmActivities(),
    sabcrmFavorites(),
    sabcrmReports(),
  ]);

  await Promise.all([
    // ── sabcrm_objects ──────────────────────────────────────────────────────
    objects.createIndexes([
      // Unique slug per project — primary lookup + uniqueness backstop.
      { key: { projectId: 1, slug: 1 }, unique: true },
      // Catalogue list sorted by last modification.
      { key: { projectId: 1, updatedAt: -1 } },
    ] as IndexDescription[]),

    // ── sabcrm_records ──────────────────────────────────────────────────────
    records.createIndexes([
      // Primary list queries: tenant + object, newest-updated first.
      { key: { projectId: 1, object: 1, updatedAt: -1 } },
      // Picker + insertion-order sorts.
      { key: { projectId: 1, object: 1, createdAt: -1 } },
      // Owner-scoped audits.
      { key: { projectId: 1, createdBy: 1 } },
      // listMyAssignments: assignee filter + sort by updatedAt, any object.
      { key: { projectId: 1, "data.assigneeId": 1, updatedAt: -1 } },
      // listMyAssignments narrowed to one object slug.
      { key: { projectId: 1, "data.assigneeId": 1, object: 1, updatedAt: -1 } },
      // RELATION back-reference queries (listRelatedRecords / ONE_TO_MANY
      // inverse scans): covers data.<any field key> path for the most common
      // relation field names on standard objects.
      { key: { projectId: 1, object: 1, "data.companyId": 1 } },
      { key: { projectId: 1, object: 1, "data.personId": 1 } },
      { key: { projectId: 1, object: 1, "data.opportunityId": 1 } },
      // Wildcard index on the data sub-document so every runtime-defined
      // RELATION field (and typed filter conditions) is indexed without
      // enumerating field keys at index-creation time.
      // The wildcardProjection restricts the wildcard to the `data` field
      // to avoid indexing large system fields and to keep the index compact.
      {
        key: { "data.$**": 1 } as Record<string, unknown>,
        wildcardProjection: { data: 1 } as Record<string, unknown>,
      } as IndexDescription,
      // $text index for the free-text search branch of buildFilter.
      // One text index per collection; wildcard covers all data.* paths.
      {
        key: { "$**": "text" } as Record<string, unknown>,
        weights: { "data.$**": 2 } as Record<string, unknown>,
        default_language: "none",
      } as IndexDescription,
    ] as IndexDescription[]),

    // ── sabcrm_views ────────────────────────────────────────────────────────
    views.createIndexes([
      { key: { projectId: 1, object: 1, name: 1 } },
      { key: { projectId: 1, object: 1, isDefault: 1 } },
      { key: { projectId: 1, userId: 1 } },
    ] as IndexDescription[]),

    // ── sabcrm_activities ────────────────────────────────────────────────────
    activities.createIndexes([
      // Timeline reads for a specific record (primary access pattern).
      {
        key: {
          projectId: 1,
          targetObject: 1,
          targetRecordId: 1,
          createdAt: -1,
        },
      },
      // Task-list queries: type + status + assignee + due-date range.
      { key: { projectId: 1, type: 1, status: 1, assigneeId: 1, dueAt: 1 } },
      // "My tasks" dashboard: assignee across all records, sorted by due date.
      { key: { projectId: 1, assigneeId: 1, dueAt: 1 } },
      // Activities for a whole object type without a specific record id
      // (e.g. "all notes logged against any company").
      { key: { projectId: 1, targetObject: 1, createdAt: -1 } },
    ] as IndexDescription[]),

    // ── sabcrm_favorites ────────────────────────────────────────────────────
    favorites.createIndexes([
      {
        key: { projectId: 1, userId: 1, object: 1, recordId: 1 },
        unique: true,
      },
      { key: { projectId: 1, userId: 1, createdAt: -1 } },
    ] as IndexDescription[]),

    // ── sabcrm_reports ──────────────────────────────────────────────────────
    reports.createIndexes([
      // Primary list: tenant + newest-first.
      { key: { projectId: 1, updatedAt: -1 } },
      // Filter by object slug (reports dashboard per-object view).
      { key: { projectId: 1, object: 1, updatedAt: -1 } },
      // Owner-scoped look-up for "my reports".
      { key: { projectId: 1, createdBy: 1, updatedAt: -1 } },
    ] as IndexDescription[]),
  ]);

  indexesEnsured = true;
}
