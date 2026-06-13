import "server-only";

/**
 * SabCRM — saved reports runtime (server-only).
 *
 * A "report" is a persisted analytics query definition scoped to one project
 * (tenant). It stores *what* to compute — object, metric, groupBy, filters,
 * chartType — without storing the result. Calling {@link runReport} executes
 * the aggregation live against `sabcrm_records` and returns a typed data
 * series that the client charts directly.
 *
 * ## Design contracts
 *
 * - **Tenant-scoped**: every read and write is filtered by `projectId`.
 * - **Immutable metric computation**: the analytics pipeline runs at query
 *   time; report definitions store only parameters, never cached results.
 * - **No `any`**: all collection operations cast through `Record<string,
 *   unknown>` at the Mongo boundary (consistent with every other server
 *   module in this lib).
 * - **server-only**: this module must never be imported from client code.
 *
 * ## Data-series contract
 *
 * Every chart type receives the same {@link ReportDataSeries} shape.  The
 * interpretation is:
 *
 *   - **Single-value** (`chartType: 'number'` or no `groupByField`): one row
 *     where `key === '__total__'`.
 *   - **Breakdown** (`groupByField` on a SELECT/BOOLEAN field): one row per
 *     distinct value.
 *   - **Time-series** (`groupByField` on a DATE/DATE_TIME field): one row per
 *     time bucket, key is an ISO date string of the bucket start.
 */

import { ObjectId, type Filter } from "mongodb";
import { sabcrmRecords, sabcrmReports, type SabcrmReportDoc } from "./db";
import { getObject } from "./objects.server";
import type { ObjectMetadata } from "./types";
import {
  sabcrmPipelinesApi,
  type SabcrmRustPipeline,
  type SabcrmRustPipelineStage,
} from "@/lib/rust-client/sabcrm-pipelines";

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

/** The metric an analytics query computes. */
export type ReportMetric = "count" | "sum" | "avg" | "min" | "max";

/** Preferred chart surface — stored with the definition, used by the UI only. */
export type ReportChartType =
  | "bar"
  | "line"
  | "pie"
  | "number"
  | "table"
  | "funnel";

/** Time bucket granularity for DATE / DATE_TIME group-by fields. */
export type ReportTimeBucket = "day" | "week" | "month" | "quarter" | "year";

/**
 * Report kind. `standard` is the legacy metric × group-by report (default when
 * absent). `funnel` + `velocity` are pipeline-driven sales analytics.
 */
export type ReportKind =
  | "standard"
  | "funnel"
  | "velocity"
  | "pivot"
  | "cohort";

/** A matrix result (pivot cross-tab or cohort grid). */
export interface ReportMatrix {
  /** Row header labels (top→bottom). */
  rowKeys: string[];
  /** Column header labels (left→right). */
  colKeys: string[];
  /** `cells[r][c]` — the value at row r, column c. */
  cells: number[][];
  /** Per-row totals (optional; pivot). */
  rowTotals?: number[];
  /** Per-column totals (optional; pivot). */
  colTotals?: number[];
}

/** Headline numbers for funnel / velocity reports (carried beside `rows`). */
export interface ReportSeriesMeta {
  /** Won / (won + lost), 0–1. */
  winRate?: number;
  /** Deals classified as won within scope. */
  wonCount?: number;
  /** Mean won-deal amount. */
  avgDealSize?: number;
  /** Mean days from `createdAt` → `closeDate` for won deals. */
  avgCycleDays?: number;
  /** Sales velocity: (deals × avgDealSize × winRate) / max(avgCycleDays, 1). */
  velocityPerDay?: number;
}

/**
 * A saved report definition in its serialisable API shape.
 * `_id` is always a hex string; `projectId` is included so the client can
 * use it for subsequent action calls without maintaining its own lookup.
 */
