'use client';

/**
 * SabCRM — Reports page (client interactivity).
 *
 * Renders the saved-reports list, a slide-in builder panel (create / edit),
 * and an inline chart/table viewer that runs a report on demand.
 *
 * All mutations go through the gated server actions in
 * `@/app/actions/sabcrm.actions`:
 *   - listReportsAction      → gate('view')
 *   - createReportAction     → gate('edit')
 *   - updateReportAction     → gate('edit')
 *   - deleteReportAction     → gate('delete')
 *   - runReportAction        → gate('view')
 *   - runReportDefinitionAction → gate('view')
 *
 * The page is a Client Component; auth/RBAC is enforced by the parent
 * layout.tsx. We never expose raw URLs for file inputs — this page has none.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Play,
  Trash2,
  Pencil,
  BarChart2,
  LineChart,
  PieChart,
  Hash,
  Table2,
  Loader2,
  X,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import * as Recharts from 'recharts';

import {
  Button,
  Input,
  Label,
  Textarea,
  Badge,
  Skeleton,
  EmptyState,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Dialog,
  ZoruDialogTrigger,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogClose,
  ZoruAlertDialog,
  ZoruAlertDialogTrigger,
  ZoruAlertDialogContent,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogCancel,
  ZoruAlertDialogAction,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Separator,
  ScrollArea,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  useZoruToast,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
  cn,
} from '@/components/sabcrm/20ui/compat';

import {
  listObjectsAction,
  listReportsAction,
  createReportAction,
  updateReportAction,
  deleteReportAction,
  runReportAction,
  runReportDefinitionAction,
} from '@/app/actions/sabcrm.actions';

import type {
  SavedReport,
  CreateReportInput,
  UpdateReportPatch,
  ReportDataSeries,
  ReportMetric,
  ReportChartType,
  ReportTimeBucket,
  ReportDataPoint,
} from '@/app/actions/sabcrm.actions.types';

import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

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

const GROUPABLE_FIELD_TYPES: ReadonlySet<FieldMetadata['type']> = new Set([
  'SELECT',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
]);

const NUMERIC_FIELD_TYPES: ReadonlySet<FieldMetadata['type']> = new Set([
  'NUMBER',
  'CURRENCY',
  'RATING',
]);

const DATE_FIELD_TYPES: ReadonlySet<FieldMetadata['type']> = new Set([
  'DATE',
  'DATE_TIME',
]);

const CHART_ICON: Record<ReportChartType, React.ReactNode> = {
  bar: <BarChart2 className="h-4 w-4" />,
  line: <LineChart className="h-4 w-4" />,
  pie: <PieChart className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  table: <Table2 className="h-4 w-4" />,
};

/* -------------------------------------------------------------------------- */
/* Builder form state                                                          */
/* -------------------------------------------------------------------------- */

interface BuilderState {
  name: string;
  description: string;
  object: string;
  metric: ReportMetric;
  metricField: string;
  groupByField: string;
  timeBucket: ReportTimeBucket;
  filters: Record<string, string>;
  chartType: ReportChartType;
}

function defaultBuilderState(): BuilderState {
  return {
    name: '',
    description: '',
    object: '',
    metric: 'count',
    metricField: '',
    groupByField: '',
    timeBucket: 'month',
    filters: {},
    chartType: 'bar',
  };
}

function reportToBuilderState(r: SavedReport): BuilderState {
  return {
    name: r.name,
    description: r.description ?? '',
    object: r.object,
    metric: r.metric,
    metricField: r.metricField ?? '',
    groupByField: r.groupByField ?? '',
    timeBucket: r.timeBucket ?? 'month',
    filters: r.filters
      ? Object.fromEntries(
          Object.entries(r.filters).map(([k, v]) => [k, String(v ?? '')]),
        )
      : {},
    chartType: r.chartType ?? 'bar',
  };
}

function stateToCreateInput(s: BuilderState): CreateReportInput {
  return {
    name: s.name.trim(),
    description: s.description.trim() || undefined,
    object: s.object,
    metric: s.metric,
    metricField: s.metric !== 'count' && s.metricField ? s.metricField : undefined,
    groupByField: s.groupByField || undefined,
    timeBucket: s.groupByField ? s.timeBucket : undefined,
    filters:
      Object.keys(s.filters).length > 0
        ? Object.fromEntries(
            Object.entries(s.filters)
              .filter(([, v]) => v.trim() !== '')
              .map(([k, v]) => [k, v.trim()]),
          )
        : undefined,
    chartType: s.chartType,
  };
}

