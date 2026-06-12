'use client';

/**
 * SabCRM — Reports list (`/sabcrm/reports`), 20ui.
 *
 * The saved-reports surface on the 20ui design system: PageHeader family for
 * the chrome, 20ui primitives (Button / Badge / Alert / Skeleton / EmptyState)
 * for the gallery, and the shared charts composites (via `./report-chart`) for
 * inline run results. Page-local layout uses the `rp-*` classes in
 * `./reports.css` (scoped to the 20ui root).
 *
 * Behaviour:
 *   - Lists saved reports for the active project (`listReportsAction`) — newest
 *     first, each with name, object chip and metric label.
 *   - "Run" executes a report inline (`runReportAction`) and renders the
 *     resulting series through the shared `ReportChart` renderer.
 *   - "Delete" removes a report (`deleteReportAction`) behind a 20ui confirm.
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

import {
  Button,
  IconButton,
  Badge,
  Alert,
  Spinner,
  Skeleton,
  EmptyState,
  Modal,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './reports.css';

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
// Result visualisation — delegates to the shared chart renderer, switching on
// the report's `chartType` (bar / line / pie / number / table).
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
  const [pendingDelete, setPendingDelete] = React.useState<SavedReport | null>(
    null,
  );

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

  const handleDeleteConfirmed = React.useCallback(async () => {
    const report = pendingDelete;
    setPendingDelete(null);
    if (!report) return;
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
  }, [pendingDelete, activeProjectId]);

  return (
    <div className="rp-page">
      <div className="rp-page__inner">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Reports</PageTitle>
            <PageDescription>
              Build analytics across any CRM object — count records, sum values,
              and visualise trends by group. Results are computed live each time
              you run a report.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={RefreshCw}
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              onClick={() => router.push('/sabcrm/reports/builder')}
            >
              New report
            </Button>
          </PageActions>
        </PageHeader>

        {error && (
          <Alert tone="danger" className="rp-alert">
            {error}
          </Alert>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="rp-section">
            <div className="rp-stack">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={40} radius={8} />
              ))}
            </div>
          </div>
        ) : reports.length === 0 && !error ? (
          <div className="rp-section">
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
          <div className="rp-section">
            {reports.map((report) => {
              const run = runStates[report._id] ?? { status: 'idle' };
              const isRunning = run.status === 'running';
              const isDeleting = deletingId === report._id;
              return (
                <React.Fragment key={report._id}>
                  <div className="rp-row">
                    <div className="rp-row__main">
                      <span className="rp-row__title">{report.name}</span>
                      <div className="rp-row__meta">
                        <Badge tone="neutral">{objectLabel(report.object)}</Badge>
                        <span className="rp-muted">{metricCaption(report)}</span>
                        {report.groupByField && (
                          <span className="rp-muted">
                            · grouped by {report.groupByField}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rp-row__actions">
                      <Button
                        variant="secondary"
                        size="sm"
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
                          className="rp-row__busy"
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
                          onClick={() => setPendingDelete(report)}
                        />
                      )}
                    </div>
                  </div>

                  {run.status === 'error' && (
                    <div className="rp-result">
                      <Alert tone="danger">{run.error}</Alert>
                    </div>
                  )}
                  {run.status === 'done' && (
                    <div className="rp-result">
                      <ReportResult report={report} series={run.series} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {pendingDelete ? (
          <Modal
            open
            onClose={() => setPendingDelete(null)}
            title="Delete report?"
            size="sm"
            footer={
              <>
                <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleDeleteConfirmed()}
                >
                  Delete
                </Button>
              </>
            }
          >
            <p className="rp-confirm-text">
              Delete &quot;{pendingDelete.name}&quot;? This cannot be undone.
            </p>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}
