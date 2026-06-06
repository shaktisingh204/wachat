'use client';

/**
 * SabCRM — Report Builder component.
 *
 * A two-panel client component: a form on the left lets the user define a
 * report (object, metric, group-by, filters, chart type, name) and a live
 * preview on the right re-runs the aggregation and renders the result as a
 * chart (bar / line / pie) or a numeric stat card whenever the definition
 * changes (debounced to 600 ms so every keystroke does not fire a server
 * action).
 *
 * ## Integration contract
 *
 * - **New report**: supply `objects` (all project objects). No `initialReport`.
 * - **Edit report**: supply `initialReport` (a full `SavedReport`) alongside
 *   `objects`. The form seeds itself from the existing definition; saving
 *   calls the update path.
 * - `onSaved` is called with the persisted `SavedReport` after a successful
 *   save so the host page can navigate / refresh its list.
 * - `projectId` is forwarded to every action call (optional — defaults to the
 *   user's first project).
 *
 * ## Invariants
 * - No raw file URL inputs (SabFiles policy is not relevant to analytics, but
 *   we still respect no raw URL inputs for any fields).
 * - All UI uses ZoruUI primitives exclusively.
 * - No `any` (except the Recharts `ResponsiveContainer` children cast already
 *   present in the ZoruChartContainer upstream).
 * - Named export only.
 */

import * as React from 'react';
import * as Recharts from 'recharts';
import {
  BarChart2,
  LineChart,
  PieChart,
  Hash,
  Table2,
  Play,
  Save,
  Loader2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  cn,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Separator,
  Skeleton,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';

import {
  listObjectsAction,
  runReportDefinitionAction,
  saveReportAction,
} from '@/app/actions/sabcrm.actions';
import type {
  SaveReportActionInput,
  SavedReport,
  CreateReportInput,
  ReportDataSeries,
  ReportMetric,
  ReportChartType,
  ReportTimeBucket,
  ReportDataPoint,
} from '@/app/actions/sabcrm.actions.types';

import type { ObjectMetadata, FieldMetadata, FieldType } from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportBuilderProps {
  /** All project objects (standard + custom). Pass from a server component. */
  objects?: ObjectMetadata[];
  /** When editing an existing report, pass its full definition here. */
  initialReport?: SavedReport;
  /** Forwarded to every action call. */
  projectId?: string;
  /** Called with the saved report after a successful create or update. */
  onSaved?: (report: SavedReport) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const METRIC_LABELS: Record<ReportMetric, string> = {
  count: 'Count',
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
};

const CHART_TYPE_LABELS: Record<ReportChartType, string> = {
  bar: 'Bar chart',
  line: 'Line chart',
  pie: 'Pie chart',
  number: 'Single number',
  table: 'Table',
};

const TIME_BUCKET_LABELS: Record<ReportTimeBucket, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

/** Field types that are numeric and can be used with sum/avg/min/max. */
const NUMERIC_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'NUMBER',
  'CURRENCY',
  'RATING',
]);

/** Field types that can be used for group-by. */
const GROUPABLE_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'SELECT',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
]);

/** Field types that imply time-series bucketing when used for group-by. */
const DATE_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'DATE',
  'DATE_TIME',
]);

function numericFields(fields: FieldMetadata[]): FieldMetadata[] {
  return fields.filter((f) => NUMERIC_TYPES.has(f.type));
}

function groupableFields(fields: FieldMetadata[]): FieldMetadata[] {
  return fields.filter((f) => GROUPABLE_TYPES.has(f.type));
}

/** Whether the metric requires a metricField to be selected. */
function metricNeedsField(metric: ReportMetric): boolean {
  return metric !== 'count';
}

/** Whether the currently chosen groupByField is a date field (time-series). */
function isDateGroupBy(fields: FieldMetadata[], groupByField: string | undefined): boolean {
  if (!groupByField) return false;
  const field = fields.find((f) => f.key === groupByField);
  return field ? DATE_TYPES.has(field.type) : false;
}

/** Whether the chart type shows a chart rather than a table/number. */
function isChartType(chartType: ReportChartType): boolean {
  return chartType === 'bar' || chartType === 'line' || chartType === 'pie';
}

