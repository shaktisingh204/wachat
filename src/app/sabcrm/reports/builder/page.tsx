'use client';

/**
 * SabCRM — Report Builder (`/sabcrm/reports/builder`), Twenty-style.
 *
 * A self-written Twenty-faithful rebuild of the report builder using the shared
 * `.st-*` kit (`src/styles/sabcrm-twenty.css`) plus the page-local extras in
 * `../reports-twenty.css`. No ZoruUI / Tailwind / clay in the page chrome.
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
import { ChevronLeft, AlertTriangle, Save, BarChart3 } from 'lucide-react';

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

import '../reports-twenty.css';

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

function formatValue(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

// ---------------------------------------------------------------------------
// Preview visualisation
// ---------------------------------------------------------------------------

function PreviewSeries({ series }: { series: ReportDataSeries }): React.JSX.Element {
  const single =
    !series.groupByField ||
    series.rows.length === 0 ||
    (series.rows.length === 1 && series.rows[0]?.key === '__total__');

  if (single) {
    const value = series.rows[0]?.value ?? 0;
    return (
      <div className="st-metric">
        <span className="st-metric__value">{formatValue(value)}</span>
        <span className="st-metric__caption">
          {series.metric} · {series.recordCount} record(s)
        </span>
      </div>
    );
  }

  const max = series.rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  return (
    <div>
      <div className="st-bars">
        {series.rows.map((row) => {
          const pct = Math.max(2, Math.round((row.value / max) * 100));
          return (
            <div className="st-bar" key={row.key}>
              <span className="st-bar__label" title={row.label}>
                {row.label}
              </span>
              <span className="st-bar__track">
                <span
                  className="st-bar__fill"
                  style={{
                    width: `${pct}%`,
                    ...(row.color ? { background: row.color } : null),
                  }}
                />
              </span>
              <span className="st-bar__value">{formatValue(row.value)}</span>
            </div>
          );
        })}
      </div>
      <div className="st-result-foot">
        <span>
          {series.rows.length} group(s) · {series.recordCount} record(s) matched
        </span>
      </div>
    </div>
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
    <div className="st-page">
      <Link href="/sabcrm/reports" className="st-back">
        <ChevronLeft size={14} aria-hidden="true" />
        Reports
      </Link>

      <header className="st-page-header">
        <span className="st-page-header__icon" aria-hidden="true">
          <BarChart3 size={16} />
        </span>
        <h1 className="st-page-header__title">
          {editingId ? 'Edit report' : 'New report'}
        </h1>
        <div className="st-page-header__actions">
          <button
            type="button"
            className="st-btn st-btn--primary"
            onClick={() => void handleSave()}
            disabled={!canSave || saving}
          >
            {saving ? (
              <span className="st-spinner" aria-hidden="true" />
            ) : (
              <Save size={14} aria-hidden="true" />
            )}
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save report'}
          </button>
        </div>
      </header>

      {pageError && (
        <div className="st-banner" role="alert">
          <AlertTriangle className="st-banner__icon" size={16} aria-hidden="true" />
          <span>{pageError}</span>
        </div>
      )}

      {loading ? (
        <div className="st-builder">
          <div className="st-section">
            <div className="st-section__body st-stack">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="st-skeleton st-skeleton-row" />
              ))}
            </div>
          </div>
          <div className="st-section">
            <div className="st-section__body">
              <div className="st-skeleton" style={{ height: 240, width: '100%' }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="st-builder">
          {/* ── Definition form ──────────────────────────────────────────── */}
          <div className="st-section">
            <div className="st-section__head">
              <div className="st-section__head-text">
                <h2 className="st-section__title">Definition</h2>
                <p className="st-section__desc">
                  Choose what to measure and how to break it down.
                </p>
              </div>
            </div>
            <div className="st-section__body st-stack">
              {/* Name */}
              <div className="st-field">
                <label className="st-field__label" htmlFor="rep-name">
                  Name <span className="st-field__req">*</span>
                </label>
                <input
                  id="rep-name"
                  className="st-input"
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Open opportunities by stage"
                />
              </div>

              {/* Object */}
              <div className="st-field">
                <label className="st-field__label" htmlFor="rep-object">
                  Object <span className="st-field__req">*</span>
                </label>
                <select
                  id="rep-object"
                  className="st-select"
                  value={draft.object}
                  onChange={(e) => handleObjectChange(e.target.value)}
                  disabled={!!editingId}
                >
                  <option value="" disabled>
                    Select an object…
                  </option>
                  {objects.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.labelPlural}
                    </option>
                  ))}
                </select>
                {editingId && (
                  <span className="st-field__hint">
                    The object can&apos;t be changed on an existing report.
                  </span>
                )}
              </div>

              {/* Metric */}
              <div className="st-field">
                <label className="st-field__label" htmlFor="rep-metric">
                  Metric <span className="st-field__req">*</span>
                </label>
                <select
                  id="rep-metric"
                  className="st-select"
                  value={draft.metric}
                  onChange={(e) => set('metric', e.target.value as ReportMetric)}
                >
                  {METRICS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Metric field (only for sum/avg/min/max) */}
              {metricNeedsField(draft.metric) && (
                <div className="st-field">
                  <label className="st-field__label" htmlFor="rep-metric-field">
                    Number field <span className="st-field__req">*</span>
                  </label>
                  <select
                    id="rep-metric-field"
                    className="st-select"
                    value={draft.metricField}
                    onChange={(e) => set('metricField', e.target.value)}
                  >
                    <option value="" disabled>
                      Select a number field…
                    </option>
                    {numericFields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  {numericFields.length === 0 && (
                    <span className="st-field__hint">
                      This object has no number fields to aggregate.
                    </span>
                  )}
                </div>
              )}

              {/* Group by */}
              <div className="st-field">
                <label className="st-field__label" htmlFor="rep-group">
                  Group by
                </label>
                <select
                  id="rep-group"
                  className="st-select"
                  value={draft.groupByField}
                  onChange={(e) => set('groupByField', e.target.value)}
                >
                  <option value="">No grouping (single value)</option>
                  {groupableFields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time bucket (only when group-by is a date field) */}
              {draft.groupByField && groupByIsDate && (
                <div className="st-field">
                  <label className="st-field__label" htmlFor="rep-bucket">
                    Time bucket
                  </label>
                  <select
                    id="rep-bucket"
                    className="st-select"
                    value={draft.timeBucket}
                    onChange={(e) =>
                      set('timeBucket', e.target.value as ReportTimeBucket)
                    }
                  >
                    {TIME_BUCKETS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Chart type */}
              <div className="st-field">
                <label className="st-field__label" htmlFor="rep-chart">
                  Visualisation
                </label>
                <select
                  id="rep-chart"
                  className="st-select"
                  value={draft.chartType}
                  onChange={(e) => set('chartType', e.target.value as ReportChartType)}
                >
                  {CHART_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="st-field">
                <label className="st-field__label" htmlFor="rep-desc">
                  Description
                </label>
                <textarea
                  id="rep-desc"
                  className="st-textarea"
                  value={draft.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Optional — what this report tells you."
                />
              </div>

              {saveError && (
                <div className="st-iox-issue">
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>{saveError}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Live preview ─────────────────────────────────────────────── */}
          <div className="st-section">
            <div className="st-section__head">
              <div className="st-section__head-text">
                <h2 className="st-section__title">Preview</h2>
                <p className="st-section__desc">
                  Runs live against your data as you edit the definition.
                </p>
              </div>
              <div className="st-section__head-actions">
                {previewing && <span className="st-spinner" aria-hidden="true" />}
              </div>
            </div>
            <div className="st-section__body">
              {!canPreview ? (
                <div className="st-empty">
                  <span className="st-empty__icon" aria-hidden="true">
                    <BarChart3 size={20} />
                  </span>
                  <p className="st-empty__desc">
                    Pick an object and metric (and a number field for
                    sum/average/min/max) to see a live preview.
                  </p>
                </div>
              ) : previewError ? (
                <div className="st-iox-issue">
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>{previewError}</span>
                </div>
              ) : preview ? (
                <PreviewSeries series={preview} />
              ) : (
                <div className="st-stack st-stack--tight">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="st-skeleton st-skeleton-row" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