export interface SavedReport {
  _id: string;
  projectId: string;
  name: string;
  description?: string;
  /** Object slug the report runs against. */
  object: string;
  metric: ReportMetric;
  /** Field key for sum/avg/min/max metrics. */
  metricField?: string;
  /** Field key to group by before computing the metric. */
  groupByField?: string;
  /** Time-bucket granularity when `groupByField` is a date field. */
  timeBucket?: ReportTimeBucket;
  /** Exact-match filters applied before the aggregation. */
  filters?: Record<string, unknown>;
  chartType?: ReportChartType;
  /** Report kind. Absent / "standard" = the legacy metric report. */
  kind?: ReportKind;
  /** Pipeline whose ordered stages drive a funnel / velocity report. */
  pipelineId?: string;
  /** Pivot: the second (column) group-by field. Row field is `groupByField`. */
  pivotColField?: string;
  /** Cohort: the date field whose period forms the cohort rows. */
  cohortDateField?: string;
  /** Cohort: the period granularity for cohort rows + columns. */
  cohortInterval?: ReportTimeBucket;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Input accepted by {@link createReport}. All required fields are explicit. */
export interface CreateReportInput {
  name: string;
  description?: string;
  object: string;
  metric: ReportMetric;
  metricField?: string;
  groupByField?: string;
  timeBucket?: ReportTimeBucket;
  filters?: Record<string, unknown>;
  chartType?: ReportChartType;
  kind?: ReportKind;
  pipelineId?: string;
  /** Pivot: the second (column) group-by field. Row field is `groupByField`. */
  pivotColField?: string;
  /** Cohort: the date field whose period forms the cohort rows. */
  cohortDateField?: string;
  /** Cohort: the period granularity for cohort rows + columns. */
  cohortInterval?: ReportTimeBucket;
}

/** Fields that may be updated by {@link updateReport}. */
export interface UpdateReportPatch {
  name?: string;
  description?: string;
  metric?: ReportMetric;
  metricField?: string;
  groupByField?: string;
  timeBucket?: ReportTimeBucket;
  filters?: Record<string, unknown>;
  chartType?: ReportChartType;
  kind?: ReportKind;
  pipelineId?: string;
  /** Pivot: the second (column) group-by field. Row field is `groupByField`. */
  pivotColField?: string;
  /** Cohort: the date field whose period forms the cohort rows. */
  cohortDateField?: string;
  /** Cohort: the period granularity for cohort rows + columns. */
  cohortInterval?: ReportTimeBucket;
}

/** One row in an analytics data series. */
export interface ReportDataPoint {
  /**
   * The group-by bucket key.
   * - `'__total__'` for un-grouped (single-value) reports.
   * - ISO date string (YYYY-MM-DD or YYYY-MM for month/year) for time-series.
   * - SELECT option value / boolean string for breakdown reports.
   */
  key: string;
  /** Human-readable label for the bucket (may equal `key`). */
  label: string;
  /** The computed metric value for this bucket. */
  value: number;
  /** Optional colour hint from the field's SELECT options (hex or CSS token). */
  color?: string;
}

/** The analytics result returned by {@link runReport}. */
export interface ReportDataSeries {
  /** Matches the report definition's `metric`. */
  metric: ReportMetric;
  /** Matches the report definition's `groupByField` (undefined = single-value). */
  groupByField?: string;
  /** Matches the report definition's `timeBucket` when date grouping. */
  timeBucket?: ReportTimeBucket;
  /** The computed rows, in the order dictated by the group-by strategy. */
  rows: ReportDataPoint[];
  /** Total number of source records that matched the filters. */
  recordCount: number;
  /** ISO timestamp of when this series was computed. */
  computedAt: string;
  /** Headline numbers for funnel / velocity reports (absent for standard). */
  meta?: ReportSeriesMeta;
  /** Cross-tab grid for pivot / cohort reports (absent otherwise). */
  matrix?: ReportMatrix;
}

/* -------------------------------------------------------------------------- */
/* Sentinel key for ungrouped / single-value reports                          */
/* -------------------------------------------------------------------------- */

const TOTAL_KEY = "__total__";

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

const VALID_METRICS: ReadonlySet<string> = new Set<ReportMetric>([
  "count",
  "sum",
  "avg",
  "min",
  "max",
]);

const VALID_CHART_TYPES: ReadonlySet<string> = new Set<ReportChartType>([
  "bar",
  "line",
  "pie",
  "number",
  "table",
  "funnel",
]);

const VALID_TIME_BUCKETS: ReadonlySet<string> = new Set<ReportTimeBucket>([
  "day",
  "week",
  "month",
  "quarter",
  "year",
]);

function isValidMetric(v: unknown): v is ReportMetric {
  return typeof v === "string" && VALID_METRICS.has(v);
}

function isValidChartType(v: unknown): v is ReportChartType {
  return typeof v === "string" && VALID_CHART_TYPES.has(v);
}

function isValidTimeBucket(v: unknown): v is ReportTimeBucket {
  return typeof v === "string" && VALID_TIME_BUCKETS.has(v);
}

/**
 * Returns `true` when `value` is a non-empty string usable as a field key
 * (same pattern as objects.server.ts `isValidFieldKey`, minus reserved-key
 * check — the report layer does not write to record data, only reads it).
 */
function isFieldKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-zA-Z0-9_]*$/.test(value);
}

/**
 * Validates a {@link CreateReportInput} (or the subset supplied to
 * {@link updateReport}) and returns a human-readable error string, or
 * `undefined` when the input is valid.
 */
