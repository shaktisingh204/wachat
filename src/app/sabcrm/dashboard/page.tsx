'use client';

/**
 * SabCRM — Dashboard (Twenty-faithful).
 *
 * A live snapshot of pipeline, tasks, and record activity rendered entirely in
 * Twenty's visual language (`.st-*` classes + the colocated `dashboard.css`).
 * No ZoruUI, Tailwind, or clay — pure Twenty kit.
 *
 * Data comes from server actions, all gated behind `sabcrm:view`:
 *   - `getKpisAction`      → the KPI card row
 *   - `runAnalyticsAction` → stage / pipeline / month bar-list breakdowns
 *   - `listRecordsAction`  → the "Recent opportunities" widget
 *
 * The engine may be down, the user may lack a project, or RBAC may deny access.
 * KPIs are the spine: if they fail the whole page shows an error. Every other
 * widget degrades independently to a calm empty panel — one failing fetch never
 * takes down its neighbours, and the page never throws.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  TrendingUp,
  CalendarClock,
  Sparkles,
  Building2,
  Briefcase,
  AlertTriangle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  getKpisAction,
  runAnalyticsAction,
  listRecordsAction,
} from '@/app/actions/sabcrm.actions';
import type {
  CrmDashboardKpis,
  ObjectRecordCount,
  CountByFieldResult,
  SumByFieldResult,
  TimeSeriesResult,
  SabcrmRecordPage,
} from '@/app/actions/sabcrm.actions.types';
import type { CrmRecordWithLabel } from '@/lib/sabcrm/types';

import './dashboard.css';

/* -------------------------------------------------------------------------- */
/* Formatters                                                                  */
/* -------------------------------------------------------------------------- */

function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${formatNumber(n)}`;
}

/** Render an ISO `YYYY-MM-DD` bucket start as e.g. "Jan 2026". */
function formatMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Compact relative time ("3d", "5h", "just now") for a record timestamp. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

/** Up-to-two-letter initials for a record's avatar. */
function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0]}${parts[1]![0]}`;
}

/* -------------------------------------------------------------------------- */
/* Data shape                                                                  */
/* -------------------------------------------------------------------------- */

interface DashboardData {
  kpis: CrmDashboardKpis;
  /** Opportunities grouped by stage (count). Null when the query failed. */
  stageCount: CountByFieldResult | null;
  /** Pipeline value (sum of amount) grouped by stage. Null when it failed. */
  pipelineByStage: SumByFieldResult | null;
  /** Latest opportunities for the activity widget. Null when it failed. */
  recentOpportunities: CrmRecordWithLabel[] | null;
  /** New opportunities bucketed by month. Null when it failed. */
  oppsByMonth: TimeSeriesResult | null;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DashboardData };

/* -------------------------------------------------------------------------- */
/* KPI card                                                                    */
/* -------------------------------------------------------------------------- */

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'neutral';
}

