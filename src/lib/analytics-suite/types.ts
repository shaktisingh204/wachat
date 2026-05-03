/**
 * Analytics & BI Suite — shared type definitions.
 *
 * These types describe the data shapes used by the metrics pipeline,
 * report engine, dashboards, alerts and warehouse mirroring layers.
 * The implementation lives in sibling files; this module is type-only
 * so it is safe to import from edge runtimes, workers and tests.
 */

export type Dimensions = Record<string, string | number | boolean>;

export type AggregateFn =
    | 'sum'
    | 'avg'
    | 'min'
    | 'max'
    | 'count'
    | 'count_distinct'
    | 'p50'
    | 'p95'
    | 'p99';

export type Granularity = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface Metric {
    _id?: string;
    tenantId: string;
    name: string;
    value: number;
    dimensions?: Dimensions;
    ts: Date | string | number;
}

export interface MetricQueryRange {
    from: Date | string | number;
    to: Date | string | number;
    granularity?: Granularity;
}

export interface MetricQuery {
    tenantId: string;
    name: string;
    range: MetricQueryRange;
    groupBy?: string[];
    agg?: AggregateFn;
    filters?: Record<string, unknown>;
}

export interface MetricSeriesPoint {
    bucket: string; // ISO timestamp truncated to granularity
    value: number;
    dimensions?: Dimensions;
}

export interface MetricQueryResult {
    name: string;
    agg: AggregateFn;
    granularity: Granularity;
    points: MetricSeriesPoint[];
}

/** ---------------------------------------------------------------- Reports */

export type ReportFilterOp =
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'nin'
    | 'contains';

export interface ReportFilter {
    field: string;
    op: ReportFilterOp;
    value: unknown;
}

export interface ReportSort {
    field: string;
    dir: 'asc' | 'desc';
}

export interface ReportMeasure {
    field: string;
    agg: AggregateFn;
    alias?: string;
}

/**
 * JSON DSL for report definitions. Intentionally tiny — the runner
 * compiles this to a Mongo aggregation pipeline.
 */
export interface ReportDefinition {
    source: string; // Mongo collection name
    measures: ReportMeasure[];
    dimensions?: string[];
    filters?: ReportFilter[];
    groupBy?: string[];
    sortBy?: ReportSort[];
    limit?: number;
}

export interface Report {
    _id?: string;
    tenantId: string;
    name: string;
    description?: string;
    definition: ReportDefinition;
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
}

export interface ReportRow {
    [key: string]: unknown;
}

export interface ReportResult {
    reportId: string;
    rows: ReportRow[];
    totalRows: number;
    executedAt: Date;
    durationMs: number;
}

/** ------------------------------------------------------------- Dashboards */

export type WidgetKind =
    | 'metric'
    | 'line'
    | 'bar'
    | 'pie'
    | 'funnel'
    | 'cohort'
    | 'table'
    | 'kpi';

export interface DashboardWidget {
    id: string;
    kind: WidgetKind;
    title: string;
    /** Either a saved reportId or an inline query. */
    reportId?: string;
    metric?: { name: string; agg: AggregateFn; range?: MetricQueryRange };
    layout: { x: number; y: number; w: number; h: number };
    options?: Record<string, unknown>;
}

export interface Dashboard {
    _id?: string;
    tenantId: string;
    name: string;
    description?: string;
    widgets: DashboardWidget[];
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
    /** When set, this dashboard can be embedded externally via signed URL. */
    embeddable?: boolean;
}

/** ----------------------------------------------------- Warehouse Mirroring */

export type WarehouseProvider = 'bigquery' | 'snowflake' | 'postgres';

export interface WarehouseMirrorConfig {
    _id?: string;
    tenantId: string;
    provider: WarehouseProvider;
    dataset: string;
    table: string;
    /** Source collection in Mongo to mirror. */
    source: string;
    /** Optional connection blob (we never log it). */
    connection?: Record<string, unknown>;
    enabled: boolean;
    schedule?: string; // cron expression
    lastRunAt?: Date;
    lastError?: string;
}

/** ---------------------------------------------------------------- Alerts */

export type AlertOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';

export interface AlertRule {
    _id?: string;
    tenantId: string;
    name: string;
    metric: string;
    agg: AggregateFn;
    /** Comparison threshold. */
    op: AlertOp;
    threshold: number;
    /** Look-back window in minutes. */
    windowMinutes: number;
    /** Notification channels (each maps to existing channel id/email). */
    channels: Array<
        | { type: 'email'; to: string }
        | { type: 'inapp'; userId: string }
        | { type: 'webhook'; url: string }
    >;
    enabled: boolean;
    /** When this rule last fired — used for de-duping. */
    lastFiredAt?: Date;
    cooldownMinutes?: number;
}

export interface AlertEvaluationResult {
    ruleId: string;
    fired: boolean;
    actualValue: number;
    threshold: number;
    evaluatedAt: Date;
    reason?: string;
}

/** --------------------------------------------------------------- Cohorts */

export type CohortPeriod = 'week' | 'month';

export interface CohortDefinition {
    /** Source collection (must contain `tenantId`, `userId`, and a date field). */
    source: string;
    /** Date field used to bucket the cohort (signup date, first action, etc). */
    cohortField: string;
    /** Date field used to detect retention activity. */
    activityField: string;
    period: CohortPeriod;
    /** Number of periods to compute retention for. */
    periods: number;
    /** Optional filter on the source documents. */
    filters?: ReportFilter[];
}

export interface CohortRow {
    cohort: string; // ISO bucket, e.g. "2025-W14" or "2025-04"
    size: number;
    retention: number[]; // length === periods, values in [0,1]
}

export interface Cohort {
    _id?: string;
    tenantId: string;
    name: string;
    definition: CohortDefinition;
    createdAt: Date;
}

export interface CohortResult {
    period: CohortPeriod;
    periods: number;
    rows: CohortRow[];
}

/** --------------------------------------------------------------- Funnels */

export interface FunnelEvent {
    userId: string;
    name: string;
    ts: number | Date | string;
    properties?: Record<string, unknown>;
}

export interface FunnelStepResult {
    step: string;
    users: number;
    conversionFromPrev: number; // [0,1]
    conversionFromStart: number; // [0,1]
    dropOff: number;
}

export interface FunnelResult {
    steps: FunnelStepResult[];
    totalEntered: number;
    totalCompleted: number;
    overallConversion: number;
}

export interface Funnel {
    _id?: string;
    tenantId: string;
    name: string;
    steps: string[];
    /** Optional max time between first and last step (ms). */
    windowMs?: number;
    createdAt: Date;
}

/** -------------------------------------------------------- Attribution */

export type AttributionModelKind =
    | 'last-touch'
    | 'first-touch'
    | 'linear'
    | 'time-decay'
    | 'u-shape';

export interface AttributionTouchpoint {
    channel: string;
    ts: number | Date | string;
    /** Optional weight override; defaults to 1. */
    weight?: number;
}

export interface AttributionModel {
    _id?: string;
    tenantId: string;
    name: string;
    kind: AttributionModelKind;
    /** Half-life in hours, only used by `time-decay`. */
    halfLifeHours?: number;
    createdAt: Date;
}

/** ------------------------------------------------ Embedded Dashboards */

export interface SignDashboardOpts {
    tenantId: string;
    /** Seconds until expiry. */
    expiresIn?: number;
    /** Extra claims passed through to the embed page. */
    claims?: Record<string, unknown>;
}

export interface EmbeddedDashboardClaims {
    dashboardId: string;
    tenantId: string;
    iat: number;
    exp: number;
    [k: string]: unknown;
}