function validateReportInput(
  input: Partial<CreateReportInput>,
  opts: { requireName: boolean },
): string | undefined {
  if (opts.requireName) {
    const name = input.name?.trim();
    if (!name) return "Report name is required.";
  } else if (input.name !== undefined && !input.name.trim()) {
    return "Report name cannot be empty.";
  }

  if (input.object !== undefined && !input.object.trim()) {
    return "Object slug is required.";
  }

  if (input.metric !== undefined && !isValidMetric(input.metric)) {
    return `Invalid metric "${String(input.metric)}". Must be one of: count, sum, avg, min, max.`;
  }

  if (input.metric && input.metric !== "count") {
    if (!isFieldKey(input.metricField)) {
      return `metricField is required for "${input.metric}" metric and must be a valid field key.`;
    }
  }

  if (
    input.groupByField !== undefined &&
    input.groupByField !== null &&
    !isFieldKey(input.groupByField)
  ) {
    return "groupByField must be a valid field key.";
  }

  if (
    input.timeBucket !== undefined &&
    !isValidTimeBucket(input.timeBucket)
  ) {
    return `Invalid timeBucket "${String(input.timeBucket)}". Must be one of: day, week, month, quarter, year.`;
  }

  if (
    input.chartType !== undefined &&
    !isValidChartType(input.chartType)
  ) {
    return `Invalid chartType "${String(input.chartType)}". Must be one of: bar, line, pie, number, table.`;
  }

  if (
    input.filters !== undefined &&
    (typeof input.filters !== "object" ||
      input.filters === null ||
      Array.isArray(input.filters))
  ) {
    return "filters must be a plain object of field-key → value pairs.";
  }

  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                               */
/* -------------------------------------------------------------------------- */

function docToReport(doc: SabcrmReportDoc): SavedReport {
  return {
    _id: doc._id.toHexString(),
    projectId: doc.projectId,
    name: doc.name,
    description: doc.description,
    object: doc.object,
    metric: doc.metric,
    metricField: doc.metricField,
    groupByField: doc.groupByField,
    timeBucket: doc.timeBucket,
    filters: doc.filters,
    chartType: doc.chartType,
    kind: doc.kind,
    pipelineId: doc.pipelineId,
    pivotColField: doc.pivotColField,
    cohortDateField: doc.cohortDateField,
    cohortInterval: doc.cohortInterval,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Lists all saved reports for a project, newest first.
 *
 * Optionally filtered by `object` slug when the caller wants to show
 * only reports relevant to one object (e.g. from the object list view).
 */
export async function listReports(
  projectId: string,
  opts?: { object?: string },
): Promise<SavedReport[]> {
  const col = await sabcrmReports();
  const filter: Record<string, unknown> = { projectId };
  if (opts?.object) filter.object = opts.object;

  const docs = await col
    .find(filter as Filter<SabcrmReportDoc>)
    .sort({ updatedAt: -1 })
    .toArray();

  return docs.map(docToReport);
}

/**
 * Fetches a single saved report by id, scoped to the project.
 * Returns `null` when the id is malformed or the report does not exist.
 */
export async function getReport(
  projectId: string,
  id: string,
): Promise<SavedReport | null> {
  if (!ObjectId.isValid(id)) return null;

  const col = await sabcrmReports();
  const doc = await col.findOne({
    _id: new ObjectId(id),
    projectId,
  } as Filter<SabcrmReportDoc>);

  return doc ? docToReport(doc) : null;
}

/**
 * Creates and persists a new report definition for the project.
 *
 * @throws {Error} for invalid input or when the object does not exist in the
 *   project.
 */
export async function createReport(
  projectId: string,
  createdBy: string,
  input: CreateReportInput,
): Promise<SavedReport> {
  const validationError = validateReportInput(input, { requireName: true });
  if (validationError) throw new Error(validationError);

  // Confirm the target object exists for this project.
  const object = await getObject(projectId, input.object);
  if (!object) {
    throw new Error(`Unknown SabCRM object: "${input.object}".`);
  }

  // Validate metricField resolves to a real field on the object.
  if (input.metric !== "count" && input.metricField) {
    assertNumericField(object, input.metricField);
  }

  // Validate groupByField resolves to a field on the object.
  if (input.groupByField) {
    assertGroupableField(object, input.groupByField);
  }

  const now = new Date().toISOString();
  const doc: Omit<SabcrmReportDoc, "_id"> = {
    projectId,
    name: input.name.trim(),
    description: input.description?.trim(),
    object: input.object,
    metric: input.metric,
    metricField: input.metric !== "count" ? input.metricField : undefined,
    groupByField: input.groupByField ?? undefined,
    timeBucket: input.timeBucket ?? undefined,
    filters: input.filters ?? undefined,
    chartType: input.chartType ?? undefined,
    kind: input.kind ?? undefined,
    pipelineId: input.pipelineId ?? undefined,
    pivotColField: input.pivotColField ?? undefined,
    cohortDateField: input.cohortDateField ?? undefined,
    cohortInterval: input.cohortInterval ?? undefined,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const col = await sabcrmReports();
  const result = await col.insertOne(
    doc as unknown as Parameters<typeof col.insertOne>[0],
  );

  return docToReport({ ...doc, _id: result.insertedId } as SabcrmReportDoc);
}

/**
 * Applies a partial patch to an existing report definition.
 * The `object` field is intentionally not patchable — changing the object
 * would invalidate `metricField` and `groupByField`; callers should delete
 * and re-create instead.
 *
 * Returns the updated report, or `null` if the id is malformed / not found.
 *
 * @throws {Error} for invalid patch values or when the patched field keys do
 *   not resolve to fields on the existing object.
 */
export async function updateReport(
  projectId: string,
  id: string,
  patch: UpdateReportPatch,
): Promise<SavedReport | null> {
  if (!ObjectId.isValid(id)) return null;

  // Validate the patch fields that are present.
  const validationError = validateReportInput(patch, { requireName: false });
  if (validationError) throw new Error(validationError);

  const col = await sabcrmReports();
  const existing = await col.findOne({
    _id: new ObjectId(id),
    projectId,
  } as Filter<SabcrmReportDoc>);

  if (!existing) return null;

  // Resolve the effective metric + metricField after patch.
  const effectiveMetric = patch.metric ?? existing.metric;
  const effectiveMetricField = patch.metricField ?? existing.metricField;
  const effectiveGroupByField =
    "groupByField" in patch ? patch.groupByField : existing.groupByField;

  if (effectiveMetric !== "count" && effectiveMetricField) {
    const object = await getObject(projectId, existing.object);
    if (!object) throw new Error(`Unknown SabCRM object: "${existing.object}".`);
    assertNumericField(object, effectiveMetricField);

    if (effectiveGroupByField) {
      assertGroupableField(object, effectiveGroupByField);
    }
  } else if (effectiveGroupByField) {
    const object = await getObject(projectId, existing.object);
    if (!object) throw new Error(`Unknown SabCRM object: "${existing.object}".`);
    assertGroupableField(object, effectiveGroupByField);
  }

  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (patch.name !== undefined) set.name = patch.name.trim();
  if ("description" in patch) set.description = patch.description?.trim();
  if (patch.metric !== undefined) set.metric = patch.metric;
  if ("metricField" in patch) set.metricField = patch.metricField;
  if ("groupByField" in patch) set.groupByField = patch.groupByField;
  if ("timeBucket" in patch) set.timeBucket = patch.timeBucket;
  if ("filters" in patch) set.filters = patch.filters;
  if ("chartType" in patch) set.chartType = patch.chartType;
  if ("kind" in patch) set.kind = patch.kind;
  if ("pipelineId" in patch) set.pipelineId = patch.pipelineId;
  if ("pivotColField" in patch) set.pivotColField = patch.pivotColField;
  if ("cohortDateField" in patch) set.cohortDateField = patch.cohortDateField;
  if ("cohortInterval" in patch) set.cohortInterval = patch.cohortInterval;

  const updated = await col.findOneAndUpdate(
    { _id: new ObjectId(id), projectId } as Filter<SabcrmReportDoc>,
    { $set: set },
    { returnDocument: "after" },
  );

  return updated ? docToReport(updated as unknown as SabcrmReportDoc) : null;
}

/**
 * Deletes a report definition. Returns `true` when a document was removed.
 */
export async function deleteReport(
  projectId: string,
  id: string,
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;

  const col = await sabcrmReports();
  const result = await col.deleteOne({
    _id: new ObjectId(id),
    projectId,
  } as Filter<SabcrmReportDoc>);

  return result.deletedCount === 1;
}

/* -------------------------------------------------------------------------- */
/* Analytics runtime                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Executes the aggregation encoded in a saved report definition and returns a
 * {@link ReportDataSeries}. The caller supplies the `userId` because
 * `sabcrm_records` is owner-scoped; every record query is filtered by
 * `{ projectId, userId }`.
 *
 * Performance notes:
 * - Aggregation runs in a single MongoDB `$aggregate` pipeline.
 * - Date group-by uses `$dateToString` + `$dateTrunc` so the bucketing
 *   happens on the server, not in application code.
 * - Result sets are capped at {@link RUN_REPORT_CAP} rows to prevent
 *   unbounded responses; the `recordCount` reflects the true filter-matching
 *   count from the first `$count` stage.
 *
 * @throws {Error} when the report does not exist, the object is unknown, or
 *   the metric/groupBy field is not resolvable on the object.
 */
export async function runReport(
  projectId: string,
  userId: string,
  reportId: string,
): Promise<ReportDataSeries> {
  const report = await getReport(projectId, reportId);
  if (!report) throw new Error(`Report not found: "${reportId}".`);

  return runReportDefinition(projectId, userId, report);
}

/**
 * Executes an *unsaved* report definition inline — useful for the "preview"
 * mode in the report builder before the user saves.
 *
 * @throws {Error} for invalid input or when the object is unknown.
 */
export async function runReportDefinition(
  projectId: string,
  userId: string,
  definition: Pick<
    SavedReport,
    | "object"
    | "metric"
    | "metricField"
    | "groupByField"
    | "timeBucket"
    | "filters"
    | "kind"
    | "pipelineId"
    | "pivotColField"
    | "cohortDateField"
    | "cohortInterval"
  >,
): Promise<ReportDataSeries> {
  const {
    object: objectSlug,
    metric,
    metricField,
    groupByField,
    timeBucket,
    filters,
    kind,
    pipelineId,
    pivotColField,
    cohortDateField,
    cohortInterval,
  } = definition;

  // Resolve object metadata (needed for label lookup on SELECT groups).
  const objectMeta = await getObject(projectId, objectSlug);
  if (!objectMeta) throw new Error(`Unknown SabCRM object: "${objectSlug}".`);

  // Validate metric + fields at run-time as well (protects against stale
  // saved definitions after an object schema change).
  if (metric !== "count" && metricField) {
    assertNumericField(objectMeta, metricField);
  }
  if (groupByField) {
    assertGroupableField(objectMeta, groupByField);
  }

  const recordsCol = await sabcrmRecords();

  // Base match stage — tenant + owner scope + optional exact-match filters.
  const matchStage: Record<string, unknown> = {
    projectId,
    userId,
    object: objectSlug,
  };
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        matchStage[`data.${key}`] = value;
      }
    }
  }

  // Count of records matching the filters (before group-by).
  const countResult = await recordsCol
    .aggregate([{ $match: matchStage }, { $count: "n" }])
    .toArray();
  const recordCount = (countResult[0] as { n?: number } | undefined)?.n ?? 0;

  // ── Pipeline-driven reports (funnel / velocity) ───────────────────────────
  if (kind === "funnel") {
    const f = await computeFunnel(recordsCol, matchStage, projectId, pipelineId);
    return {
      metric,
      rows: f.rows,
      recordCount,
      computedAt: new Date().toISOString(),
      meta: f.meta,
    };
  }
  if (kind === "velocity") {
    const v = await computeVelocity(recordsCol, matchStage, projectId, pipelineId);
    return {
      metric,
      rows: v.rows,
      recordCount,
      computedAt: new Date().toISOString(),
      meta: v.meta,
    };
  }

  // ── Matrix reports (pivot cross-tab / cohort grid) ────────────────────────
  if (kind === "pivot") {
    const p = await computePivot(
      recordsCol,
      matchStage,
      metric,
      metricField,
      groupByField,
      pivotColField,
    );
    return {
      metric,
      groupByField,
      rows: p.rows,
      matrix: p.matrix,
      recordCount,
      computedAt: new Date().toISOString(),
    };
  }
  if (kind === "cohort") {
    const c = await computeCohort(
      recordsCol,
      matchStage,
      cohortDateField,
      cohortInterval ?? "month",
    );
    return {
      metric,
      rows: c.rows,
      matrix: c.matrix,
      recordCount,
      computedAt: new Date().toISOString(),
    };
  }

  let rows: ReportDataPoint[];

  if (!groupByField) {
    // ── Single-value (no group-by) ──────────────────────────────────────────
    rows = await computeSingleValue(
      recordsCol,
      matchStage,
      metric,
      metricField,
    );
  } else {
    const field = objectMeta.fields.find((f) => f.key === groupByField);
    if (!field) throw new Error(`Field "${groupByField}" not found on "${objectSlug}".`);

    if (field.type === "DATE" || field.type === "DATE_TIME") {
      // ── Time-series group-by ─────────────────────────────────────────────
      rows = await computeTimeSeries(
        recordsCol,
        matchStage,
        metric,
        metricField,
        groupByField,
        timeBucket ?? "day",
      );
    } else if (field.type === "SELECT") {
      // ── SELECT breakdown — respect option order, include empty buckets ───
      rows = await computeSelectBreakdown(
        recordsCol,
        matchStage,
        metric,
        metricField,
        groupByField,
        field.options ?? [],
      );
    } else {
      // ── Generic breakdown (BOOLEAN, TEXT, etc.) ──────────────────────────
      rows = await computeGenericBreakdown(
        recordsCol,
        matchStage,
        metric,
        metricField,
        groupByField,
      );
    }
  }

  return {
    metric,
    groupByField: groupByField ?? undefined,
    timeBucket: groupByField ? (timeBucket ?? undefined) : undefined,
    rows,
    recordCount,
    computedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Aggregation helpers                                                        */
/* -------------------------------------------------------------------------- */

/** Cap on the number of rows returned by an analytics query. */
const RUN_REPORT_CAP = 500;

/** The records collection type, reused by the compute helpers. */
type RecordsCol = Awaited<ReturnType<typeof sabcrmRecords>>;

/* -------------------------------------------------------------------------- */
/* Funnel / velocity (pipeline-driven) compute                                */
/* -------------------------------------------------------------------------- */

/** Won/lost/open kind for a stage: explicit `kind`, else a label heuristic. */
function reportStageKind(
  stage: SabcrmRustPipelineStage,
): "open" | "won" | "lost" {
  if (stage.kind === "open" || stage.kind === "won" || stage.kind === "lost") {
    return stage.kind;
  }
  const label = (stage.label ?? stage.id ?? "").toLowerCase();
  if (/\bwon\b|customer/.test(label)) return "won";
  if (/\blost\b/.test(label)) return "lost";
  return "open";
}

/** The requested pipeline, else the project default, else the first one. */
async function resolveReportPipeline(
  projectId: string,
  pipelineId?: string,
): Promise<SabcrmRustPipeline | null> {
  const pipelines = await sabcrmPipelinesApi.list(projectId);
  if (pipelines.length === 0) return null;
  if (pipelineId) return pipelines.find((p) => p.id === pipelineId) ?? null;
  return pipelines.find((p) => p.isDefault) ?? pipelines[0];
}

/**
 * Funnel report: current-stage distribution across a pipeline's ordered
 * stages (count per stage), plus a win-rate over won/lost stages. `rows` is
 * one {@link ReportDataPoint} per stage (FunnelChart-ready).
 */
async function computeFunnel(
  recordsCol: RecordsCol,
  matchStage: Record<string, unknown>,
  projectId: string,
  pipelineId?: string,
): Promise<{ rows: ReportDataPoint[]; meta: ReportSeriesMeta }> {
  const pipeline = await resolveReportPipeline(projectId, pipelineId);
  if (!pipeline) return { rows: [], meta: {} };

  const grouped = await recordsCol
    .aggregate([
      { $match: matchStage },
      { $group: { _id: { $ifNull: ["$data.stage", ""] }, count: { $sum: 1 } } },
    ])
    .toArray();
  const byStage = new Map<string, number>();
  for (const g of grouped as Array<{ _id: unknown; count: number }>) {
    byStage.set(String(g._id), g.count);
  }

  const rows: ReportDataPoint[] = pipeline.stages.map((s) => ({
    key: String(s.id),
    label: s.label || String(s.id),
    value: byStage.get(String(s.id)) ?? 0,
    color: s.color,
  }));

  let won = 0;
  let lost = 0;
  for (const s of pipeline.stages) {
    const k = reportStageKind(s);
    const c = byStage.get(String(s.id)) ?? 0;
    if (k === "won") won += c;
    else if (k === "lost") lost += c;
  }
  const winRate = won + lost > 0 ? won / (won + lost) : 0;
  return { rows, meta: { winRate, wonCount: won } };
}

/**
 * Velocity report: sales velocity = (won deals × avg deal size × win-rate) /
 * avg cycle length, where cycle = `createdAt → closeDate` over won deals.
 * `rows` carries the won/open/lost split; `meta` carries the headline numbers.
 */
async function computeVelocity(
  recordsCol: RecordsCol,
  matchStage: Record<string, unknown>,
  projectId: string,
  pipelineId?: string,
): Promise<{ rows: ReportDataPoint[]; meta: ReportSeriesMeta }> {
  const pipeline = await resolveReportPipeline(projectId, pipelineId);
  if (!pipeline) return { rows: [], meta: {} };

  const wonStageIds = pipeline.stages
    .filter((s) => reportStageKind(s) === "won")
    .map((s) => String(s.id));
  const lostStageIds = pipeline.stages
    .filter((s) => reportStageKind(s) === "lost")
    .map((s) => String(s.id));

  const counts = await recordsCol
    .aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $cond: [
              { $in: ["$data.stage", wonStageIds] },
              "won",
              {
                $cond: [
                  { $in: ["$data.stage", lostStageIds] },
                  "lost",
                  "open",
                ],
              },
            ],
          },
          n: { $sum: 1 },
        },
      },
    ])
    .toArray();
  let won = 0;
  let lost = 0;
  let open = 0;
  for (const c of counts as Array<{ _id: string; n: number }>) {
    if (c._id === "won") won = c.n;
    else if (c._id === "lost") lost = c.n;
    else open = c.n;
  }
  const winRate = won + lost > 0 ? won / (won + lost) : 0;

  const vel = await recordsCol
    .aggregate([
      { $match: { ...matchStage, "data.stage": { $in: wonStageIds } } },
      {
        $addFields: {
          __amt: {
            $convert: { input: "$data.amount", to: "double", onError: 0, onNull: 0 },
          },
          __cycle: {
            $dateDiff: {
              startDate: {
                $convert: { input: "$createdAt", to: "date", onError: null, onNull: null },
              },
              endDate: {
                $convert: { input: "$data.closeDate", to: "date", onError: null, onNull: null },
              },
              unit: "day",
            },
          },
        },
      },
      { $match: { __cycle: { $ne: null, $gte: 0 } } },
      {
        $group: {
          _id: null,
          deals: { $sum: 1 },
          avgSize: { $avg: "$__amt" },
          avgCycle: { $avg: "$__cycle" },
        },
      },
    ])
    .toArray();
  const v =
    (vel[0] as { deals?: number; avgSize?: number; avgCycle?: number } | undefined) ?? {};
  const deals = v.deals ?? 0;
  const avgDealSize = v.avgSize ?? 0;
  const avgCycleDays = v.avgCycle ?? 0;
  const velocityPerDay =
    (deals * avgDealSize * winRate) / Math.max(avgCycleDays, 1);

  const rows: ReportDataPoint[] = [
    { key: "won", label: "Won", value: won },
    { key: "open", label: "Open", value: open },
    { key: "lost", label: "Lost", value: lost },
  ];
  return {
    rows,
    meta: { winRate, wonCount: won, avgDealSize, avgCycleDays, velocityPerDay },
  };
}

