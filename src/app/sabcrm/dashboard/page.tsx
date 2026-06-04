'use client';

/**
 * SabCRM — Dashboard (Twenty-faithful), now with SAVED dashboards.
 *
 * Two layers share this page:
 *
 *  1. "Overview" — a built-in, non-deletable analytics view (the original fixed
 *     KPI + breakdown dashboard). It always exists, even with zero saved
 *     dashboards, so the page is never empty.
 *
 *  2. Saved dashboards — user-defined `{ id, name, widgets:[{id,type,title,config}] }`
 *     documents loaded from `@/app/actions/sabcrm-dashboards.actions`. Each is a
 *     grid of editable widgets (`kpi`, `bar`, `recent`, `pipeline`) that each
 *     fetch + render in isolation via `WidgetTile`.
 *
 * A selector (tabs + a "+" new-dashboard control) switches between them. For a
 * saved dashboard the user can rename, delete, toggle edit mode, add widgets
 * (object/field/metric picker) and remove widgets — all persisted through
 * `createDashboardTw` / `updateDashboardTw` / `deleteDashboardTw`.
 *
 * Everything degrades gracefully: the dashboard list failing falls back to just
 * Overview; one widget failing never breaks its neighbours; the page never
 * throws. Twenty visual language only (`.st-*` + dashboard.css).
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
  Plus,
  Pencil,
  Trash2,
  Check,
  LayoutGrid,
  RefreshCw,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  getKpisAction,
  runAnalyticsAction,
  listRecordsAction,
  listObjectsAction,
} from '@/app/actions/sabcrm.actions';
import type {
  CrmDashboardKpis,
  ObjectRecordCount,
  CountByFieldResult,
  SumByFieldResult,
  TimeSeriesResult,
  SabcrmRecordPage,
} from '@/app/actions/sabcrm.actions.types';
import type { CrmRecordWithLabel, ObjectMetadata } from '@/lib/sabcrm/types';
import {
  listDashboardsTw,
  getDashboardTw,
  createDashboardTw,
  updateDashboardTw,
  deleteDashboardTw,
} from '@/app/actions/sabcrm-dashboards.actions';

import { useStConfirm } from '@/components/sabcrm/twenty/st-modals';
import { WidgetTile } from './dashboard-widgets';
import { AddWidgetDialog } from './dashboard-add-widget';
import {
  normalizeDashboard,
  type DashboardTw,
  type DashboardWidgetTw,
} from './dashboard-types';

import {
  TwentyBarChart,
  TwentyDonutChart,
  TwentyLineChart,
} from '@/components/sabcrm/twenty/twenty-charts';
import {
  TwentyFunnelChart,
  type FunnelStage,
} from '@/components/sabcrm/charts/funnel-chart';

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

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0]}${parts[1]![0]}`;
}

/* -------------------------------------------------------------------------- */
/* Overview (built-in) data shape                                              */
/* -------------------------------------------------------------------------- */

interface OverviewData {
  kpis: CrmDashboardKpis;
  stageCount: CountByFieldResult | null;
  pipelineByStage: SumByFieldResult | null;
  recentOpportunities: CrmRecordWithLabel[] | null;
  oppsByMonth: TimeSeriesResult | null;
}

type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: OverviewData };

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
/* Recent records widget                                                       */
/* -------------------------------------------------------------------------- */