function KpiCard({
  label,
  value,
  icon,
  delta,
  deltaTone = 'neutral',
}: KpiCardProps): React.JSX.Element {
  const deltaClass =
    deltaTone === 'up'
      ? 'st-kpi__delta st-kpi__delta--up'
      : deltaTone === 'down'
        ? 'st-kpi__delta st-kpi__delta--down'
        : 'st-kpi__delta';
  return (
    <div className="st-kpi">
      <span className="st-kpi__label">
        <span className="st-kpi__label-icon" aria-hidden="true">
          {icon}
        </span>
        {label}
      </span>
      <span className="st-kpi__value">{value}</span>
      {delta ? <span className={deltaClass}>{delta}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bar list (Twenty breakdown)                                                 */
/* -------------------------------------------------------------------------- */

interface BarRow {
  key: string;
  label: string;
  /** Numeric magnitude used to size the bar. */
  weight: number;
  /** Pre-formatted display string shown on the right. */
  display: string;
}

interface BarListPanelProps {
  title: string;
  rows: BarRow[];
  emptyLabel: string;
}

function BarListPanel({
  title,
  rows,
  emptyLabel,
}: BarListPanelProps): React.JSX.Element {
  const max = rows.reduce((m, r) => Math.max(m, r.weight), 0);
  return (
    <div className="st-panel">
      <div className="st-panel__head">{title}</div>
      {rows.length === 0 ? (
        <div className="st-timeline-empty">{emptyLabel}</div>
      ) : (
        <div className="st-barlist">
          {rows.map((row) => {
            const pct = max > 0 ? Math.max(2, (row.weight / max) * 100) : 0;
            return (
              <div className="st-barlist__row" key={row.key}>
                <div className="st-barlist__head">
                  <span className="st-barlist__label">{row.label}</span>
                  <span className="st-barlist__value">{row.display}</span>
                </div>
                <div
                  className="st-barlist__track"
                  role="meter"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${row.label}: ${row.display}`}
                >
                  <span
                    className="st-barlist__fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent records widget                                                       */
/* -------------------------------------------------------------------------- */

interface RecentRecordsPanelProps {
  title: string;
  /** Null signals the query failed (vs. an empty array = no records). */
  records: CrmRecordWithLabel[] | null;
  emptyLabel: string;
}

function RecentRecordsPanel({
  title,
  records,
  emptyLabel,
}: RecentRecordsPanelProps): React.JSX.Element {
  return (
    <div className="st-panel">
      <div className="st-panel__head">{title}</div>
      {records === null ? (
        <div className="st-timeline-empty">
          This widget could not be loaded.
        </div>
      ) : records.length === 0 ? (
        <div className="st-timeline-empty">{emptyLabel}</div>
      ) : (
        <ul className="st-reclist">
          {records.map((record) => {
            const label = record.label || 'Untitled';
            return (
              <li className="st-reclist__row" key={record._id}>
                <Link
                  href={`/sabcrm/${record.object}/${record._id}`}
                  className="st-reclist__link"
                >
                  <span className="st-avatar st-avatar--sm" aria-hidden="true">
                    {initials(label)}
                  </span>
                  <span className="st-reclist__label">{label}</span>
                  <span className="st-reclist__meta">
                    <Clock size={11} aria-hidden="true" />
                    {formatRelative(record.createdAt)}
                  </span>
                  <ArrowUpRight
                    className="st-reclist__chevron"
                    size={13}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pipeline summary widget                                                     */
/* -------------------------------------------------------------------------- */

interface PipelineSummaryPanelProps {
  pipeline: SumByFieldResult | null;
}

function PipelineSummaryPanel({
  pipeline,
}: PipelineSummaryPanelProps): React.JSX.Element {
  const buckets = (pipeline?.buckets ?? []).filter((b) => b.sum > 0);
  const total = pipeline?.total ?? 0;
  return (
    <div className="st-panel">
      <div className="st-panel__head">Pipeline summary</div>
      {pipeline === null ? (
        <div className="st-timeline-empty">
          This widget could not be loaded.
        </div>
      ) : buckets.length === 0 ? (
        <div className="st-timeline-empty">No pipeline value recorded yet.</div>
      ) : (
        <div className="st-pipesum">
          <div className="st-pipesum__total">
            <span className="st-pipesum__total-label">Total pipeline</span>
            <span className="st-pipesum__total-value">
              {formatCurrency(total)}
            </span>
          </div>
          <ul className="st-pipesum__stages">
            {buckets.map((b) => {
              const pct = total > 0 ? Math.round((b.sum / total) * 100) : 0;
              return (
                <li className="st-pipesum__stage" key={b.value || '∅'}>
                  <span className="st-pipesum__stage-label">{b.label}</span>
                  <span className="st-pipesum__stage-value">
                    {formatCurrency(b.sum)}
                  </span>
                  <span className="st-pipesum__stage-pct">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton + error states                                                     */
/* -------------------------------------------------------------------------- */

function DashboardSkeleton(): React.JSX.Element {
  return (
    <>
      <div className="st-dash-kpis" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="st-skeleton st-skel-kpi" />
        ))}
      </div>
      <div className="st-dash-grid" aria-hidden="true">
        <div className="st-skeleton st-skel-panel" />
        <div className="st-skeleton st-skel-panel" />
      </div>
    </>
  );
}

function DashboardError({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="st-empty">
      <span className="st-empty__icon" aria-hidden="true">
        <AlertTriangle size={20} />
      </span>
      <h2 className="st-empty__title">Dashboard unavailable</h2>
      <p className="st-empty__desc">{message}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function SabcrmDashboardPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });

  const load = React.useCallback(async (projectId: string) => {
    setState({ status: 'loading' });
    try {
      const [kpisRes, stageCountRes, pipelineRes, recentRes, byMonthRes] =
        await Promise.all([
          getKpisAction(projectId),
          runAnalyticsAction(
            {
              kind: 'countByField',
              object: 'opportunities',
              fieldKey: 'stage',
            },
            projectId,
          ),
          runAnalyticsAction(
            {
              kind: 'sumByField',
              object: 'opportunities',
              groupFieldKey: 'stage',
              sumFieldKey: 'amount',
            },
            projectId,
          ),
          listRecordsAction(
            {
              object: 'opportunities',
              page: 1,
              pageSize: 5,
              sortBy: 'createdAt',
              sortDir: 'desc',
            },
            projectId,
          ),
          runAnalyticsAction(
            {
              kind: 'timeSeries',
              object: 'opportunities',
              dateField: 'createdAt',
              interval: 'month',
            },
            projectId,
          ),
        ]);

      // KPIs are the spine of the page — if they fail, the page is unusable.
      if (!kpisRes.ok) {
        setState({ status: 'error', message: kpisRes.error });
        return;
      }

      // Everything else is supplementary: a failure degrades that widget to an
      // empty panel rather than taking down the whole dashboard.
      const stageCount = stageCountRes.ok
        ? (stageCountRes.data as CountByFieldResult)
        : null;
      const pipelineByStage = pipelineRes.ok
        ? (pipelineRes.data as SumByFieldResult)
        : null;
      const recentOpportunities = recentRes.ok
        ? (recentRes.data as SabcrmRecordPage).records
        : null;
      const oppsByMonth = byMonthRes.ok
        ? (byMonthRes.data as TimeSeriesResult)
        : null;

      setState({
        status: 'ready',
        data: {
          kpis: kpisRes.data,
          stageCount,
          pipelineByStage,
          recentOpportunities,
          oppsByMonth,
        },
      });
    } catch {
      setState({
        status: 'error',
        message:
          'The CRM service did not respond. Check your connection and try again.',
      });
    }
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setState({
        status: 'error',
        message: 'Select a project to view its CRM dashboard.',
      });
      return;
    }
    void load(activeProjectId);
  }, [activeProjectId, isLoadingProject, load]);

  /* ----- Render ----- */

  const header = (
    <TwentyPageHeader title="Dashboard" icon={LayoutDashboard} />
  );

  if (isLoadingProject || state.status === 'loading') {
    return (
      <div className="st-page">
        {header}
        <DashboardSkeleton />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="st-page">
        {header}
        <DashboardError message={state.message} />
      </div>
    );
  }

  const {
    kpis,
    stageCount,
    pipelineByStage,
    recentOpportunities,
    oppsByMonth,
  } = state.data;
  const { opportunities, tasks, newThisWeek, recordCounts } = kpis;

  // Largest object by record count, for a representative KPI card.
  const topObject: ObjectRecordCount | undefined = recordCounts
    .slice()
    .sort((a, b) => b.count - a.count)[0];

  const stageRows: BarRow[] = (stageCount?.buckets ?? []).map((b) => ({
    key: b.value || '∅',
    label: b.label,
    weight: b.count,
    display: formatNumber(b.count),
  }));

  const pipelineRows: BarRow[] = (pipelineByStage?.buckets ?? [])
    .filter((b) => b.sum > 0)
    .map((b) => ({
      key: b.value || '∅',
      label: b.label,
      weight: b.sum,
      display: formatCurrency(b.sum),
    }));

  // Show the most recent 6 months of opportunity creation, oldest → newest.
  const monthRows: BarRow[] = (oppsByMonth?.points ?? [])
    .slice(-6)
    .map((p) => ({
      key: p.date,
      label: formatMonth(p.date),
      weight: p.count,
      display: formatNumber(p.count),
    }));

  return (
    <div className="st-page">
      {header}

      {/* KPI row */}
      <section className="st-dash-kpis" aria-label="Key performance indicators">
        <KpiCard
          label="Open pipeline"
          value={formatCurrency(opportunities.pipelineValue)}
          icon={<TrendingUp size={14} />}
          delta={`${formatNumber(opportunities.openCount)} open ${
            opportunities.openCount === 1 ? 'opportunity' : 'opportunities'
          }`}
        />
        <KpiCard
          label="Tasks due today"
          value={formatNumber(tasks.dueToday)}
          icon={<CalendarClock size={14} />}
          delta={
            tasks.overdue > 0
              ? `${formatNumber(tasks.overdue)} overdue`
              : `${formatNumber(tasks.totalOpen)} open`
          }
          deltaTone={tasks.overdue > 0 ? 'down' : 'neutral'}
        />
        <KpiCard
          label="New this week"
          value={formatNumber(newThisWeek.count)}
          icon={<Sparkles size={14} />}
          delta="records created"
          deltaTone={newThisWeek.count > 0 ? 'up' : 'neutral'}
        />
        <KpiCard
          label={topObject ? topObject.labelPlural : 'Records'}
          value={formatNumber(topObject ? topObject.count : 0)}
          icon={
            topObject?.slug === 'companies' ? (
              <Building2 size={14} />
            ) : (
              <Briefcase size={14} />
            )
          }
          delta="total records"
        />
      </section>

      {/* Widget grid — each widget loads/empties/fails independently. */}
      <section className="st-dash-grid" aria-label="Breakdowns">
        <RecentRecordsPanel
          title="Recent opportunities"
          records={recentOpportunities}
          emptyLabel="No opportunities created yet."
        />
        <PipelineSummaryPanel pipeline={pipelineByStage} />
        <BarListPanel
          title="Opportunities by stage"
          rows={stageRows}
          emptyLabel="No opportunities to break down yet."
        />
        <BarListPanel
          title="Pipeline value by stage"
          rows={pipelineRows}
          emptyLabel="No pipeline value recorded yet."
        />
        <BarListPanel
          title="New opportunities by month"
          rows={monthRows}
          emptyLabel="No opportunity history yet."
        />
      </section>
    </div>
  );
}