type AggregationDoc = Record<string, unknown>;

/**
 * Builds a `$group` accumulator expression for the chosen metric.
 * For `count`, accumulates by `$sum: 1`; for field-based metrics, uses the
 * appropriate operator against `$data.<metricField>`.
 */
function buildAccumulator(
  metric: ReportMetric,
  metricField: string | undefined,
): Record<string, unknown> {
  switch (metric) {
    case "count":
      return { $sum: 1 };
    case "sum":
      return { $sum: `$data.${metricField}` };
    case "avg":
      return { $avg: `$data.${metricField}` };
    case "min":
      return { $min: `$data.${metricField}` };
    case "max":
      return { $max: `$data.${metricField}` };
  }
}

/** Computes a single scalar metric value with no group-by. */
/* -------------------------------------------------------------------------- */
/* Pivot + cohort (matrix) compute                                            */
/* -------------------------------------------------------------------------- */

const EMPTY_MATRIX: { rows: ReportDataPoint[]; matrix: ReportMatrix } = {
  rows: [],
  matrix: { rowKeys: [], colKeys: [], cells: [] },
};

/**
 * Pivot cross-tab: rows = `groupByField`, columns = `pivotColField`, cells =
 * the metric. `$group` on the (row,col) pair, then reshape into a dense grid
 * with row/column totals.
 */
