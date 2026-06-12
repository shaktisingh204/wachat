'use client';

/**
 * SabCRM — Report Builder (`/sabcrm/reports/builder`), 20ui.
 *
 * The report builder on the 20ui design system: PageHeader family for the
 * chrome, 20ui form primitives (Field / Input / Textarea / SelectField) for
 * the definition pane, and the shared charts composites (via `../report-chart`)
 * for the live preview. Page-local layout uses the `rp-*` classes in
 * `../reports.css` (scoped to the 20ui root).
 *
 * Two-pane canvas:
 *   - Left: the definition form — object, metric, metric field (sum/avg/min/max),
 *     group-by field, time bucket (for date group-bys), chart type, name +
 *     description.
 *   - Right: a live preview that re-runs the unsaved definition via
 *     `runReportDefinitionAction` whenever the definition changes (debounced),
 *     rendered as a Twenty bar list / single-value tile.
 *
 * Save routes through `saveReportAction` (create-or-update). When the page is
 * opened with `?id=<reportId>` it loads the existing definition via
 * `getReportAction` and saves as an update; otherwise it creates a new report.
 *
 * The object catalogue is loaded via `listObjectsAction`. Auth / onboarding /
 * RBACGuard are enforced by the parent SabCRM `layout.tsx`; each action re-runs
 * the full gate, so the page fails closed into an inline error state.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Save, BarChart3 } from 'lucide-react';

import {
  listObjectsAction,
  getReportAction,
  saveReportAction,
  runReportDefinitionAction,
} from '@/app/actions/sabcrm.actions';
import { useProject } from '@/context/project-context';
import type { ObjectMetadata, FieldMetadata, FieldType } from '@/lib/sabcrm/types';
import type {
  SavedReport,
  ReportDataSeries,
  ReportMetric,
  ReportChartType,
  ReportTimeBucket,
  SaveReportActionInput,
} from '@/app/actions/sabcrm.actions.types';

import { ReportChart } from '../report-chart';

import {
  Button,
  Field,
  Input,
  Textarea,
  SelectField,
  Alert,
  Spinner,
  Skeleton,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
} from '@/components/sabcrm/20ui';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import '../reports.css';

// ---------------------------------------------------------------------------
// Field-type predicates
// ---------------------------------------------------------------------------

const NUMERIC_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'NUMBER',
  'CURRENCY',
  'RATING',
]);

const DATE_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'DATE',
  'DATE_TIME',
]);

const GROUPABLE_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'SELECT',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
  'TEXT',
]);

const METRICS: ReadonlyArray<{ value: ReportMetric; label: string }> = [
  { value: 'count', label: 'Count of records' },
  { value: 'sum', label: 'Sum of a number field' },
  { value: 'avg', label: 'Average of a number field' },
  { value: 'min', label: 'Minimum of a number field' },
  { value: 'max', label: 'Maximum of a number field' },
];

const CHART_TYPES: ReadonlyArray<{ value: ReportChartType; label: string }> = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'pie', label: 'Pie' },
  { value: 'number', label: 'Single value' },
  { value: 'table', label: 'Table' },
];

const TIME_BUCKETS: ReadonlyArray<{ value: ReportTimeBucket; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

function metricNeedsField(m: ReportMetric): boolean {
  return m !== 'count';
}

// ---------------------------------------------------------------------------
// Draft state
// ---------------------------------------------------------------------------

interface Draft {
  id?: string;
  name: string;
  description: string;
  object: string;
  metric: ReportMetric;
  metricField: string;
  groupByField: string;
  timeBucket: ReportTimeBucket;
  chartType: ReportChartType;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  object: '',
  metric: 'count',
  metricField: '',
  groupByField: '',
  timeBucket: 'month',
  chartType: 'bar',
};

function draftFromReport(r: SavedReport): Draft {
  return {
    id: r._id,
    name: r.name,
    description: r.description ?? '',
    object: r.object,
    metric: r.metric,
    metricField: r.metricField ?? '',
    groupByField: r.groupByField ?? '',
    timeBucket: r.timeBucket ?? 'month',
    chartType: r.chartType ?? 'bar',
  };
}

function buildSaveInput(d: Draft): SaveReportActionInput {
  const input: SaveReportActionInput = {
    name: d.name.trim(),
    object: d.object,
    metric: d.metric,
    chartType: d.chartType,
  };
  if (d.id) input.id = d.id;
  if (d.description.trim()) input.description = d.description.trim();
  if (metricNeedsField(d.metric) && d.metricField) input.metricField = d.metricField;
  if (d.groupByField) input.groupByField = d.groupByField;
  return input;
}

// ---------------------------------------------------------------------------
// Preview visualisation — delegates to the shared Twenty chart renderer so the
// live preview matches exactly what the saved-reports run output will show,
// switching on the draft's `chartType` (bar / line / pie / number / table).
// ---------------------------------------------------------------------------

function PreviewSeries({
  series,
  chartType,
}: {
  series: ReportDataSeries;
  chartType: ReportChartType;
}): React.JSX.Element {
  return (
    <ReportChart
      series={series}
      chartType={chartType}
      metricCaption={`${series.metric} · ${series.recordCount} record(s)`}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmReportBuilderPage(): React.JSX.Element {
  const router = useRouter();
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState<string | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [preview, setPreview] = React.useState<ReportDataSeries | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const editingId = draft.id;

  // ---- Initial load: objects + (optional) existing report -----------------
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageError(null);

    const reportId =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('id')
        : null;

    void (async () => {
      const objRes = await listObjectsAction(activeProjectId ?? undefined);
      if (cancelled) return;

      if (!objRes.ok) {
        setPageError(objRes.error);
        setLoading(false);
        return;
      }
      setObjects(objRes.data);

      if (reportId) {
        const repRes = await getReportAction(reportId, activeProjectId ?? undefined);
        if (cancelled) return;
        if (repRes.ok) {
          setDraft(draftFromReport(repRes.data));
        } else {
          setPageError(repRes.error);
        }
      } else {
        // Seed object with the first available object for convenience.
        setDraft((prev) =>
          prev.object
            ? prev
            : { ...prev, object: objRes.data[0]?.slug ?? '' },
        );
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const selectedObject = React.useMemo<ObjectMetadata | null>(
    () => objects.find((o) => o.slug === draft.object) ?? null,
    [objects, draft.object],
  );

  const numericFields = React.useMemo<FieldMetadata[]>(
    () => (selectedObject?.fields ?? []).filter((f) => NUMERIC_TYPES.has(f.type)),
    [selectedObject],
  );

  const groupableFields = React.useMemo<FieldMetadata[]>(
    () => (selectedObject?.fields ?? []).filter((f) => GROUPABLE_TYPES.has(f.type)),
    [selectedObject],
  );

  const groupByIsDate = React.useMemo<boolean>(() => {
    const f = selectedObject?.fields.find((x) => x.key === draft.groupByField);
    return !!f && DATE_TYPES.has(f.type);
  }, [selectedObject, draft.groupByField]);

  const set = React.useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Reset dependent fields when the object changes.
  const handleObjectChange = React.useCallback((slug: string) => {
    setDraft((prev) => ({
      ...prev,
      object: slug,
      metricField: '',
      groupByField: '',
    }));
    setPreview(null);
    setPreviewError(null);
  }, []);

  // ---- Validity -----------------------------------------------------------
  const canPreview =
    !!draft.object &&
    !!draft.metric &&
    (!metricNeedsField(draft.metric) || !!draft.metricField);

  const canSave = canPreview && draft.name.trim().length > 0;

  // ---- Debounced live preview --------------------------------------------
  React.useEffect(() => {
    if (!canPreview) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    setPreviewError(null);

    const handle = setTimeout(() => {
      void (async () => {
        const res = await runReportDefinitionAction(
          {
            name: draft.name.trim() || 'Preview',
            object: draft.object,
            metric: draft.metric,
            ...(metricNeedsField(draft.metric) && draft.metricField
              ? { metricField: draft.metricField }
              : null),
            ...(draft.groupByField ? { groupByField: draft.groupByField } : null),
            ...(draft.groupByField && groupByIsDate
              ? { timeBucket: draft.timeBucket }
              : null),
            chartType: draft.chartType,
          },
          activeProjectId ?? undefined,
        );
        if (cancelled) return;
        if (res.ok) {
          setPreview(res.data);
        } else {
          setPreview(null);
          setPreviewError(res.error);
        }
        setPreviewing(false);
      })();
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // Re-run on any definition change.
  }, [
    canPreview,
    draft.object,
    draft.metric,
    draft.metricField,
    draft.groupByField,
    draft.timeBucket,
    draft.chartType,
    draft.name,
    groupByIsDate,
    activeProjectId,
  ]);

  // ---- Save ---------------------------------------------------------------
  const handleSave = React.useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    const res = await saveReportAction(
      buildSaveInput(draft),
      activeProjectId ?? undefined,
    );
    setSaving(false);
    if (res.ok) {
      router.push('/sabcrm/reports');
      router.refresh();
    } else {
      setSaveError(res.error);
    }
  }, [canSave, draft, activeProjectId, router]);

  return (
    <div className="rp-page">
      <div className="rp-page__inner">
      <Link href="/sabcrm/reports" className="rp-back">
        <ChevronLeft size={14} aria-hidden="true" />
        Reports
      </Link>

      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{editingId ? 'Edit report' : 'New report'}</PageTitle>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={saving ? undefined : Save}
            loading={saving}
            onClick={() => void handleSave()}
            disabled={!canSave || saving}
          >
            {saving ? 'Saving' : editingId ? 'Save changes' : 'Save report'}
          </Button>
        </PageActions>
      </PageHeader>

      {pageError && (
        <Alert tone="danger" className="rp-alert">
          {pageError}
        </Alert>
      )}

      {loading ? (
        <div className="rp-builder">
          <div className="rp-section">
            <div className="rp-stack">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={40} radius={8} />
              ))}
            </div>
          </div>
          <div className="rp-section">
            <Skeleton height={240} width="100%" radius={8} />
          </div>
        </div>
      ) : (
        <div className="rp-builder">
          {/* ── Definition form ──────────────────────────────────────────── */}
          <div className="rp-section">
            <div className="rp-section__head">
              <div>
                <h2 className="rp-section__title">Definition</h2>
                <p className="rp-section__desc">
                  Choose what to measure and how to break it down.
                </p>
              </div>
            </div>
            <div className="rp-stack">
              {/* Name */}
              <Field label="Name" required id="rep-name">
                <Input
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Open opportunities by stage"
                />
              </Field>

              {/* Object */}
              <Field
                label="Object"
                required
                id="rep-object"
                help={
                  editingId
                    ? 'The object cannot be changed on an existing report.'
                    : undefined
                }
              >
                <SelectField
                  value={draft.object || null}
                  onChange={(v) => handleObjectChange(v ?? '')}
                  disabled={!!editingId}
                  placeholder="Select an object"
                  options={objects.map((o) => ({
                    value: o.slug,
                    label: o.labelPlural,
                  }))}
                />
              </Field>

              {/* Metric */}
              <Field label="Metric" required id="rep-metric">
                <SelectField
                  value={draft.metric}
                  onChange={(v) => v && set('metric', v as ReportMetric)}
                  options={METRICS.map((m) => ({
                    value: m.value,
                    label: m.label,
                  }))}
                />
              </Field>

              {/* Metric field (only for sum/avg/min/max) */}
              {metricNeedsField(draft.metric) && (
                <Field
                  label="Number field"
                  required
                  id="rep-metric-field"
                  help={
                    numericFields.length === 0
                      ? 'This object has no number fields to aggregate.'
                      : undefined
                  }
                >
                  <SelectField
                    value={draft.metricField || null}
                    onChange={(v) => set('metricField', v ?? '')}
                    placeholder="Select a number field"
                    options={numericFields.map((f) => ({
                      value: f.key,
                      label: f.label,
                    }))}
                  />
                </Field>
              )}

              {/* Group by */}
              <Field label="Group by" id="rep-group">
                <SelectField
                  value={draft.groupByField}
                  onChange={(v) => set('groupByField', v ?? '')}
                  options={[
                    { value: '', label: 'No grouping (single value)' },
                    ...groupableFields.map((f) => ({
                      value: f.key,
                      label: f.label,
                    })),
                  ]}
                />
              </Field>

              {/* Time bucket (only when group-by is a date field) */}
              {draft.groupByField && groupByIsDate && (
                <Field label="Time bucket" id="rep-bucket">
                  <SelectField
                    value={draft.timeBucket}
                    onChange={(v) =>
                      v && set('timeBucket', v as ReportTimeBucket)
                    }
                    options={TIME_BUCKETS.map((t) => ({
                      value: t.value,
                      label: t.label,
                    }))}
                  />
                </Field>
              )}

              {/* Chart type */}
              <Field label="Visualisation" id="rep-chart">
                <SelectField
                  value={draft.chartType}
                  onChange={(v) => v && set('chartType', v as ReportChartType)}
                  options={CHART_TYPES.map((c) => ({
                    value: c.value,
                    label: c.label,
                  }))}
                />
              </Field>

              {/* Description */}
              <Field label="Description" id="rep-desc">
                <Textarea
                  value={draft.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Optional note on what this report tells you."
                />
              </Field>

              {saveError && <Alert tone="danger">{saveError}</Alert>}
            </div>
          </div>

          {/* ── Live preview ─────────────────────────────────────────────── */}
          <div className="rp-section">
            <div className="rp-section__head">
              <div>
                <h2 className="rp-section__title">Preview</h2>
                <p className="rp-section__desc">
                  Runs live against your data as you edit the definition.
                </p>
              </div>
              <div className="rp-section__head-actions">
                {previewing && <Spinner size="sm" label="Updating preview" />}
              </div>
            </div>
            <div>
              {!canPreview ? (
                <EmptyState
                  icon={BarChart3}
                  title="Nothing to preview yet"
                  description="Pick an object and metric (and a number field for sum, average, min, or max) to see a live preview."
                />
              ) : previewError ? (
                <Alert tone="danger">{previewError}</Alert>
              ) : preview ? (
                <PreviewSeries series={preview} chartType={draft.chartType} />
              ) : (
                <div className="rp-stack rp-stack--tight">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} height={40} radius={8} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