function stateToUpdatePatch(s: BuilderState): UpdateReportPatch {
  return {
    name: s.name.trim(),
    description: s.description.trim() || undefined,
    metric: s.metric,
    metricField: s.metric !== 'count' && s.metricField ? s.metricField : undefined,
    groupByField: s.groupByField || undefined,
    timeBucket: s.groupByField ? s.timeBucket : undefined,
    filters:
      Object.keys(s.filters).length > 0
        ? Object.fromEntries(
            Object.entries(s.filters)
              .filter(([, v]) => v.trim() !== '')
              .map(([k, v]) => [k, v.trim()]),
          )
        : undefined,
    chartType: s.chartType,
  };
}

/* -------------------------------------------------------------------------- */
/* Chart renderer                                                              */
/* -------------------------------------------------------------------------- */

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

interface ChartRendererProps {
  series: ReportDataSeries;
  chartType: ReportChartType;
}

function ChartRenderer({ series, chartType }: ChartRendererProps) {
  const { rows } = series;

  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        title="No data"
        description="No records matched the report filters."
      />
    );
  }

  // Single-value display
  if (chartType === 'number' || (rows.length === 1 && rows[0].key === '__total__')) {
    const total = rows[0]?.value ?? 0;
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-6xl font-bold tracking-tight text-[var(--st-text)]">
          {formatValue(total)}
        </p>
        <p className="mt-2 text-sm text-[var(--st-text-secondary)]">
          {METRIC_LABELS[series.metric]} · {series.recordCount} records
        </p>
      </div>
    );
  }

  // Table display
  if (chartType === 'table') {
    return (
      <ScrollArea className="max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead className="text-right">
                {METRIC_LABELS[series.metric]}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatValue(row.value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    );
  }

  // Pie chart
  if (chartType === 'pie') {
    const pieData = rows.map((row, idx) => ({
      name: row.label,
      value: row.value,
      fill: row.color ?? ZORU_CHART_PALETTE[idx % ZORU_CHART_PALETTE.length],
    }));
    return (
      <ZoruChartContainer height={280}>
        <Recharts.PieChart>
          <Recharts.Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {pieData.map((entry, idx) => (
              <Recharts.Cell key={`cell-${idx}`} fill={entry.fill} />
            ))}
          </Recharts.Pie>
          <Recharts.Tooltip
            content={(props) => (
              <ZoruChartTooltip
                active={props.active}
                payload={props.payload?.map((p) => ({
                  name: String(p.name ?? ''),
                  value: typeof p.value === 'number' ? p.value : 0,
                  color: String(p.payload?.fill ?? ''),
                  dataKey: String(p.dataKey ?? ''),
                }))}
              />
            )}
          />
        </Recharts.PieChart>
      </ZoruChartContainer>
    );
  }

  // Bar or Line chart
  const isLine = chartType === 'line';
  const chartData = rows.map((row) => ({ name: row.label, value: row.value }));

  return (
    <ZoruChartContainer height={280}>
      {isLine ? (
        <Recharts.LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <Recharts.CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--st-border)"
            vertical={false}
          />
          <Recharts.XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }}
            axisLine={{ stroke: 'var(--st-border)' }}
            tickLine={false}
          />
          <Recharts.YAxis
            tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatValue}
          />
          <Recharts.Tooltip
            content={(props) => (
              <ZoruChartTooltip
                active={props.active}
                payload={props.payload?.map((p) => ({
                  name: METRIC_LABELS[series.metric],
                  value: typeof p.value === 'number' ? p.value : 0,
                  color: ZORU_CHART_PALETTE[0],
                  dataKey: String(p.dataKey ?? ''),
                }))}
                label={props.label as string | undefined}
              />
            )}
          />
          <Recharts.Line
            type="monotone"
            dataKey="value"
            stroke={ZORU_CHART_PALETTE[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </Recharts.LineChart>
      ) : (
        <Recharts.BarChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <Recharts.CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--st-border)"
            vertical={false}
          />
          <Recharts.XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }}
            axisLine={{ stroke: 'var(--st-border)' }}
            tickLine={false}
          />
          <Recharts.YAxis
            tick={{ fontSize: 11, fill: 'var(--st-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatValue}
          />
          <Recharts.Tooltip
            content={(props) => (
              <ZoruChartTooltip
                active={props.active}
                payload={props.payload?.map((p) => ({
                  name: METRIC_LABELS[series.metric],
                  value: typeof p.value === 'number' ? p.value : 0,
                  color: ZORU_CHART_PALETTE[0],
                  dataKey: String(p.dataKey ?? ''),
                }))}
                label={props.label as string | undefined}
              />
            )}
          />
          <Recharts.Bar dataKey="value" fill={ZORU_CHART_PALETTE[0]} radius={[3, 3, 0, 0]} />
        </Recharts.BarChart>
      )}
    </ZoruChartContainer>
  );
}