/** Formats a numeric report value for display. */
function formatValue(value: number, metric: ReportMetric): string {
  if (!Number.isFinite(value)) return '—';
  if (metric === 'count') return value.toLocaleString();
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Draft state shape
// ---------------------------------------------------------------------------

interface ReportDraft {
  name: string;
  description: string;
  object: string;
  metric: ReportMetric;
  metricField: string;
  groupByField: string;
  timeBucket: ReportTimeBucket;
  filters: string; // JSON string of the flat filter map
  chartType: ReportChartType;
}

function draftFromReport(report: SavedReport): ReportDraft {
  return {
    name: report.name,
    description: report.description ?? '',
    object: report.object,
    metric: report.metric,
    metricField: report.metricField ?? '',
    groupByField: report.groupByField ?? '',
    timeBucket: report.timeBucket ?? 'month',
    filters: report.filters ? JSON.stringify(report.filters, null, 2) : '',
    chartType: report.chartType ?? 'bar',
  };
}

function emptyDraft(): ReportDraft {
  return {
    name: '',
    description: '',
    object: '',
    metric: 'count',
    metricField: '',
    groupByField: '',
    timeBucket: 'month',
    filters: '',
    chartType: 'bar',
  };
}

function draftToInput(draft: ReportDraft): Partial<CreateReportInput> {
  let filters: Record<string, unknown> | undefined;
  if (draft.filters.trim()) {
    try {
      const parsed: unknown = JSON.parse(draft.filters);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        filters = parsed as Record<string, unknown>;
      }
    } catch {
      // Silently ignore malformed JSON — preview will show a validation error.
    }
  }

  return {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    object: draft.object,
    metric: draft.metric,
    metricField: metricNeedsField(draft.metric) && draft.metricField ? draft.metricField : undefined,
    groupByField: draft.groupByField || undefined,
    timeBucket: isDateGroupBy([], draft.groupByField) ? draft.timeBucket : undefined,
    filters,
    chartType: draft.chartType,
  };
}

// ---------------------------------------------------------------------------
// ReportBuilder
// ---------------------------------------------------------------------------

