'use client';

/**
 * SabCRM — Reports list (`/sabcrm/reports`), Twenty-style.
 *
 * A self-written Twenty-faithful rebuild of the saved-reports surface using the
 * shared `.st-*` kit (`src/styles/sabcrm-twenty.css`) plus the page-local extras
 * in `./reports-twenty.css`. No ZoruUI / Tailwind / clay in the page chrome.
 *
 * Behaviour parity with the previous ZoruUI version:
 *   - Lists saved reports for the active project (`listReportsAction`) — newest
 *     first, each with name, object chip and metric label.
 *   - "Run" executes a report inline (`runReportAction`) and renders the
 *     resulting series as a Twenty bar list (or a single-value tile for the
 *     `number`/un-grouped case).
 *   - "Delete" removes a report (`deleteReportAction`) with optimistic refresh.
 *   - "New report" / per-row "Edit" link to the builder page.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM `layout.tsx`;
 * every action re-runs the full session → project → RBAC → plan gate, so the
 * page fails closed into an inline error state.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Plus,
  Play,
  Trash2,
  Pencil,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

import {
  listObjectsAction,
  listReportsAction,
  runReportAction,
  deleteReportAction,
} from '@/app/actions/sabcrm.actions';
import { useProject } from '@/context/project-context';
import type { ObjectMetadata } from '@/lib/sabcrm/types';
import type {
  SavedReport,
  ReportDataSeries,
  ReportMetric,
} from '@/app/actions/sabcrm.actions.types';

import './reports-twenty.css';

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const METRIC_LABEL: Record<ReportMetric, string> = {
  count: 'Count',
  sum: 'Sum',
  avg: 'Average',
  min: 'Minimum',
  max: 'Maximum',
};

function metricCaption(report: SavedReport): string {
  const base = METRIC_LABEL[report.metric] ?? report.metric;
  if (report.metric !== 'count' && report.metricField) {
    return `${base} of ${report.metricField}`;
  }
  return base;
}

function formatValue(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

// ---------------------------------------------------------------------------
// Per-report run state
// ---------------------------------------------------------------------------

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'error'; error: string }
  | { status: 'done'; series: ReportDataSeries };

// ---------------------------------------------------------------------------
// Result visualisation (Twenty bar list / single value tile)
// ---------------------------------------------------------------------------

function ReportResult({
  report,
  series,
}: {
  report: SavedReport;
  series: ReportDataSeries;
}): React.JSX.Element {
  const single =
    !series.groupByField ||
    series.rows.length === 0 ||
    (series.rows.length === 1 && series.rows[0]?.key === '__total__');

  if (single) {
    const value = series.rows[0]?.value ?? 0;
    return (
      <div className="st-metric">
        <span className="st-metric__value">{formatValue(value)}</span>
        <span className="st-metric__caption">{metricCaption(report)}</span>
        <div className="st-result-foot">
          <span>{series.recordCount} record(s) matched</span>
        </div>
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

export default function SabcrmReportsPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [reports, setReports] = React.useState<SavedReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [runStates, setRunStates] = React.useState<Record<string, RunState>>({});
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [objRes, repRes] = await Promise.all([
      listObjectsAction(activeProjectId ?? undefined),
      listReportsAction(undefined, activeProjectId ?? undefined),
    ]);

    if (objRes.ok) setObjects(objRes.data);

    if (!repRes.ok) {
      setError(repRes.error);
      setReports([]);
    } else {
      setReports(repRes.data);
    }
    setLoading(false);
  }, [activeProjectId]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const objectLabel = React.useCallback(
    (slug: string): string =>
      objects.find((o) => o.slug === slug)?.labelPlural ?? slug,
    [objects],
  );

  const handleRun = React.useCallback(
    async (report: SavedReport) => {
      setRunStates((prev) => ({ ...prev, [report._id]: { status: 'running' } }));
      const res = await runReportAction(report._id, activeProjectId ?? undefined);
      setRunStates((prev) => ({
        ...prev,
        [report._id]: res.ok
          ? { status: 'done', series: res.data }
          : { status: 'error', error: res.error },
      }));
    },
    [activeProjectId],
  );

  const handleDelete = React.useCallback(
    async (report: SavedReport) => {
      if (
        typeof window !== 'undefined' &&
        !window.confirm(`Delete report "${report.name}"? This cannot be undone.`)
      ) {
        return;
      }
      setDeletingId(report._id);
      const res = await deleteReportAction(report._id, activeProjectId ?? undefined);
      setDeletingId(null);
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r._id !== report._id));
        setRunStates((prev) => {
          const next = { ...prev };
          delete next[report._id];
          return next;
        });
      } else {
        setError(res.error);
      }
    },
    [activeProjectId],
  );

  return (
    <div className="st-page">
      <header className="st-page-header">
        <span className="st-page-header__icon" aria-hidden="true">
          <BarChart3 size={16} />
        </span>
        <h1 className="st-page-header__title">Reports</h1>
        <div className="st-page-header__actions">
          <button
            type="button"
            className="st-btn st-btn--ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
          <Link href="/sabcrm/reports/builder" className="st-btn st-btn--primary">
            <Plus size={14} aria-hidden="true" />
            New report
          </Link>
        </div>
      </header>

      <p className="st-muted" style={{ marginBottom: 'var(--st-space-4)' }}>
        Build analytics across any CRM object — count records, sum values, and
        visualise trends by group. Results are computed live each time you run a
        report.
      </p>

      {error && (
        <div className="st-banner" role="alert">
          <AlertTriangle className="st-banner__icon" size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="st-section">
          <div className="st-section__body st-stack">
            {[0, 1, 2].map((i) => (
              <div key={i} className="st-skeleton st-skeleton-row" />
            ))}
          </div>
        </div>
      ) : reports.length === 0 && !error ? (
        <div className="st-section">
          <div className="st-empty">
            <span className="st-empty__icon" aria-hidden="true">
              <BarChart3 size={20} />
            </span>
            <h2 className="st-empty__title">No reports yet</h2>
            <p className="st-empty__desc">
              Create your first report to start measuring counts, sums, and
              trends across your CRM data.
            </p>
            <Link href="/sabcrm/reports/builder" className="st-btn st-btn--primary">
              <Plus size={14} aria-hidden="true" />
              New report
            </Link>
          </div>
        </div>
      ) : (
        <div className="st-section">
          {reports.map((report) => {
            const run = runStates[report._id] ?? { status: 'idle' };
            const isRunning = run.status === 'running';
            const isDeleting = deletingId === report._id;
            return (
              <React.Fragment key={report._id}>
                <div className="st-rep-row">
                  <div className="st-rep-row__main">
                    <span className="st-rep-row__title">{report.name}</span>
                    <div className="st-rep-row__meta">
                      <span className="st-chip">
                        <span className="st-chip__label">
                          {objectLabel(report.object)}
                        </span>
                      </span>
                      <span className="st-muted">{metricCaption(report)}</span>
                      {report.groupByField && (
                        <span className="st-muted">
                          · grouped by {report.groupByField}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="st-rep-row__actions">
                    <button
                      type="button"
                      className="st-btn st-btn--secondary"
                      onClick={() => void handleRun(report)}
                      disabled={isRunning}
                    >
                      {isRunning ? (
                        <span className="st-spinner" aria-hidden="true" />
                      ) : (
                        <Play size={14} aria-hidden="true" />
                      )}
                      {isRunning ? 'Running…' : 'Run'}
                    </button>
                    <Link
                      href={`/sabcrm/reports/builder?id=${encodeURIComponent(report._id)}`}
                      className="st-btn st-btn--ghost"
                      aria-label={`Edit ${report.name}`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="st-btn st-btn--ghost"
                      onClick={() => void handleDelete(report)}
                      disabled={isDeleting}
                      aria-label={`Delete ${report.name}`}
                    >
                      {isDeleting ? (
                        <span className="st-spinner" aria-hidden="true" />
                      ) : (
                        <Trash2 size={14} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {run.status === 'error' && (
                  <div className="st-rep-result">
                    <div className="st-iox-issue">
                      <AlertTriangle size={14} aria-hidden="true" />
                      <span>{run.error}</span>
                    </div>
                  </div>
                )}
                {run.status === 'done' && (
                  <div className="st-rep-result">
                    <ReportResult report={report} series={run.series} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
