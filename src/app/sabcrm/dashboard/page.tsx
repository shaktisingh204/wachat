'use client';

/**
 * SabCRM — Dashboard (Twenty-faithful).
 *
 * A live snapshot of pipeline, tasks, and record activity rendered entirely in
 * Twenty's visual language (`.st-*` classes + the colocated `dashboard.css`).
 * No ZoruUI, Tailwind, or clay — pure Twenty kit.
 *
 * Data comes from three server actions, all gated behind `sabcrm:view`:
 *   - `getKpisAction`      → the KPI card row
 *   - `runAnalyticsAction` → two horizontal bar-list breakdowns
 *
 * The engine may be down, the user may lack a project, or RBAC may deny access.
 * Every fetch failure is caught and surfaced as a calm empty/error panel — the
 * page never throws.
 */

import * as React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  CalendarClock,
  Sparkles,
  Building2,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  getKpisAction,
  runAnalyticsAction,
} from '@/app/actions/sabcrm.actions';
import type {
  CrmDashboardKpis,
  ObjectRecordCount,
  CountByFieldResult,
  SumByFieldResult,
} from '@/app/actions/sabcrm.actions.types';

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

/* -------------------------------------------------------------------------- */
/* Data shape                                                                  */
/* -------------------------------------------------------------------------- */

interface DashboardData {
  kpis: CrmDashboardKpis;
  /** Opportunities grouped by stage (count). Null when the query failed. */
  stageCount: CountByFieldResult | null;
  /** Pipeline value (sum of amount) grouped by stage. Null when it failed. */
  pipelineByStage: SumByFieldResult | null;
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
      const [kpisRes, stageCountRes, pipelineRes] = await Promise.all([
        getKpisAction(projectId),
        runAnalyticsAction(
          { kind: 'countByField', object: 'opportunities', fieldKey: 'stage' },
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
      ]);

      // KPIs are the spine of the page — if they fail, the page is unusable.
      if (!kpisRes.ok) {
        setState({ status: 'error', message: kpisRes.error });
        return;
      }

      // Analytics are supplementary: a failure degrades to an empty panel.
      const stageCount = stageCountRes.ok
        ? (stageCountRes.data as CountByFieldResult)
        : null;
      const pipelineByStage = pipelineRes.ok
        ? (pipelineRes.data as SumByFieldResult)
        : null;

      setState({
        status: 'ready',
        data: { kpis: kpisRes.data, stageCount, pipelineByStage },
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

  const { kpis, stageCount, pipelineByStage } = state.data;
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

      {/* Breakdowns */}
      <section className="st-dash-grid" aria-label="Breakdowns">
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
      </section>
    </div>
  );
}
