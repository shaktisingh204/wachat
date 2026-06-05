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
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Plus,
  Play,
  Trash2,
  Pencil,
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

import { ReportChart } from './report-chart';

import { useStConfirm } from '@/components/sabcrm/twenty/st-modals';
import {
  Button,
  IconButton,
  Badge,
  Alert,
  Spinner,
  Skeleton,
  EmptyState,
} from '@/components/sabcrm/20ui';

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

// ---------------------------------------------------------------------------
// Per-report run state
// ---------------------------------------------------------------------------

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'error'; error: string }
  | { status: 'done'; series: ReportDataSeries };

// ---------------------------------------------------------------------------
// Result visualisation — delegates to the shared Twenty chart renderer,
// switching on the report's `chartType` (bar / line / pie / number / table).
// ---------------------------------------------------------------------------

function ReportResult({
  report,
  series,
}: {
  report: SavedReport;
  series: ReportDataSeries;
}): React.JSX.Element {
  return (
    <ReportChart
      series={series}
      chartType={report.chartType ?? 'bar'}
      metricCaption={metricCaption(report)}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmReportsPage(): React.JSX.Element {
  const router = useRouter();
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [reports, setReports] = React.useState<SavedReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [runStates, setRunStates] = React.useState<Record<string, RunState>>({});
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const { confirm, dialog: confirmDialog } = useStConfirm();

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
      const ok = await confirm({
        title: 'Delete report?',
        message: `Delete "${report.name}"? This cannot be undone.`,
        destructive: true,
        confirmLabel: 'Delete',
      });
      if (!ok) return;
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
    [activeProjectId, confirm],
  );

  return (
    <div className="st-page">
      <header className="st-page-header">
        <span className="st-page-header__icon" aria-hidden="true">
          <BarChart3 size={16} />
        </span>
        <h1 className="st-page-header__title">Reports</h1>
        <div className="st-page-header__actions">
          <Button
            variant="ghost"
            iconLeft={RefreshCw}
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => router.push('/sabcrm/reports/builder')}
          >
            New report
          </Button>
        </div>
      </header>

      <p className="st-muted" style={{ marginBottom: 'var(--st-space-4)' }}>
        Build analytics across any CRM object — count records, sum values, and
        visualise trends by group. Results are computed live each time you run a
        report.
      </p>

      {error && (
        <Alert tone="danger" style={{ marginBottom: 'var(--st-space-4)' }}>
          {error}
        </Alert>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="st-section">
          <div className="st-section__body st-stack">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={40} radius={8} />
            ))}
          </div>
        </div>
      ) : reports.length === 0 && !error ? (
        <div className="st-section">
          <EmptyState
            icon={BarChart3}
            title="No reports yet"
            description="Create your first report to start measuring counts, sums, and trends across your CRM data."
            action={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => router.push('/sabcrm/reports/builder')}
              >
                New report
              </Button>
            }
          />
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
                      <Badge tone="neutral">{objectLabel(report.object)}</Badge>
                      <span className="st-muted">{metricCaption(report)}</span>
                      {report.groupByField && (
                        <span className="st-muted">
                          · grouped by {report.groupByField}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="st-rep-row__actions">
                    <Button
                      variant="secondary"
                      iconLeft={isRunning ? undefined : Play}
                      loading={isRunning}
                      onClick={() => void handleRun(report)}
                      disabled={isRunning}
                    >
                      {isRunning ? 'Running' : 'Run'}
                    </Button>
                    <IconButton
                      variant="ghost"
                      icon={Pencil}
                      label={`Edit ${report.name}`}
                      onClick={() =>
                        router.push(
                          `/sabcrm/reports/builder?id=${encodeURIComponent(report._id)}`,
                        )
                      }
                    />
                    {isDeleting ? (
                      <span
                        className="st-rep-row__busy"
                        role="status"
                        aria-label={`Deleting ${report.name}`}
                      >
                        <Spinner size="sm" label="Deleting" />
                      </span>
                    ) : (
                      <IconButton
                        variant="ghost"
                        icon={Trash2}
                        label={`Delete ${report.name}`}
                        onClick={() => void handleDelete(report)}
                      />
                    )}
                  </div>
                </div>

                {run.status === 'error' && (
                  <div className="st-rep-result">
                    <Alert tone="danger">{run.error}</Alert>
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
      {confirmDialog}
    </div>
  );
}