async function computePivot(
  recordsCol: RecordsCol,
  matchStage: Record<string, unknown>,
  metric: ReportMetric,
  metricField: string | undefined,
  groupByField: string | undefined,
  pivotColField: string | undefined,
): Promise<{ rows: ReportDataPoint[]; matrix: ReportMatrix }> {
  if (!groupByField || !pivotColField) return EMPTY_MATRIX;
  const grouped = await recordsCol
    .aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            r: { $ifNull: [`$data.${groupByField}`, "(empty)"] },
            c: { $ifNull: [`$data.${pivotColField}`, "(empty)"] },
          },
          v: buildAccumulator(metric, metricField),
        },
      },
      { $limit: RUN_REPORT_CAP },
    ])
    .toArray();

  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  const cell = new Map<string, number>();
  for (const g of grouped as Array<{ _id: { r: unknown; c: unknown }; v: number }>) {
    const r = String(g._id.r);
    const c = String(g._id.c);
    rowSet.add(r);
    colSet.add(c);
    cell.set(`${r} ${c}`, Number(g.v) || 0);
  }
  const rowKeys = [...rowSet].sort();
  const colKeys = [...colSet].sort();
  const cells = rowKeys.map((r) => colKeys.map((c) => cell.get(`${r} ${c}`) ?? 0));
  const rowTotals = cells.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = colKeys.map((_, ci) => cells.reduce((a, row) => a + row[ci], 0));
  return { rows: [], matrix: { rowKeys, colKeys, cells, rowTotals, colTotals } };
}

