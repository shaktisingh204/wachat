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

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

/** The metric an analytics query computes. */
export type ReportMetric = "count" | "sum" | "avg" | "min" | "max";

/** Preferred chart surface — stored with the definition, used by the UI only. */
export type ReportChartType = "bar" | "line" | "pie" | "number" | "table";

/** Time bucket granularity for DATE / DATE_TIME group-by fields. */
export type ReportTimeBucket = "day" | "week" | "month" | "quarter" | "year";

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
  >,
): Promise<ReportDataSeries> {
  const { object: objectSlug, metric, metricField, groupByField, timeBucket, filters } =
    definition;

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