export function ReportBuilder({
  objects: initialObjects,
  initialReport,
  projectId,
  onSaved,
  className,
}: ReportBuilderProps): React.ReactElement {
  const { toast } = useZoruToast();
  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // ---- objects list -------------------------------------------------------
  const [objects, setObjects] = React.useState<ObjectMetadata[]>(initialObjects ?? []);
  const [loadingObjects, setLoadingObjects] = React.useState(!initialObjects);

  React.useEffect(() => {
    if (initialObjects) return;
    let cancelled = false;
    void (async () => {
      const res = await listObjectsAction(projectId);
      if (cancelled) return;
      if (res.ok) setObjects(res.data);
      setLoadingObjects(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialObjects, projectId]);

  // ---- form draft ---------------------------------------------------------
  const [draft, setDraft] = React.useState<ReportDraft>(
    initialReport ? draftFromReport(initialReport) : emptyDraft,
  );

  const patch = React.useCallback(
    (delta: Partial<ReportDraft>) =>
      setDraft((prev) => ({ ...prev, ...delta })),
    [],
  );

  // Derived: the selected object's metadata
  const selectedObject = React.useMemo(
    () => objects.find((o) => o.slug === draft.object) ?? null,
    [objects, draft.object],
  );

  const numFields = React.useMemo(
    () => (selectedObject ? numericFields(selectedObject.fields) : []),
    [selectedObject],
  );

  const groupFields = React.useMemo(
    () => (selectedObject ? groupableFields(selectedObject.fields) : []),
    [selectedObject],
  );

  const dateGroupBy = React.useMemo(
    () => (selectedObject ? isDateGroupBy(selectedObject.fields, draft.groupByField) : false),
    [selectedObject, draft.groupByField],
  );

  // ---- preview state ------------------------------------------------------
  const [preview, setPreview] = React.useState<ReportDataSeries | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  // Debounced preview runner: fires 600 ms after the draft stops changing.
  const previewTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPreview = React.useCallback(
    async (currentDraft: ReportDraft, currentObjects: ObjectMetadata[]) => {
      if (!currentDraft.object || !currentDraft.metric) {
        setPreview(null);
        setPreviewError(null);
        return;
      }

      const input = draftToInput(currentDraft);
      if (!input.object || !input.metric) {
        setPreview(null);
        setPreviewError('Select an object and metric to preview.');
        return;
      }

      // If metric needs field and none is chosen, don't run yet.
      if (metricNeedsField(currentDraft.metric) && !currentDraft.metricField) {
        setPreview(null);
        setPreviewError('Select a numeric field for this metric.');
        return;
      }

      // Attach timeBucket if groupBy is a date field.
      const obj = currentObjects.find((o) => o.slug === currentDraft.object);
      if (obj && isDateGroupBy(obj.fields, currentDraft.groupByField)) {
        input.timeBucket = currentDraft.timeBucket;
      }

      setPreviewLoading(true);
      setPreviewError(null);

      const res = await runReportDefinitionAction(
        input as CreateReportInput,
        projectId,
      );

      setPreviewLoading(false);
      if (res.ok) {
        setPreview(res.data);
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(res.error);
      }
    },
    [projectId],
  );

  // Trigger debounced preview whenever relevant draft fields change.
  React.useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      void runPreview(draft, objects);
    }, 600);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draft.object,
    draft.metric,
    draft.metricField,
    draft.groupByField,
    draft.timeBucket,
    draft.filters,
    objects,
  ]);

  // ---- save ---------------------------------------------------------------
  const [saving, setSaving] = React.useState(false);

  const handleSave = React.useCallback(async () => {
    if (saving) return;

    if (!draft.name.trim()) {
      toastRef.current({ title: 'Report name is required.', variant: 'destructive' });
      return;
    }
    if (!draft.object) {
      toastRef.current({ title: 'Object is required.', variant: 'destructive' });
      return;
    }
    if (!draft.metric) {
      toastRef.current({ title: 'Metric is required.', variant: 'destructive' });
      return;
    }
    if (metricNeedsField(draft.metric) && !draft.metricField) {
      toastRef.current({
        title: 'Metric field required',
        description: `The "${METRIC_LABELS[draft.metric]}" metric requires a numeric field.`,
        variant: 'destructive',
      });
      return;
    }

    const input = draftToInput(draft);

    // Attach timeBucket for date group-by.
    if (selectedObject && isDateGroupBy(selectedObject.fields, draft.groupByField)) {
      input.timeBucket = draft.timeBucket;
    }

    const saveInput: SaveReportActionInput = {
      ...(input as CreateReportInput),
      id: initialReport?._id,
    };

    setSaving(true);
    const res = await saveReportAction(saveInput, projectId);
    setSaving(false);

    if (!res.ok) {
      toastRef.current({
        title: 'Could not save report',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }

    toastRef.current({
      title: initialReport ? 'Report updated.' : 'Report saved.',
    });
    onSaved?.(res.data);
  }, [draft, saving, initialReport, projectId, onSaved, selectedObject]);

  // ---- render -------------------------------------------------------------

  return (
    <div className={cn('grid grid-cols-1 gap-6 lg:grid-cols-2', className)}>
      {/* ── Left: form ─────────────────────────────────────────────────────── */}
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Report definition</ZoruCardTitle>
          <ZoruCardDescription>
            Configure what this report measures and how to display it.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-col gap-5">
          {/* Name + description */}
          <FieldRow label="Name" htmlFor="rb-name">
            <Input
              id="rb-name"
              value={draft.name}
              placeholder="e.g. Opportunities by stage"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </FieldRow>

          <FieldRow label="Description" htmlFor="rb-desc">
            <Input
              id="rb-desc"
              value={draft.description}
              placeholder="Optional description"
              onChange={(e) => patch({ description: e.target.value })}
            />
          </FieldRow>

          <Separator />

          {/* Object */}
          <FieldRow label="Object" htmlFor="rb-object">
            {loadingObjects ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={draft.object}
                onValueChange={(value) =>
                  patch({
                    object: value,
                    metricField: '',
                    groupByField: '',
                  })
                }
              >
                <SelectTrigger id="rb-object" aria-label="Object">
                  <SelectValue placeholder="Select object…" />
                </SelectTrigger>
                <SelectContent>
                  {objects.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>
                      {o.labelPlural}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FieldRow>

          {/* Metric */}
          <FieldRow label="Metric" htmlFor="rb-metric">
            <Select
              value={draft.metric}
              onValueChange={(value) =>
                patch({ metric: value as ReportMetric, metricField: '' })
              }
            >
              <SelectTrigger id="rb-metric" aria-label="Metric">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(METRIC_LABELS) as ReportMetric[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {METRIC_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Metric field — only shown when metric !== count */}
          {metricNeedsField(draft.metric) && (
            <FieldRow label="Numeric field" htmlFor="rb-metric-field">
              {numFields.length === 0 ? (
                <p className="text-xs text-[var(--st-text-secondary)] py-2">
                  {draft.object
                    ? 'No numeric fields on this object.'
                    : 'Select an object first.'}
                </p>
              ) : (
                <Select
                  value={draft.metricField}
                  onValueChange={(value) => patch({ metricField: value })}
                >
                  <SelectTrigger id="rb-metric-field" aria-label="Numeric field">
                    <SelectValue placeholder="Select field…" />
                  </SelectTrigger>
                  <SelectContent>
                    {numFields.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FieldRow>
          )}

          <Separator />

          {/* Group by */}
          <FieldRow label="Group by" htmlFor="rb-group-by">
            {groupFields.length === 0 && draft.object ? (
              <p className="text-xs text-[var(--st-text-secondary)] py-2">
                No groupable fields (SELECT, BOOLEAN, DATE) on this object.
              </p>
            ) : (
              <Select
                value={draft.groupByField}
                onValueChange={(value) => patch({ groupByField: value === '__none__' ? '' : value })}
              >
                <SelectTrigger id="rb-group-by" aria-label="Group by">
                  <SelectValue placeholder="None (single value)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (single value)</SelectItem>
                  {groupFields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FieldRow>

          {/* Time bucket — only when group-by is a date field */}
          {dateGroupBy && (
            <FieldRow label="Time bucket" htmlFor="rb-time-bucket">
              <Select
                value={draft.timeBucket}
                onValueChange={(value) => patch({ timeBucket: value as ReportTimeBucket })}
              >
                <SelectTrigger id="rb-time-bucket" aria-label="Time bucket">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIME_BUCKET_LABELS) as ReportTimeBucket[]).map((b) => (
                    <SelectItem key={b} value={b}>
                      {TIME_BUCKET_LABELS[b]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          )}

          <Separator />

          {/* Chart type */}
          <div className="space-y-2">
            <Label>Chart type</Label>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Chart type"
            >
              {(Object.keys(CHART_TYPE_LABELS) as ReportChartType[]).map((ct) => (
                <ChartTypeButton
                  key={ct}
                  type={ct}
                  active={draft.chartType === ct}
                  onClick={() => patch({ chartType: ct })}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* Optional filters */}
          <div className="space-y-2">
            <Label htmlFor="rb-filters">
              Filters{' '}
              <span className="font-normal text-[var(--st-text-secondary)]">(JSON, optional)</span>
            </Label>
            <textarea
              id="rb-filters"
              className={cn(
                'flex min-h-[80px] w-full resize-y rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 font-mono text-xs',
                'text-[var(--st-text)] placeholder:text-[var(--st-text-tertiary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--st-accent)] focus:ring-offset-1',
              )}
              placeholder={'{\n  "stage": "open"\n}'}
              value={draft.filters}
              onChange={(e) => patch({ filters: e.target.value })}
              spellCheck={false}
            />
            <p className="text-xs text-[var(--st-text-secondary)]">
              Flat object: field key → exact value. E.g.{' '}
              <code className="rounded bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[10px]">
                {'{"stage":"open"}'}
              </code>
            </p>
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={previewLoading || !draft.object || !draft.metric}
              onClick={() => void runPreview(draft, objects)}
            >
              {previewLoading ? (
                <Loader2 className="mr-1.5 animate-spin" />
              ) : (
                <Play className="mr-1.5" />
              )}
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || !draft.name.trim() || !draft.object || !draft.metric}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <Loader2 className="mr-1.5 animate-spin" />
              ) : (
                <Save className="mr-1.5" />
              )}
              {initialReport ? 'Update report' : 'Save report'}
            </Button>
          </div>
        </ZoruCardContent>
      </Card>

      {/* ── Right: preview ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Live preview</ZoruCardTitle>
            <ZoruCardDescription>
              Updates automatically as you change the definition.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <PreviewPane
              series={preview}
              loading={previewLoading}
              error={previewError}
              chartType={draft.chartType}
              metric={draft.metric}
              metricLabel={
                selectedObject?.fields.find((f) => f.key === draft.metricField)?.label
              }
              objectLabel={selectedObject?.labelPlural}
            />
          </ZoruCardContent>
        </Card>

        {/* Metadata strip: record count + computed-at */}
        {preview && !previewLoading && (
          <MetadataStrip series={preview} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}

function FieldRow({ label, htmlFor, children }: FieldRowProps): React.ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

// ---- Chart type button ----------------------------------------------------

const CHART_TYPE_ICONS: Record<ReportChartType, React.ReactNode> = {
  bar: <BarChart2 className="h-4 w-4" />,
  line: <LineChart className="h-4 w-4" />,
  pie: <PieChart className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  table: <Table2 className="h-4 w-4" />,
};

interface ChartTypeButtonProps {
  type: ReportChartType;
  active: boolean;
  onClick: () => void;
}

function ChartTypeButton({ type, active, onClick }: ChartTypeButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={CHART_TYPE_LABELS[type]}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-[var(--st-radius-sm)] border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-bg)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]',
      )}
    >
      {CHART_TYPE_ICONS[type]}
      {CHART_TYPE_LABELS[type]}
    </button>
  );
}

// ---- Preview pane ---------------------------------------------------------

interface PreviewPaneProps {
  series: ReportDataSeries | null;
  loading: boolean;
  error: string | null;
  chartType: ReportChartType;
  metric: ReportMetric;
  metricLabel?: string;
  objectLabel?: string;
}

function PreviewPane({
  series,
  loading,
  error,
  chartType,
  metric,
  metricLabel,
  objectLabel,
}: PreviewPaneProps): React.ReactElement {
  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-[var(--st-text-secondary)]" />
        <p className="text-sm text-[var(--st-text-secondary)]">{error}</p>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center text-[var(--st-text-secondary)]">
        <TrendingUp className="h-10 w-10 opacity-40" />
        <p className="text-sm">
          Select an object and metric to see a preview.
        </p>
      </div>
    );
  }

  const valueLabel = metricLabel
    ? `${METRIC_LABELS[metric]} of ${metricLabel}`
    : METRIC_LABELS[metric];

  // Single-value (number chart or ungrouped)
  if (chartType === 'number' || (series.rows.length === 1 && series.rows[0]?.key === '__total__')) {
    const row = series.rows[0];
    const value = row ? formatValue(row.value, metric) : '—';
    return (
      <div className="flex flex-col items-start gap-1 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
          {objectLabel ? `${objectLabel} — ${valueLabel}` : valueLabel}
        </p>
        <p className="text-5xl font-semibold tracking-tight text-[var(--st-text)]">{value}</p>
      </div>
    );
  }

  // Table chart
  if (chartType === 'table') {
    return <TablePreview rows={series.rows} metric={metric} />;
  }

  // Bar chart
  if (chartType === 'bar') {
    return (
      <ZoruChartContainer height={280}>
        <Recharts.BarChart
          data={series.rows}
          margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
        >
          <Recharts.CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
          <Recharts.XAxis
            dataKey="label"
            tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <Recharts.YAxis
            tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 11 }}
            tickFormatter={(v: number) => formatValue(v, metric)}
          />
          <Recharts.Tooltip content={<ZoruChartTooltip />} />
          <Recharts.Bar
            dataKey="value"
            name={valueLabel}
            fill={ZORU_CHART_PALETTE[0]}
            radius={[3, 3, 0, 0]}
          >
            {series.rows.map((row, idx) => (
              <Recharts.Cell
                key={row.key}
                fill={row.color ?? ZORU_CHART_PALETTE[idx % ZORU_CHART_PALETTE.length]}
              />
            ))}
          </Recharts.Bar>
        </Recharts.BarChart>
      </ZoruChartContainer>
    );
  }

  // Line chart
  if (chartType === 'line') {
    return (
      <ZoruChartContainer height={280}>
        <Recharts.LineChart
          data={series.rows}
          margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
        >
          <Recharts.CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
          <Recharts.XAxis
            dataKey="label"
            tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <Recharts.YAxis
            tick={{ fill: 'hsl(var(--zoru-ink-muted))', fontSize: 11 }}
            tickFormatter={(v: number) => formatValue(v, metric)}
          />
          <Recharts.Tooltip content={<ZoruChartTooltip />} />
          <Recharts.Line
            type="monotone"
            dataKey="value"
            name={valueLabel}
            stroke={ZORU_CHART_PALETTE[0]}
            strokeWidth={2}
            dot={{ r: 3, fill: ZORU_CHART_PALETTE[0] }}
            activeDot={{ r: 5 }}
          />
        </Recharts.LineChart>
      </ZoruChartContainer>
    );
  }

  // Pie chart
  if (chartType === 'pie') {
    return (
      <ZoruChartContainer height={280}>
        <Recharts.PieChart>
          <Recharts.Tooltip content={<ZoruChartTooltip />} />
          <Recharts.Legend
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span style={{ fontSize: 11, color: 'hsl(var(--zoru-ink-muted))' }}>
                {value}
              </span>
            )}
          />
          <Recharts.Pie
            data={series.rows}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={90}
            strokeWidth={1}
            stroke="hsl(var(--zoru-bg))"
          >
            {series.rows.map((row, idx) => (
              <Recharts.Cell
                key={row.key}
                fill={row.color ?? ZORU_CHART_PALETTE[idx % ZORU_CHART_PALETTE.length]}
              />
            ))}
          </Recharts.Pie>
        </Recharts.PieChart>
      </ZoruChartContainer>
    );
  }

  // Fallback (exhaustive guard)
  return (
    <p className="py-4 text-sm text-[var(--st-text-secondary)]">Unknown chart type.</p>
  );
}

// ---- Table preview --------------------------------------------------------

interface TablePreviewProps {
  rows: ReportDataPoint[];
  metric: ReportMetric;
}

function TablePreview({ rows, metric }: TablePreviewProps): React.ReactElement {
  if (rows.length === 0) {
    return (
      <p className="py-4 text-sm text-center text-[var(--st-text-secondary)]">No data.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--st-border)]">
            <th className="py-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
              Group
            </th>
            <th className="py-2 text-right text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
              {METRIC_LABELS[metric]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className="border-b border-[var(--st-border)]/60 last:border-0 hover:bg-[var(--st-bg-muted)]/50 transition-colors"
            >
              <td className="py-2 pr-4 text-[var(--st-text)]">
                <span className="flex items-center gap-2">
                  {row.color && (
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: row.color }}
                    />
                  )}
                  {row.label || '(empty)'}
                </span>
              </td>
              <td className="py-2 text-right font-medium tabular-nums text-[var(--st-text)]">
                {formatValue(row.value, metric)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Metadata strip -------------------------------------------------------

interface MetadataStripProps {
  series: ReportDataSeries;
}

function MetadataStrip({ series }: MetadataStripProps): React.ReactElement {
  const computedAt = React.useMemo(() => {
    try {
      return new Date(series.computedAt).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return series.computedAt;
    }
  }, [series.computedAt]);

  return (
    <div className="flex items-center justify-between rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-2.5 text-xs text-[var(--st-text-secondary)]">
      <span>
        <span className="font-medium text-[var(--st-text)]">
          {series.recordCount.toLocaleString()}
        </span>{' '}
        source record{series.recordCount !== 1 ? 's' : ''} matched
      </span>
      <span>Computed at {computedAt}</span>
    </div>
  );
}