/** Mongo `$dateTrunc` unit for a report time bucket. */
function truncUnit(interval: ReportTimeBucket): string {
  return interval === "day" || interval === "week" || interval === "quarter" || interval === "year"
    ? interval
    : "month";
}

/** Format a cohort bucket Date into a short label by interval. */
function fmtCohort(d: unknown, interval: ReportTimeBucket): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "(none)";
  const iso = d.toISOString();
  if (interval === "year") return iso.slice(0, 4);
  if (interval === "day" || interval === "week") return iso.slice(0, 10);
  return iso.slice(0, 7); // month / quarter → YYYY-MM (quarter start)
}

/**
 * Cohort retention grid: rows = the `createdAt` cohort period, columns =
 * period offset until `cohortDateField` (e.g. leads created in month X, how
 * many reached their close month N periods later). Cells = record counts.
 */
async function computeCohort(
  recordsCol: RecordsCol,
  matchStage: Record<string, unknown>,
  cohortDateField: string | undefined,
  interval: ReportTimeBucket,
): Promise<{ rows: ReportDataPoint[]; matrix: ReportMatrix }> {
  if (!cohortDateField) return EMPTY_MATRIX;
  const unit = truncUnit(interval);
  const grouped = await recordsCol
    .aggregate([
      { $match: matchStage },
      {
        $addFields: {
          __cohort: {
            $dateTrunc: {
              date: { $convert: { input: "$createdAt", to: "date", onError: null, onNull: null } },
              unit,
              timezone: "UTC",
            },
          },
          __event: {
            $dateTrunc: {
              date: { $convert: { input: `$data.${cohortDateField}`, to: "date", onError: null, onNull: null } },
              unit,
              timezone: "UTC",
            },
          },
        },
      },
      { $match: { __cohort: { $ne: null } } },
      {
        $addFields: {
          __offset: {
            $dateDiff: { startDate: "$__cohort", endDate: { $ifNull: ["$__event", "$__cohort"] }, unit },
          },
        },
      },
      { $match: { __offset: { $gte: 0 } } },
      { $group: { _id: { cohort: "$__cohort", offset: "$__offset" }, n: { $sum: 1 } } },
      { $limit: RUN_REPORT_CAP },
    ])
    .toArray();

  const cohortSet = new Set<string>();
  let maxOffset = 0;
  const cell = new Map<string, number>();
  for (const g of grouped as Array<{ _id: { cohort: unknown; offset: number }; n: number }>) {
    const ck = fmtCohort(g._id.cohort, interval);
    cohortSet.add(ck);
    maxOffset = Math.max(maxOffset, g._id.offset ?? 0);
    cell.set(`${ck}|${g._id.offset}`, g.n);
  }
  const rowKeys = [...cohortSet].sort();
  const cols = Math.min(maxOffset + 1, 24); // bound the grid width
  const colKeys = Array.from({ length: cols }, (_, i) => `+${i}`);
  const cells = rowKeys.map((ck) => colKeys.map((_, off) => cell.get(`${ck}|${off}`) ?? 0));
  return { rows: [], matrix: { rowKeys, colKeys, cells } };
}

