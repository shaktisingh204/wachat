'use client';

/**
 * SabCRM — Dashboard (`/sabcrm/dashboard`), 20ui, with SAVED dashboards.
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
 * throws. 20ui only — every chart renders through the shared charts composites
 * (`@/components/sabcrm/20ui/composites/charts`); page-local layout lives in
 * the `cd-*` classes of `./dashboard.css` (scoped to the 20ui root).
 */

import * as React from 'react';
import Link from 'next/link';
import {
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

import {
  Modal,
  Field,
  Input,
  TabsBar,
  Alert,
  Skeleton,
  EmptyState,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  KpiCard,
  BarChart,
  LineChart,
  DonutChart,
  FunnelChart,
  type ChartDatum,
  type FunnelStage,
} from '@/components/sabcrm/20ui/composites/charts';
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

import { WidgetTile, PipelineBody } from './dashboard-widgets';
import { AddWidgetDialog } from './dashboard-add-widget';
import {
  normalizeDashboard,
  type DashboardTw,
  type DashboardWidgetTw,
} from './dashboard-types';

import '@/components/sabcrm/20ui/surface-crm-base.css';
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

function formatMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
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
  ownerCount: CountByFieldResult | null;
  recentOpportunities: CrmRecordWithLabel[] | null;
  oppsByMonth: TimeSeriesResult | null;
}

type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: OverviewData };

/* -------------------------------------------------------------------------- */
/* Chart panel — Card chrome shared by every Overview breakdown                */
/* -------------------------------------------------------------------------- */