function RecentRecordsPanel({
  title,
  records,
  emptyLabel,
}: {
  title: string;
  records: CrmRecordWithLabel[] | null;
  emptyLabel: string;
}): React.JSX.Element {
  return (
    <div className="st-panel">
      <div className="st-panel__head">{title}</div>
      {records === null ? (
        <div className="st-timeline-empty">This widget could not be loaded.</div>
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

function PipelineSummaryPanel({
  pipeline,
}: {
  pipeline: SumByFieldResult | null;
}): React.JSX.Element {
  const buckets = (pipeline?.buckets ?? []).filter((b) => b.sum > 0);
  const total = pipeline?.total ?? 0;
  return (
    <div className="st-panel">
      <div className="st-panel__head">Pipeline summary</div>
      {pipeline === null ? (
        <div className="st-timeline-empty">This widget could not be loaded.</div>
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
/* Overview view (built-in analytics dashboard)                                */
/* -------------------------------------------------------------------------- */

function OverviewView({ data }: { data: OverviewData }): React.JSX.Element {
  const {
    kpis,
    stageCount,
    pipelineByStage,
    recentOpportunities,
    oppsByMonth,
  } = data;
  const { opportunities, tasks, newThisWeek, recordCounts } = kpis;

  const topObject: ObjectRecordCount | undefined = recordCounts
    .slice()
    .sort((a, b) => b.count - a.count)[0];

  // Pipeline funnel — ordered, value-weighted bands from the per-stage sum
  // aggregation (highest value first so it reads top-of-funnel → bottom).
  const funnelStages: FunnelStage[] = (pipelineByStage?.buckets ?? [])
    .filter((b) => b.sum > 0)
    .slice()
    .sort((a, b) => b.sum - a.sum)
    .map((b) => ({
      key: b.value || '∅',
      label: b.label,
      value: b.sum,
      display: formatCurrency(b.sum),
    }));

  return (
    <>
      <section className="st-dash-kpis" aria-label="Key performance indicators">
        <KpiCard
          label="Open pipeline"
          value={formatCurrency(opportunities.pipelineValue)}
          icon={<TrendingUp size={14} />}
          delta={`${formatNumber(opportunities.openCount)} open ${
            opportunities.openCount === 1 ? 'lead' : 'leads'
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

      <section className="st-dash-grid" aria-label="Breakdowns">
        {/* Native .sabcrm-twenty charts — inline SVG + --st-* tokens, drawn
            directly inside the .st-dash-grid (no ZoruUI scope wrapper). */}

        {/* Records by stage — native bar chart (countByField). */}
        <TwentyBarChart
          series={{
            kind: 'countByField',
            result:
              stageCount ??
              ({
                object: 'leads',
                field: 'stage',
                buckets: [],
                total: 0,
              } as CountByFieldResult),
          }}
          title="Opportunities by stage"
          description="Record count per pipeline stage"
          error={stageCount === null ? 'This chart could not be loaded.' : undefined}
        />

        {/* ARR / pipeline value over time — native line chart (timeSeries). */}
        <TwentyLineChart
          data={oppsByMonth ?? undefined}
          title="New opportunities over time"
        />

        {/* Pipeline value by stage — native horizontal bars (sumByField). */}
        <TwentyBarChart
          series={{
            kind: 'sumByField',
            result:
              pipelineByStage ??
              ({
                object: 'leads',
                groupField: 'stage',
                sumField: 'amount',
                buckets: [],
                total: 0,
              } as SumByFieldResult),
          }}
          title="Pipeline value by stage"
          description="Summed amount per stage"
          formatValue={formatCurrency}
          layout="horizontal"
          error={
            pipelineByStage === null ? 'This chart could not be loaded.' : undefined
          }
        />

        {/* Records by owner — native donut (self-fetching countByField). */}
        <TwentyDonutChart
          object="leads"
          fieldKey="owner"
          title="Opportunities by owner"
          description="Distribution across record owners"
        />

        {/* Pipeline funnel — ordered, value-weighted bands (.sabcrm-twenty). */}
        <TwentyFunnelChart
          title="Pipeline funnel"
          stages={funnelStages}
          emptyLabel="No pipeline value recorded yet."
        />

        <RecentRecordsPanel
          title="Recent opportunities"
          records={recentOpportunities}
          emptyLabel="No opportunities created yet."
        />
        <PipelineSummaryPanel pipeline={pipelineByStage} />
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Saved-dashboard view                                                        */
/* -------------------------------------------------------------------------- */

interface SavedDashboardViewProps {
  dashboard: DashboardTw;
  objects: ObjectMetadata[];
  projectId: string;
  busy: boolean;
  onChange: (next: DashboardTw) => void;
}

function SavedDashboardView({
  dashboard,
  objects,
  projectId,
  busy,
  onChange,
}: SavedDashboardViewProps): React.JSX.Element {
  const [editing, setEditing] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);

  const addWidget = React.useCallback(
    (widget: DashboardWidgetTw) => {
      setAdding(false);
      onChange({ ...dashboard, widgets: [...dashboard.widgets, widget] });
    },
    [dashboard, onChange],
  );

  const removeWidget = React.useCallback(
    (widgetId: string) => {
      onChange({
        ...dashboard,
        widgets: dashboard.widgets.filter((w) => w.id !== widgetId),
      });
    },
    [dashboard, onChange],
  );

  return (
    <>
      <div className="st-dash-toolbar">
        <span className="st-dash-toolbar__count">
          {dashboard.widgets.length}{' '}
          {dashboard.widgets.length === 1 ? 'widget' : 'widgets'}
        </span>
        <span className="st-dash-toolbar__spacer" />
        {busy ? <span className="st-dash-toolbar__saving">Saving…</span> : null}
        <TwentyButton
          variant="ghost"
          icon={RefreshCw}
          onClick={() => setReloadToken((t) => t + 1)}
          aria-label="Refresh widgets"
        >
          Refresh
        </TwentyButton>
        <TwentyButton
          variant={editing ? 'primary' : 'secondary'}
          icon={editing ? Check : Pencil}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Done' : 'Edit'}
        </TwentyButton>
        <TwentyButton variant="secondary" icon={Plus} onClick={() => setAdding(true)}>
          Add widget
        </TwentyButton>
      </div>

      {dashboard.widgets.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon" aria-hidden="true">
            <LayoutGrid size={20} />
          </span>
          <h2 className="st-empty__title">No widgets yet</h2>
          <p className="st-empty__desc">
            Add a KPI, breakdown, recent-records, or pipeline widget to build out
            this dashboard.
          </p>
          <div style={{ marginTop: 'var(--st-space-3)' }}>
            <TwentyButton
              variant="primary"
              icon={Plus}
              onClick={() => setAdding(true)}
            >
              Add your first widget
            </TwentyButton>
          </div>
        </div>
      ) : (
        <section
          className={`st-widget-grid${editing ? ' st-widget-grid--editing' : ''}`}
          aria-label={`${dashboard.name} widgets`}
        >
          {dashboard.widgets.map((widget) => (
            <WidgetTile
              key={widget.id}
              widget={widget}
              projectId={projectId}
              editing={editing}
              onRemove={removeWidget}
              reloadToken={reloadToken}
            />
          ))}
        </section>
      )}

      {adding ? (
        <AddWidgetDialog
          objects={objects}
          onClose={() => setAdding(false)}
          onAdd={addWidget}
        />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Rename dialog                                                               */
/* -------------------------------------------------------------------------- */

function RenameDialog({
  initial,
  title,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  initial: string;
  title: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}): React.JSX.Element {
  const [name, setName] = React.useState(initial);
  return (
    <div
      className="st-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <form
        className="st-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onConfirm(name.trim());
        }}
      >
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">{title}</h2>
        </div>
        <div className="st-dialog__body">
          <div className="st-field">
            <label className="st-field__label" htmlFor="dash-name">
              Dashboard name
            </label>
            <input
              id="dash-name"
              className="st-input"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales pipeline"
            />
          </div>
        </div>
        <div className="st-dialog__footer">
          <TwentyButton variant="ghost" onClick={onCancel}>
            Cancel
          </TwentyButton>
          <TwentyButton variant="primary" type="submit" disabled={!name.trim()}>
            {confirmLabel}
          </TwentyButton>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

const OVERVIEW_ID = '__overview__';

export default function SabcrmDashboardPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();

  // Overview (built-in) analytics state.
  const [overview, setOverview] = React.useState<OverviewState>({
    status: 'loading',
  });
  // Object metadata for the widget picker.
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  // Saved-dashboard list (id + name + widgets, loaded lazily/fully).
  const [dashboards, setDashboards] = React.useState<DashboardTw[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>(OVERVIEW_ID);
  const [saving, setSaving] = React.useState(false);
  const [dialog, setDialog] = React.useState<'new' | 'rename' | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const { confirm, dialog: confirmDialog } = useStConfirm();

  /* ----- Load Overview analytics ----- */
  const loadOverview = React.useCallback(async (projectId: string) => {
    setOverview({ status: 'loading' });
    try {
      const [kpisRes, stageCountRes, pipelineRes, recentRes, byMonthRes] =
        await Promise.all([
          getKpisAction(projectId),
          runAnalyticsAction(
            { kind: 'countByField', object: 'leads', fieldKey: 'stage' },
            projectId,
          ),
          runAnalyticsAction(
            {
              kind: 'sumByField',
              object: 'leads',
              groupFieldKey: 'stage',
              sumFieldKey: 'amount',
            },
            projectId,
          ),
          listRecordsAction(
            {
              object: 'leads',
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
              object: 'leads',
              dateField: 'createdAt',
              interval: 'month',
            },
            projectId,
          ),
        ]);

      if (!kpisRes.ok) {
        setOverview({ status: 'error', message: kpisRes.error });
        return;
      }

      setOverview({
        status: 'ready',
        data: {
          kpis: kpisRes.data,
          stageCount: stageCountRes.ok
            ? (stageCountRes.data as CountByFieldResult)
            : null,
          pipelineByStage: pipelineRes.ok
            ? (pipelineRes.data as SumByFieldResult)
            : null,
          recentOpportunities: recentRes.ok
            ? (recentRes.data as SabcrmRecordPage).records
            : null,
          oppsByMonth: byMonthRes.ok
            ? (byMonthRes.data as TimeSeriesResult)
            : null,
        },
      });
    } catch {
      setOverview({
        status: 'error',
        message:
          'The CRM service did not respond. Check your connection and try again.',
      });
    }
  }, []);

  /* ----- Load saved dashboards + object metadata (best-effort) ----- */
  const loadShell = React.useCallback(async (projectId: string) => {
    const [objRes, listRes] = await Promise.all([
      listObjectsAction(projectId),
      listDashboardsTw(projectId),
    ]);
    if (objRes.ok) setObjects(objRes.data);

    if (!listRes.ok) {
      // Dashboard list unavailable — Overview still works; surface a calm note.
      setDashboards([]);
      return;
    }

    // The list action returns full dashboards from the engine; normalise each
    // wire shape (wide `type: string` / `config: unknown`) into the renderable
    // client shape. If a row somehow lacks widgets, hydrate it individually.
    const full = await Promise.all(
      listRes.data.map(async (d) => {
        if (Array.isArray(d.widgets)) return normalizeDashboard(d);
        const one = await getDashboardTw(d.id, projectId);
        return one.ok
          ? normalizeDashboard(one.data)
          : normalizeDashboard({ id: d.id, name: d.name, widgets: [] });
      }),
    );
    setDashboards(full);
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setOverview({
        status: 'error',
        message: 'Select a project to view its CRM dashboard.',
      });
      setDashboards([]);
      return;
    }
    void loadOverview(activeProjectId);
    void loadShell(activeProjectId);
  }, [activeProjectId, isLoadingProject, loadOverview, loadShell]);

  /* ----- Mutations ----- */

  const selected = React.useMemo(
    () =>
      selectedId === OVERVIEW_ID
        ? null
        : dashboards.find((d) => d.id === selectedId) ?? null,
    [selectedId, dashboards],
  );

  const persist = React.useCallback(
    async (next: DashboardTw) => {
      if (!activeProjectId) return;
      // Optimistic update first.
      setDashboards((prev) => prev.map((d) => (d.id === next.id ? next : d)));
      setSaving(true);
      try {
        const res = await updateDashboardTw(
          next.id,
          { name: next.name, widgets: next.widgets },
          activeProjectId,
        );
        if (!res.ok) {
          setNotice(res.error || 'Could not save dashboard changes.');
        } else if (res.data) {
          // Reconcile with the server's canonical (normalised) copy.
          const saved = normalizeDashboard(res.data);
          setDashboards((prev) =>
            prev.map((d) => (d.id === saved.id ? saved : d)),
          );
        }
      } catch {
        setNotice('Could not save dashboard changes.');
      } finally {
        setSaving(false);
      }
    },
    [activeProjectId],
  );

  const handleCreate = React.useCallback(
    async (name: string) => {
      setDialog(null);
      if (!activeProjectId) return;
      setSaving(true);
      try {
        const res = await createDashboardTw({ name, widgets: [] }, activeProjectId);
        if (!res.ok) {
          setNotice(res.error || 'Could not create dashboard.');
          return;
        }
        const created = normalizeDashboard(res.data);
        setDashboards((prev) => [...prev, created]);
        setSelectedId(created.id);
      } catch {
        setNotice('Could not create dashboard.');
      } finally {
        setSaving(false);
      }
    },
    [activeProjectId],
  );

  const handleRename = React.useCallback(
    async (name: string) => {
      setDialog(null);
      if (!selected || !activeProjectId) return;
      await persist({ ...selected, name });
    },
    [selected, activeProjectId, persist],
  );

  const handleDelete = React.useCallback(async () => {
    if (!selected || !activeProjectId) return;
    const ok = await confirm({
      title: 'Delete dashboard?',
      message: `Delete "${selected.name}"? This cannot be undone.`,
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    const id = selected.id;
    setSaving(true);
    setSelectedId(OVERVIEW_ID);
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    try {
      const res = await deleteDashboardTw(id, activeProjectId);
      if (!res.ok) setNotice(res.error || 'Could not delete dashboard.');
    } catch {
      setNotice('Could not delete dashboard.');
    } finally {
      setSaving(false);
    }
  }, [selected, activeProjectId, confirm]);

  /* ----- Render ----- */

  const selectorActions = (
    <div className="st-dash-actions">
      {selected ? (
        <>
          <TwentyButton
            variant="ghost"
            icon={Pencil}
            onClick={() => setDialog('rename')}
            aria-label="Rename dashboard"
          >
            Rename
          </TwentyButton>
          <TwentyButton
            variant="ghost"
            icon={Trash2}
            onClick={handleDelete}
            aria-label="Delete dashboard"
          >
            Delete
          </TwentyButton>
        </>
      ) : null}
    </div>
  );

  const header = (
    <TwentyPageHeader
      title="Dashboard"
      icon={LayoutDashboard}
      actions={selectorActions}
    />
  );

  const selector = (
    <div className="st-dash-tabs" role="tablist" aria-label="Dashboards">
      <button
        type="button"
        role="tab"
        aria-selected={selectedId === OVERVIEW_ID}
        className={`st-dash-tab${selectedId === OVERVIEW_ID ? ' active' : ''}`}
        onClick={() => setSelectedId(OVERVIEW_ID)}
      >
        Overview
      </button>
      {dashboards.map((d) => (
        <button
          type="button"
          key={d.id}
          role="tab"
          aria-selected={selectedId === d.id}
          className={`st-dash-tab${selectedId === d.id ? ' active' : ''}`}
          onClick={() => setSelectedId(d.id)}
        >
          {d.name}
        </button>
      ))}
      <button
        type="button"
        className="st-dash-tab st-dash-tab--add"
        onClick={() => setDialog('new')}
        aria-label="New dashboard"
        title="New dashboard"
      >
        <Plus size={14} aria-hidden="true" />
        New
      </button>
    </div>
  );

  // Loading the project / overview spine.
  if (isLoadingProject || overview.status === 'loading') {
    return (
      <div className="st-page">
        {header}
        {selector}
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="st-page">
      {header}
      {selector}

      {notice ? (
        <div className="st-dash-notice" role="status">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{notice}</span>
          <button
            type="button"
            className="st-dash-notice__close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      {selected ? (
        <SavedDashboardView
          dashboard={selected}
          objects={objects}
          projectId={activeProjectId as string}
          busy={saving}
          onChange={(next) => void persist(next)}
        />
      ) : overview.status === 'error' ? (
        <DashboardError message={overview.message} />
      ) : (
        <OverviewView data={overview.data} />
      )}

      {dialog === 'new' ? (
        <RenameDialog
          initial=""
          title="New dashboard"
          confirmLabel="Create"
          onCancel={() => setDialog(null)}
          onConfirm={handleCreate}
        />
      ) : null}
      {dialog === 'rename' && selected ? (
        <RenameDialog
          initial={selected.name}
          title="Rename dashboard"
          confirmLabel="Save"
          onCancel={() => setDialog(null)}
          onConfirm={handleRename}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}