async function computeSingleValue(
  col: Awaited<ReturnType<typeof sabcrmRecords>>,
  matchStage: Record<string, unknown>,
  metric: ReportMetric,
  metricField: string | undefined,
): Promise<ReportDataPoint[]> {
  const accumulator = buildAccumulator(metric, metricField);

  const pipeline: AggregationDoc[] = [
    { $match: matchStage },
    { $group: { _id: null, value: accumulator } },
  ];

  const results = await col.aggregate(pipeline).toArray();
  const raw = results[0] as { value?: number } | undefined;
  const value = typeof raw?.value === "number" ? raw.value : 0;

  return [{ key: TOTAL_KEY, label: "Total", value }];
}

/**
 * Bucketing format strings for `$dateToString` per time-bucket granularity.
 * MongoDB format specifiers: %Y year, %m month, %V ISO week, %d day.
 * Quarter is derived in a separate `$addFields` step.
 */
const DATE_FORMAT: Record<ReportTimeBucket, string> = {
  day: "%Y-%m-%d",
  week: "%G-W%V",    // ISO year + week
  month: "%Y-%m",
  quarter: "%Y-%m",  // resolved to quarter string via $addFields below
  year: "%Y",
};

/**
 * Computes a time-series breakdown by bucketing the `groupByField` date using
 * `$dateToString`. Returns rows sorted oldest → newest.
 */
async function computeTimeSeries(
  col: Awaited<ReturnType<typeof sabcrmRecords>>,
  matchStage: Record<string, unknown>,
  metric: ReportMetric,
  metricField: string | undefined,
  groupByField: string,
  timeBucket: ReportTimeBucket,
): Promise<ReportDataPoint[]> {
  const accumulator = buildAccumulator(metric, metricField);
  const fieldPath = `$data.${groupByField}`;

  let groupId: unknown;
  let addFieldsStage: AggregationDoc | null = null;

  if (timeBucket === "quarter") {
    // Derive quarter from month: Q = ceil(month/3).
    addFieldsStage = {
      $addFields: {
        __month: { $month: { $toDate: fieldPath } },
        __year: { $year: { $toDate: fieldPath } },
      },
    };
    groupId = {
      $concat: [
        { $toString: "$__year" },
        "-Q",
        {
          $toString: {
            $ceil: { $divide: ["$__month", 3] },
          },
        },
      ],
    };
  } else {
    groupId = {
      $dateToString: {
        format: DATE_FORMAT[timeBucket],
        date: { $toDate: fieldPath },
        onNull: null,
      },
    };
  }

  const pipeline: AggregationDoc[] = [
    { $match: matchStage },
    ...(addFieldsStage ? [addFieldsStage] : []),
    { $group: { _id: groupId, value: accumulator } },
    { $sort: { _id: 1 } },
    { $limit: RUN_REPORT_CAP },
  ];

  const results = await col.aggregate(pipeline).toArray();

  return results.map((doc) => {
    const raw = doc as { _id?: unknown; value?: number };
    const key = raw._id !== null && raw._id !== undefined ? String(raw._id) : "(no date)";
    return {
      key,
      label: key,
      value: typeof raw.value === "number" ? raw.value : 0,
    };
  });
}