function ChartPanel({
  title,
  description,
  error,
  children,
}: {
  title: string;
  description?: string;
  /** When set the body renders a calm inline error instead of the chart. */
  error?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card className="cd-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardBody>
        {error ? <div className="cd-empty-note">{error}</div> : children}
      </CardBody>
    </Card>
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
    <ChartPanel
      title={title}
      error={records === null ? 'This widget could not be loaded.' : undefined}
    >
      {records && records.length === 0 ? (
        <div className="cd-empty-note">{emptyLabel}</div>
      ) : (
        <ul className="cd-reclist">
          {(records ?? []).map((record) => {
            const label = record.label || 'Untitled';
            return (
              <li className="cd-reclist__row" key={record._id}>
                <Link
                  href={`/sabcrm/${record.object}/${record._id}`}
                  className="cd-reclist__link"
                >
                  <span className="cd-avatar" aria-hidden="true">
                    {initials(label)}
                  </span>
                  <span className="cd-reclist__label">{label}</span>
                  <span className="cd-reclist__meta">
                    <Clock size={11} aria-hidden="true" />
                    {formatRelative(record.createdAt)}
                  </span>
                  <ArrowUpRight
                    className="cd-reclist__chevron"
                    size={13}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ChartPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton + error states                                                     */
/* -------------------------------------------------------------------------- */

function DashboardSkeleton(): React.JSX.Element {
  return (
    <>
      <div className="cd-kpis" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={96} radius={10} />
        ))}
      </div>
      <div className="cd-grid" aria-hidden="true">
        <Skeleton height={220} radius={10} />
        <Skeleton height={220} radius={10} />
      </div>
    </>
  );
}

function DashboardError({ message }: { message: string }): React.JSX.Element {
  return (
    <EmptyState
      icon={AlertTriangle}
      tone="warning"
      title="Dashboard unavailable"
      description={message}
    />
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
    ownerCount,
    recentOpportunities,
    oppsByMonth,
  } = data;
  const { opportunities, tasks, newThisWeek, recordCounts } = kpis;

  const topObject: ObjectRecordCount | undefined = recordCounts
    .slice()
    .sort((a, b) => b.count - a.count)[0];

  // Records by stage — count distribution.
  const stageRows: ChartDatum[] = (stageCount?.buckets ?? []).map((b) => ({
    label: b.label || 'Empty',
    value: b.count,
  }));

  // New records over time (monthly).
  const monthRows: ChartDatum[] = (oppsByMonth?.points ?? []).map((p) => ({
    label: formatMonth(p.date),
    value: p.count,
  }));

  // Pipeline value by stage — summed amounts.
  const pipelineRows: ChartDatum[] = (pipelineByStage?.buckets ?? [])
    .filter((b) => b.sum > 0)
    .map((b) => ({ label: b.label || 'Empty', value: b.sum }));

  // Records by owner — distribution donut.
  const ownerRows: ChartDatum[] = (ownerCount?.buckets ?? [])
    .filter((b) => b.count > 0)
    .map((b) => ({ label: b.label || 'Unassigned', value: b.count }));

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

  const pipelineBuckets = (pipelineByStage?.buckets ?? [])
    .filter((b) => b.sum > 0)
    .map((b) => ({ value: b.value || '∅', label: b.label, sum: b.sum }));

  return (
    <>
      <section className="cd-kpis" aria-label="Key performance indicators">
        <KpiCard
          label="Open pipeline"
          value={formatCurrency(opportunities.pipelineValue)}
          icon={TrendingUp}
          delta={`${formatNumber(opportunities.openCount)} open ${
            opportunities.openCount === 1 ? 'lead' : 'leads'
          }`}
        />
        <KpiCard
          label="Tasks due today"
          value={formatNumber(tasks.dueToday)}
          icon={CalendarClock}
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
          icon={Sparkles}
          delta="records created"
          deltaTone={newThisWeek.count > 0 ? 'up' : 'neutral'}
          sparkline={
            monthRows.length > 1 ? monthRows.map((r) => r.value) : undefined
          }
        />
        <KpiCard
          label={topObject ? topObject.labelPlural : 'Records'}
          value={formatNumber(topObject ? topObject.count : 0)}
          icon={topObject?.slug === 'companies' ? Building2 : Briefcase}
          delta="total records"
        />
      </section>

      <section className="cd-grid" aria-label="Breakdowns">
        <ChartPanel
          title="Opportunities by stage"
          description="Record count per pipeline stage"
          error={stageCount === null ? 'This chart could not be loaded.' : undefined}
        >
          <BarChart
            data={stageRows}
            seriesLabel="Opportunities"
            emptyLabel="No opportunities to chart yet."
          />
        </ChartPanel>

        <ChartPanel
          title="New opportunities over time"
          description="Created per month"
          error={oppsByMonth === null ? 'This chart could not be loaded.' : undefined}
        >
          <LineChart
            data={monthRows}
            seriesLabel="Created"
            emptyLabel="No opportunities created yet."
          />
        </ChartPanel>

        <ChartPanel
          title="Pipeline value by stage"
          description="Summed amount per stage"
          error={
            pipelineByStage === null ? 'This chart could not be loaded.' : undefined
          }
        >
          <BarChart
            data={pipelineRows}
            layout="horizontal"
            formatValue={formatCurrency}
            seriesLabel="Pipeline"
            emptyLabel="No pipeline value recorded yet."
          />
        </ChartPanel>

        <ChartPanel
          title="Opportunities by owner"
          description="Distribution across record owners"
          error={ownerCount === null ? 'This chart could not be loaded.' : undefined}
        >
          <DonutChart
            data={ownerRows}
            formatValue={formatNumber}
            emptyLabel="No owners to chart yet."
          />
        </ChartPanel>

        <ChartPanel title="Pipeline funnel">
          <FunnelChart
            label="Pipeline funnel"
            stages={funnelStages}
            formatValue={formatCurrency}
            emptyLabel="No pipeline value recorded yet."
          />
        </ChartPanel>

        <RecentRecordsPanel
          title="Recent opportunities"
          records={recentOpportunities}
          emptyLabel="No opportunities created yet."
        />

        <ChartPanel
          title="Pipeline summary"
          error={
            pipelineByStage === null ? 'This widget could not be loaded.' : undefined
          }
        >
          <PipelineBody
            total={pipelineByStage?.total ?? 0}
            buckets={pipelineBuckets}
            empty="No pipeline value recorded yet."
          />
        </ChartPanel>
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
      <div className="cd-toolbar">
        <span className="cd-toolbar__count">
          {dashboard.widgets.length}{' '}
          {dashboard.widgets.length === 1 ? 'widget' : 'widgets'}
        </span>
        <span className="cd-toolbar__spacer" />
        {busy ? <span className="cd-toolbar__saving">Saving…</span> : null}
        <Button
          variant="ghost"
          size="sm"
          iconLeft={RefreshCw}
          onClick={() => setReloadToken((t) => t + 1)}
          aria-label="Refresh widgets"
        >
          Refresh
        </Button>
        <Button
          variant={editing ? 'primary' : 'secondary'}
          size="sm"
          iconLeft={editing ? Check : Pencil}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Done' : 'Edit'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={Plus}
          onClick={() => setAdding(true)}
        >
          Add widget
        </Button>
      </div>

      {dashboard.widgets.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No widgets yet"
          description="Add a KPI, breakdown, recent-records, or pipeline widget to build out this dashboard."
          action={
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={() => setAdding(true)}
            >
              Add your first widget
            </Button>
          }
        />
      ) : (
        <section
          className={`cd-widget-grid${editing ? ' cd-widget-grid--editing' : ''}`}
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
/* Rename + confirm dialogs                                                    */
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
  const formId = React.useId();
  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            disabled={!name.trim()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onConfirm(name.trim());
        }}
      >
        <Field label="Dashboard name">
          <Input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales pipeline"
          />
        </Field>
      </form>
    </Modal>
  );
}

/** A small destructive-confirm dialog (20ui Modal — no Twenty kit). */
function ConfirmDeleteDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="cd-confirm-text">{message}</p>
    </Modal>
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
  const [dialog, setDialog] = React.useState<'new' | 'rename' | 'delete' | null>(
    null,
  );
  const [notice, setNotice] = React.useState<string | null>(null);

  /* ----- Load Overview analytics ----- */
  const loadOverview = React.useCallback(async (projectId: string) => {
    setOverview({ status: 'loading' });
    try {
      const [
        kpisRes,
        stageCountRes,
        pipelineRes,
        ownerCountRes,
        recentRes,
        byMonthRes,
      ] = await Promise.all([
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
        runAnalyticsAction(
          { kind: 'countByField', object: 'leads', fieldKey: 'owner' },
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
          ownerCount: ownerCountRes.ok
            ? (ownerCountRes.data as CountByFieldResult)
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
    // wire shape (wide `type: string` / optional `title`) into the renderable
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

  const handleDeleteConfirmed = React.useCallback(async () => {
    setDialog(null);
    if (!selected || !activeProjectId) return;
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
  }, [selected, activeProjectId]);

  /* ----- Render ----- */

  const header = (
    <PageHeader>
      <PageHeaderHeading>
        <PageTitle>Dashboard</PageTitle>
        <PageDescription>
          Pipeline, tasks and record analytics for this workspace.
        </PageDescription>
      </PageHeaderHeading>
      <PageActions>
        {selected ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={Pencil}
              onClick={() => setDialog('rename')}
              aria-label="Rename dashboard"
            >
              Rename
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={Trash2}
              onClick={() => setDialog('delete')}
              aria-label="Delete dashboard"
            >
              Delete
            </Button>
          </>
        ) : null}
      </PageActions>
    </PageHeader>
  );

  const selector = (
    <div className="cd-tabs">
      <TabsBar
        aria-label="Dashboards"
        size="sm"
        value={selectedId}
        onChange={setSelectedId}
        items={[
          { value: OVERVIEW_ID, label: 'Overview' },
          ...dashboards.map((d) => ({ value: d.id, label: d.name })),
        ]}
      />
      <Button
        variant="ghost"
        size="sm"
        iconLeft={Plus}
        onClick={() => setDialog('new')}
        aria-label="New dashboard"
        title="New dashboard"
      >
        New
      </Button>
    </div>
  );

  // Loading the project / overview spine.
  if (isLoadingProject || overview.status === 'loading') {
    return (
      <div className="cd-page">
        <div className="cd-page__inner">
          {header}
          {selector}
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="cd-page">
      <div className="cd-page__inner">
        {header}
        {selector}

        {notice ? (
          <Alert
            tone="warning"
            className="cd-notice"
            onClose={() => setNotice(null)}
            closeLabel="Dismiss"
          >
            {notice}
          </Alert>
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
        {dialog === 'delete' && selected ? (
          <ConfirmDeleteDialog
            title="Delete dashboard?"
            message={`Delete "${selected.name}"? This cannot be undone.`}
            confirmLabel="Delete"
            onCancel={() => setDialog(null)}
            onConfirm={() => void handleDeleteConfirmed()}
          />
        ) : null}
      </div>
    </div>
  );
}