/* -------------------------------------------------------------------------- */
/* Builder form fields (pure, uncontrolled-state-aware)                       */
/* -------------------------------------------------------------------------- */

interface BuilderFormProps {
  state: BuilderState;
  objects: ObjectMetadata[];
  onChange: (patch: Partial<BuilderState>) => void;
}

function BuilderForm({ state, objects, onChange }: BuilderFormProps) {
  const selectedObject = objects.find((o) => o.slug === state.object);
  const groupableFields = selectedObject?.fields.filter((f) =>
    GROUPABLE_FIELD_TYPES.has(f.type),
  ) ?? [];
  const numericFields = selectedObject?.fields.filter((f) =>
    NUMERIC_FIELD_TYPES.has(f.type),
  ) ?? [];
  const selectedGroupByField = selectedObject?.fields.find(
    (f) => f.key === state.groupByField,
  );
  const isDateGroupBy =
    selectedGroupByField !== undefined &&
    DATE_FIELD_TYPES.has(selectedGroupByField.type);

  // When object changes, reset dependent fields.
  function handleObjectChange(slug: string) {
    onChange({ object: slug, metricField: '', groupByField: '', filters: {} });
  }

  // When metric changes, reset metricField if switching to/from count.
  function handleMetricChange(metric: ReportMetric) {
    onChange({ metric, metricField: metric === 'count' ? '' : state.metricField });
  }

  // When groupBy changes, reset timeBucket default.
  function handleGroupByChange(field: string) {
    onChange({ groupByField: field, timeBucket: 'month' });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-name" className="text-sm font-medium text-[var(--st-text)]">
          Report name <span aria-hidden className="text-[var(--st-danger)]">*</span>
        </Label>
        <Input
          id="report-name"
          placeholder="e.g. Opportunities by stage"
          value={state.name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={120}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-desc" className="text-sm font-medium text-[var(--st-text)]">
          Description
        </Label>
        <Textarea
          id="report-desc"
          placeholder="Optional — what does this report show?"
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          maxLength={500}
        />
      </div>

      <Separator />

      {/* Object */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-[var(--st-text)]">
          Object <span aria-hidden className="text-[var(--st-danger)]">*</span>
        </Label>
        <Select value={state.object} onValueChange={handleObjectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an object…" />
          </SelectTrigger>
          <SelectContent>
            {objects.map((o) => (
              <SelectItem key={o.slug} value={o.slug}>
                {o.labelPlural}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metric */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-[var(--st-text)]">
          Metric <span aria-hidden className="text-[var(--st-danger)]">*</span>
        </Label>
        <Select
          value={state.metric}
          onValueChange={(v) => handleMetricChange(v as ReportMetric)}
        >
          <SelectTrigger>
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
      </div>

      {/* Metric field (only when metric ≠ count) */}
      {state.metric !== 'count' && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-[var(--st-text)]">
            Field to {METRIC_LABELS[state.metric].toLowerCase()}{' '}
            <span aria-hidden className="text-[var(--st-danger)]">*</span>
          </Label>
          <Select
            value={state.metricField}
            onValueChange={(v) => onChange({ metricField: v })}
            disabled={numericFields.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  numericFields.length === 0
                    ? 'No numeric fields on this object'
                    : 'Choose a numeric field…'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {numericFields.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      {/* Group by */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-[var(--st-text)]">
          Group by{' '}
          <span className="text-xs font-normal text-[var(--st-text-secondary)]">(optional)</span>
        </Label>
        <Select
          value={state.groupByField || '__none__'}
          onValueChange={(v) => handleGroupByChange(v === '__none__' ? '' : v)}
          disabled={groupableFields.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                groupableFields.length === 0
                  ? 'No groupable fields'
                  : 'None (single value)'
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None (single value)</SelectItem>
            {groupableFields.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Time bucket — only when groupBy is a date field */}
      {isDateGroupBy && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-[var(--st-text)]">Time bucket</Label>
          <Select
            value={state.timeBucket}
            onValueChange={(v) => onChange({ timeBucket: v as ReportTimeBucket })}
          >
            <SelectTrigger>
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
        </div>
      )}

      <Separator />

      {/* Chart type */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-[var(--st-text)]">Chart type</Label>
        <div className="grid grid-cols-5 gap-1">
          {(Object.keys(CHART_TYPE_LABELS) as ReportChartType[]).map((ct) => (
            <button
              key={ct}
              type="button"
              title={CHART_TYPE_LABELS[ct]}
              onClick={() => onChange({ chartType: ct })}
              className={cn(
                'flex flex-col items-center gap-1 rounded-[var(--st-radius-sm)] border p-2 text-xs transition-colors',
                state.chartType === ct
                  ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-bg)]'
                  : 'border-[var(--st-border)] text-[var(--st-text-secondary)] hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]',
              )}
            >
              {CHART_ICON[ct]}
              <span className="leading-none">{ct}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      {selectedObject && selectedObject.fields.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-medium text-[var(--st-text)]">
              Filters{' '}
              <span className="text-xs font-normal text-[var(--st-text-secondary)]">
                (exact match — optional)
              </span>
            </Label>
            {selectedObject.fields
              .filter(
                (f) =>
                  f.type === 'SELECT' ||
                  f.type === 'TEXT' ||
                  f.type === 'EMAIL' ||
                  f.type === 'BOOLEAN',
              )
              .slice(0, 5)
              .map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <Label
                    htmlFor={`filter-${f.key}`}
                    className="text-xs text-[var(--st-text-secondary)]"
                  >
                    {f.label}
                  </Label>
                  {f.type === 'SELECT' && f.options?.length ? (
                    <Select
                      value={state.filters[f.key] ?? '__any__'}
                      onValueChange={(v) =>
                        onChange({
                          filters: {
                            ...state.filters,
                            [f.key]: v === '__any__' ? '' : v,
                          },
                        })
                      }
                    >
                      <SelectTrigger id={`filter-${f.key}`}>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Any</SelectItem>
                        {f.options.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`filter-${f.key}`}
                      placeholder={`Filter by ${f.label.toLowerCase()}…`}
                      value={state.filters[f.key] ?? ''}
                      onChange={(e) =>
                        onChange({
                          filters: { ...state.filters, [f.key]: e.target.value },
                        })
                      }
                    />
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Builder dialog (create / edit)                                             */
/* -------------------------------------------------------------------------- */

interface BuilderDialogProps {
  objects: ObjectMetadata[];
  /** When set, editing an existing report. Otherwise creating a new one. */
  report?: SavedReport;
  trigger: React.ReactNode;
  onSaved: (report: SavedReport) => void;
}

function BuilderDialog({ objects, report, trigger, onSaved }: BuilderDialogProps) {
  const { toast } = useZoruToast();
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<BuilderState>(() =>
    report ? reportToBuilderState(report) : defaultBuilderState(),
  );
  const [preview, setPreview] = React.useState<ReportDataSeries | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset state when dialog opens / report changes.
  React.useEffect(() => {
    if (open) {
      setState(report ? reportToBuilderState(report) : defaultBuilderState());
      setPreview(null);
      setError(null);
    }
  }, [open, report]);

  function handleChange(patch: Partial<BuilderState>) {
    setState((prev) => ({ ...prev, ...patch }));
    // Clear preview when params change.
    setPreview(null);
  }

  async function handlePreview() {
    if (!state.object || !state.metric) {
      setError('Choose an object and metric before previewing.');
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const res = await runReportDefinitionAction(stateToCreateInput(state));
      if (!res.ok) {
        setError(res.error);
      } else {
        setPreview(res.data);
      }
    } catch {
      setError('Failed to preview report.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    if (!state.name.trim()) {
      setError('Report name is required.');
      return;
    }
    if (!state.object) {
      setError('Object is required.');
      return;
    }
    if (!state.metric) {
      setError('Metric is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let res;
      if (report) {
        res = await updateReportAction(report._id, stateToUpdatePatch(state));
      } else {
        res = await createReportAction(stateToCreateInput(state));
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast({
        title: report ? 'Report updated' : 'Report created',
        description: res.data.name,
      });
      onSaved(res.data);
      setOpen(false);
    } catch {
      setError('Failed to save report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>{trigger}</ZoruDialogTrigger>
      <ZoruDialogContent className="max-w-3xl p-0" aria-describedby="builder-desc">
        <div className="flex h-[90vh] max-h-[780px] flex-col">
          {/* Header */}
          <ZoruDialogHeader className="border-b border-[var(--st-border)] px-6 py-4">
            <ZoruDialogTitle>
              {report ? 'Edit report' : 'Build a report'}
            </ZoruDialogTitle>
            <ZoruDialogDescription id="builder-desc">
              {report
                ? "Update this report's definition. The target object cannot be changed — delete and re-create to switch objects."
                : 'Define the object, metric, grouping, and chart type. Preview before saving.'}
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          {/* Body — two-column: form + preview */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: form */}
            <ScrollArea className="w-72 shrink-0 border-r border-[var(--st-border)]">
              <div className="px-5 py-5">
                <BuilderForm
                  state={state}
                  objects={objects}
                  onChange={handleChange}
                />
              </div>
            </ScrollArea>

            {/* Right: preview */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--st-border)] px-5 py-3">
                <p className="text-sm font-medium text-[var(--st-text)]">Preview</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!state.object || !state.metric || previewing}
                  onClick={handlePreview}
                >
                  {previewing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Run preview
                </Button>
              </div>

              <ScrollArea className="flex-1 px-5 py-5">
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <ZoruAlertTitle>Error</ZoruAlertTitle>
                    <ZoruAlertDescription>{error}</ZoruAlertDescription>
                  </Alert>
                )}

                {preview ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-xs text-[var(--st-text-secondary)]">
                        {preview.recordCount} records · computed{' '}
                        {new Date(preview.computedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <ChartRenderer series={preview} chartType={state.chartType} />
                  </div>
                ) : (
                  !previewing && (
                    <EmptyState
                      compact
                      title="No preview yet"
                      description='Fill in the form and click "Run preview" to see your data.'
                    />
                  )
                )}

                {previewing && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Footer */}
          <ZoruDialogFooter className="border-t border-[var(--st-border)] px-6 py-4">
            <ZoruDialogClose asChild>
              <Button variant="outline" disabled={saving}>
                Cancel
              </Button>
            </ZoruDialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              {report ? 'Save changes' : 'Save report'}
            </Button>
          </ZoruDialogFooter>
        </div>
      </ZoruDialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Report viewer (inline run)                                                  */
/* -------------------------------------------------------------------------- */

interface ReportViewerProps {
  report: SavedReport;
}

function ReportViewer({ report }: ReportViewerProps) {
  const [series, setSeries] = React.useState<ReportDataSeries | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function runIt() {
    setLoading(true);
    setError(null);
    try {
      const res = await runReportAction(report._id);
      if (!res.ok) {
        setError(res.error);
      } else {
        setSeries(res.data);
      }
    } catch {
      setError('Failed to run report.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-run on first mount.
  React.useEffect(() => {
    runIt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report._id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {series && (
          <p className="text-xs text-[var(--st-text-secondary)]">
            {series.recordCount} records · computed{' '}
            {new Date(series.computedAt).toLocaleTimeString()}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={runIt}
          className="ml-auto"
        >
          <RefreshCw
            className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>Run failed</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {loading && !series && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
        </div>
      )}

      {series && (
        <ChartRenderer series={series} chartType={report.chartType ?? 'bar'} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Report card                                                                 */
/* -------------------------------------------------------------------------- */

interface ReportCardProps {
  report: SavedReport;
  objects: ObjectMetadata[];
  onUpdated: (r: SavedReport) => void;
  onDeleted: (id: string) => void;
}

function ReportCard({ report, objects, onUpdated, onDeleted }: ReportCardProps) {
  const { toast } = useZoruToast();
  const [expanded, setExpanded] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const objectMeta = objects.find((o) => o.slug === report.object);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await deleteReportAction(report._id);
      if (!res.ok) {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Report deleted', description: report.name });
        onDeleted(report._id);
      }
    } catch {
      toast({ title: 'Delete failed', description: 'Unexpected error.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-0 overflow-hidden p-0">
      {/* Header row */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
            {CHART_ICON[report.chartType ?? 'bar']}
          </span>
          <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
            <p className="truncate text-sm font-semibold text-[var(--st-text)]">
              {report.name}
            </p>
            {report.description && (
              <p className="truncate text-xs text-[var(--st-text-secondary)]">
                {report.description}
              </p>
            )}
          </div>
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 text-[var(--st-text-secondary)] transition-transform',
              expanded && 'rotate-90',
            )}
          />
        </button>

        {/* Badges */}
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {objectMeta?.labelPlural ?? report.object}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {METRIC_LABELS[report.metric]}
          </Badge>
          {report.groupByField && (
            <Badge variant="outline" className="text-xs">
              by{' '}
              {objectMeta?.fields.find((f) => f.key === report.groupByField)?.label ??
                report.groupByField}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <BuilderDialog
            objects={objects}
            report={report}
            trigger={
              <Button variant="ghost" size="icon" title="Edit report">
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit report</span>
              </Button>
            }
            onSaved={onUpdated}
          />

          <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Delete report"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-[var(--st-danger)]" />
                )}
                <span className="sr-only">Delete report</span>
              </Button>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
              <ZoruAlertDialogHeader>
                <ZoruAlertDialogTitle>Delete "{report.name}"?</ZoruAlertDialogTitle>
                <ZoruAlertDialogDescription>
                  This removes the saved report definition. The underlying records are
                  not affected. This action cannot be undone.
                </ZoruAlertDialogDescription>
              </ZoruAlertDialogHeader>
              <ZoruAlertDialogFooter>
                <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                <ZoruAlertDialogAction onClick={handleDelete}>
                  Delete
                </ZoruAlertDialogAction>
              </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
          </ZoruAlertDialog>
        </div>
      </div>

      {/* Expandable chart viewer */}
      {expanded && (
        <>
          <Separator />
          <div className="px-5 pb-5 pt-4">
            <ReportViewer report={report} />
          </div>
        </>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton loaders                                                            */
/* -------------------------------------------------------------------------- */

function ReportListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-[var(--st-radius-sm)]" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main client component                                                       */
/* -------------------------------------------------------------------------- */

export interface ReportsClientProps {
  /** Pre-fetched list of objects (standard + custom) for this project. */
  objects: ObjectMetadata[];
  /** Pre-fetched saved reports, newest first. */
  initialReports: SavedReport[];
  /** Error string from the initial reports fetch (gate fail, etc.). */
  initialError?: string;
}

export function ReportsClient({
  objects,
  initialReports,
  initialError,
}: ReportsClientProps) {
  const router = useRouter();
  const [reports, setReports] = React.useState<SavedReport[]>(initialReports);

  function handleCreated(r: SavedReport) {
    setReports((prev) => [r, ...prev]);
    router.refresh();
  }

  function handleUpdated(r: SavedReport) {
    setReports((prev) => prev.map((p) => (p._id === r._id ? r : p)));
    router.refresh();
  }

  function handleDeleted(id: string) {
    setReports((prev) => prev.filter((p) => p._id !== id));
    router.refresh();
  }

  if (initialError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <ZoruAlertTitle>Reports unavailable</ZoruAlertTitle>
        <ZoruAlertDescription>{initialError}</ZoruAlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--st-text-secondary)]">
          {reports.length === 0
            ? 'No reports saved yet.'
            : `${reports.length} report${reports.length === 1 ? '' : 's'}`}
        </p>
        <BuilderDialog
          objects={objects}
          trigger={
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New report
            </Button>
          }
          onSaved={handleCreated}
        />
      </div>

      {/* Report list */}
      {reports.length === 0 ? (
        <EmptyState
          icon={<BarChart2 />}
          title="No reports yet"
          description="Build your first report to visualise your CRM data — track counts, totals, and trends across any object."
          action={
            <BuilderDialog
              objects={objects}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Build a report
                </Button>
              }
              onSaved={handleCreated}
            />
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <ReportCard
              key={r._id}
              report={r}
              objects={objects}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