/**
 * Computes a breakdown over a SELECT field, returning one row per option (in
 * option order), seeded with zero for empty buckets, plus an "(empty)" row
 * at the end if any records had no value.
 */
async function computeSelectBreakdown(
  col: Awaited<ReturnType<typeof sabcrmRecords>>,
  matchStage: Record<string, unknown>,
  metric: ReportMetric,
  metricField: string | undefined,
  groupByField: string,
  options: Array<{ value: string; label: string; color?: string }>,
): Promise<ReportDataPoint[]> {
  const accumulator = buildAccumulator(metric, metricField);

  const pipeline: AggregationDoc[] = [
    { $match: matchStage },
    {
      $group: {
        _id: { $ifNull: [`$data.${groupByField}`, ""] },
        value: accumulator,
      },
    },
    { $limit: RUN_REPORT_CAP },
  ];

  const results = await col.aggregate(pipeline).toArray();
  const byKey = new Map<string, number>();
  for (const doc of results) {
    const raw = doc as { _id?: unknown; value?: number };
    const key = raw._id !== undefined && raw._id !== null ? String(raw._id) : "";
    byKey.set(key, typeof raw.value === "number" ? raw.value : 0);
  }

  // Seed in option order (empty buckets → 0).
  const rows: ReportDataPoint[] = options.map((opt) => ({
    key: opt.value,
    label: opt.label,
    color: opt.color,
    value: byKey.get(opt.value) ?? 0,
  }));

  // Append any values not in declared options (legacy / renamed).
  const declaredValues = new Set(options.map((o) => o.value));
  for (const [key, value] of byKey) {
    if (!declaredValues.has(key) && key !== "") {
      rows.push({ key, label: key, value });
    }
  }

  // Append "(empty)" bucket if any records had no value.
  const emptyValue = byKey.get("");
  if (emptyValue !== undefined && emptyValue > 0) {
    rows.push({ key: "", label: "(empty)", value: emptyValue });
  }

  return rows;
}

/**
 * Generic breakdown for BOOLEAN and other non-date, non-SELECT fields.
 * Returns rows sorted by value descending.
 */
async function computeGenericBreakdown(
  col: Awaited<ReturnType<typeof sabcrmRecords>>,
  matchStage: Record<string, unknown>,
  metric: ReportMetric,
  metricField: string | undefined,
  groupByField: string,
): Promise<ReportDataPoint[]> {
  const accumulator = buildAccumulator(metric, metricField);

  const pipeline: AggregationDoc[] = [
    { $match: matchStage },
    {
      $group: {
        _id: { $ifNull: [`$data.${groupByField}`, null] },
        value: accumulator,
      },
    },
    { $sort: { value: -1 } },
    { $limit: RUN_REPORT_CAP },
  ];

  const results = await col.aggregate(pipeline).toArray();

  return results.map((doc) => {
    const raw = doc as { _id?: unknown; value?: number };
    const rawKey = raw._id;
    const key =
      rawKey === null || rawKey === undefined ? "" : String(rawKey);
    const label =
      rawKey === null || rawKey === undefined
        ? "(empty)"
        : rawKey === true
          ? "Yes"
          : rawKey === false
            ? "No"
            : String(rawKey);
    return {
      key,
      label,
      value: typeof raw.value === "number" ? raw.value : 0,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Field validation helpers                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Asserts that `fieldKey` resolves to a NUMBER or CURRENCY field on `object`,
 * which is required for sum/avg/min/max metrics.
 *
 * @throws {Error} when the field is absent or has an incompatible type.
 */
function assertNumericField(object: ObjectMetadata, fieldKey: string): void {
  const field = object.fields.find((f) => f.key === fieldKey);
  if (!field) {
    throw new Error(
      `Field "${fieldKey}" does not exist on object "${object.slug}".`,
    );
  }
  if (field.type !== "NUMBER" && field.type !== "CURRENCY") {
    throw new Error(
      `Metric field "${fieldKey}" must be a NUMBER or CURRENCY field (got ${field.type}).`,
    );
  }
}

/**
 * Asserts that `fieldKey` resolves to a field with a groupable type on `object`.
 * Groupable: SELECT, BOOLEAN, DATE, DATE_TIME.
 *
 * @throws {Error} when the field is absent or has a non-groupable type.
 */
function assertGroupableField(object: ObjectMetadata, fieldKey: string): void {
  const GROUPABLE: ReadonlySet<string> = new Set([
    "SELECT",
    "BOOLEAN",
    "DATE",
    "DATE_TIME",
  ]);

  const field = object.fields.find((f) => f.key === fieldKey);
  if (!field) {
    throw new Error(
      `Field "${fieldKey}" does not exist on object "${object.slug}".`,
    );
  }
  if (!GROUPABLE.has(field.type)) {
    throw new Error(
      `Field "${fieldKey}" (type ${field.type}) is not groupable. ` +
        `Groupable types: SELECT, BOOLEAN, DATE, DATE_TIME.`,
    );
  }
}
