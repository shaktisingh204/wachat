'use client';

/**
 * SabCRM — saved-dashboard widget renderer (Twenty-faithful).
 *
 * A "saved dashboard" is `{ id, name, widgets:[{ id, type, title, config }] }`
 * loaded from `@/app/actions/sabcrm-dashboards.actions`. Each widget is one of
 * four `type`s — `kpi`, `bar`, `recent`, `pipeline` — and carries a `config`
 * blob naming the object / field / metric to chart.
 *
 * Every widget fetches and renders in isolation: a single failing query degrades
 * that one tile to a calm error panel and never touches its neighbours. All data
 * comes through the existing, battle-tested analytics actions
 * (`runAnalyticsAction` / `listRecordsAction`) so the saved-dashboard layer is a
 * pure presentation/composition shell over proven resolvers.
 *
 * Twenty visual language only (`.st-*` + dashboard.css). No ZoruUI / Tailwind.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  Clock4,
  ListChecks,
  GripVertical,
  Trash2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

import {
  runAnalyticsAction,
  listRecordsAction,
} from '@/app/actions/sabcrm.actions';
import type {
  TimeSeriesResult,
  SabcrmRecordPage,
} from '@/app/actions/sabcrm.actions.types';
import { aggregateSabcrmRecordsTw } from '@/app/actions/sabcrm-twenty.actions';
import type { CrmRecordWithLabel } from '@/lib/sabcrm/types';

import type { DashboardWidgetTw, WidgetTypeTw } from './dashboard-types';

/* -------------------------------------------------------------------------- */
/* Formatters (kept local so the widget module is self-contained)             */
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
/* Per-widget config reading                                                   */
/* -------------------------------------------------------------------------- */

function str(config: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = config?.[key];
  return typeof v === 'string' && v ? v : undefined;
}

/* -------------------------------------------------------------------------- */
/* Per-widget data fetch state                                                 */
/* -------------------------------------------------------------------------- */

type WidgetState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: WidgetPayload };

type WidgetPayload =
  | { kind: 'kpi'; value: string; sub: string }
  | { kind: 'bar'; rows: BarRow[] }
  | { kind: 'recent'; records: CrmRecordWithLabel[] }
  | { kind: 'pipeline'; total: number; buckets: PipelineBucket[] };

interface BarRow {
  key: string;
  label: string;
  weight: number;
  display: string;
}

interface PipelineBucket {
  value: string;
  label: string;
  sum: number;
}

/** Stringify an aggregate bucket's `value` (which is wire-typed `unknown`). */
function bucketLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Empty';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return String(value);
}

const TYPE_ICON: Record<WidgetTypeTw, React.ReactNode> = {
  kpi: <TrendingUp size={13} aria-hidden="true" />,
  bar: <BarChart3 size={13} aria-hidden="true" />,
  recent: <Clock4 size={13} aria-hidden="true" />,
  pipeline: <ListChecks size={13} aria-hidden="true" />,
};

/* -------------------------------------------------------------------------- */
/* Data resolution — one widget config → one payload                           */
/* -------------------------------------------------------------------------- */

async function resolveWidget(
  widget: DashboardWidgetTw,
  projectId: string,
): Promise<WidgetPayload> {
  const cfg = widget.config ?? {};
  const object = str(cfg, 'object') ?? 'opportunities';

  switch (widget.type) {
    case 'kpi': {
      // metric ∈ count | sum. Both resolve through the generic aggregate; the
      // KPI value is the grand `total` reduced across all matched records.
      const metric = str(cfg, 'metric') === 'sum' ? 'sum' : 'count';
      const groupBy =
        str(cfg, 'groupField') ?? str(cfg, 'field') ?? 'stage';
      const res = await aggregateSabcrmRecordsTw(
        object,
        {
          groupByField: groupBy,
          metric,
          metricField: metric === 'sum' ? str(cfg, 'sumField') ?? 'amount' : undefined,
        },
        projectId,
      );
      if (!res.ok) throw new Error(res.error);
      return {
        kind: 'kpi',
        value: metric === 'sum' ? formatCurrency(res.data.total) : formatNumber(res.data.total),
        sub:
          metric === 'sum'
            ? `${formatNumber(res.data.groups.length)} ${
                res.data.groups.length === 1 ? 'group' : 'groups'
              }`
            : 'total records',
      };
    }

    case 'bar': {
      const metric = str(cfg, 'metric') ?? 'count';
      // Time series has no aggregate-metric equivalent — use the analytics action.
      if (metric === 'timeSeries') {
        const res = await runAnalyticsAction(
          {
            kind: 'timeSeries',
            object,
            dateField: str(cfg, 'field') ?? 'createdAt',
            interval: 'month',
          },
          projectId,
        );
        if (!res.ok) throw new Error(res.error);
        const data = res.data as TimeSeriesResult;
        return {
          kind: 'bar',
          rows: data.points.slice(-6).map((p) => ({
            key: p.date,
            label: formatMonth(p.date),
            weight: p.count,
            display: formatNumber(p.count),
          })),
        };
      }
      // count / sum by field — generic aggregate.
      const isSum = metric === 'sum';
      const res = await aggregateSabcrmRecordsTw(
        object,
        {
          groupByField: str(cfg, 'field') ?? 'stage',
          metric: isSum ? 'sum' : 'count',
          metricField: isSum ? str(cfg, 'sumField') ?? 'amount' : undefined,
        },
        projectId,
      );
      if (!res.ok) throw new Error(res.error);
      return {
        kind: 'bar',
        rows: res.data.groups
          .filter((g) => g.metric > 0)
          .map((g) => ({
            key: bucketLabel(g.value),
            label: bucketLabel(g.value),
            weight: g.metric,
            display: isSum ? formatCurrency(g.metric) : formatNumber(g.metric),
          })),
      };
    }

    case 'recent': {
      const res = await listRecordsAction(
        {
          object,
          page: 1,
          pageSize: 5,
          sortBy: str(cfg, 'sortBy') ?? 'createdAt',
          sortDir: 'desc',
        },
        projectId,
      );
      if (!res.ok) throw new Error(res.error);
      return { kind: 'recent', records: (res.data as SabcrmRecordPage).records };
    }

    case 'pipeline': {
      const res = await aggregateSabcrmRecordsTw(
        object,
        {
          groupByField: str(cfg, 'groupField') ?? 'stage',
          metric: 'sum',
          metricField: str(cfg, 'sumField') ?? 'amount',
        },
        projectId,
      );
      if (!res.ok) throw new Error(res.error);
      return {
        kind: 'pipeline',
        total: res.data.total,
        buckets: res.data.groups
          .filter((g) => g.metric > 0)
          .map((g) => ({
            value: bucketLabel(g.value),
            label: bucketLabel(g.value),
            sum: g.metric,
          })),
      };
    }

    default: {
      // Unknown / future type — render a calm placeholder rather than throwing.
      const exhaustive: never = widget.type;
      throw new Error(`Unsupported widget type: ${String(exhaustive)}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Payload renderers                                                           */
/* -------------------------------------------------------------------------- */

function KpiBody({ value, sub }: { value: string; sub: string }): React.JSX.Element {
  return (
    <div className="st-widget-kpi">
      <span className="st-widget-kpi__value">{value}</span>
      <span className="st-widget-kpi__sub">{sub}</span>
    </div>
  );
}

function BarBody({ rows, empty }: { rows: BarRow[]; empty: string }): React.JSX.Element {
  if (rows.length === 0) return <div className="st-timeline-empty">{empty}</div>;
  const max = rows.reduce((m, r) => Math.max(m, r.weight), 0);
  return (
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
              <span className="st-barlist__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecentBody({
  records,
  empty,
}: {
  records: CrmRecordWithLabel[];
  empty: string;
}): React.JSX.Element {
  if (records.length === 0) return <div className="st-timeline-empty">{empty}</div>;
  return (
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
  );
}

function PipelineBody({
  total,
  buckets,
  empty,
}: {
  total: number;
  buckets: PipelineBucket[];
  empty: string;
}): React.JSX.Element {
  if (buckets.length === 0) return <div className="st-timeline-empty">{empty}</div>;
  return (
    <div className="st-pipesum">
      <div className="st-pipesum__total">
        <span className="st-pipesum__total-label">Total pipeline</span>
        <span className="st-pipesum__total-value">{formatCurrency(total)}</span>
      </div>
      <ul className="st-pipesum__stages">
        {buckets.map((b) => {
          const pct = total > 0 ? Math.round((b.sum / total) * 100) : 0;
          return (
            <li className="st-pipesum__stage" key={b.value || '∅'}>
              <span className="st-pipesum__stage-label">{b.label}</span>
              <span className="st-pipesum__stage-value">{formatCurrency(b.sum)}</span>
              <span className="st-pipesum__stage-pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Widget tile — fetches its own data, isolates its own failures               */
/* -------------------------------------------------------------------------- */

export interface WidgetTileProps {
  widget: DashboardWidgetTw;
  projectId: string;
  /** When true an editing affordance (remove) is shown on hover. */
  editing: boolean;
  onRemove: (widgetId: string) => void;
  /** Bumped by the parent to force a refetch (e.g. on dashboard refresh). */
  reloadToken: number;
}

const EMPTY_BY_TYPE: Record<WidgetTypeTw, string> = {
  kpi: 'No data for this metric yet.',
  bar: 'Nothing to break down yet.',
  recent: 'No recent records yet.',
  pipeline: 'No pipeline value recorded yet.',
};

export function WidgetTile({
  widget,
  projectId,
  editing,
  onRemove,
  reloadToken,
}: WidgetTileProps): React.JSX.Element {
  const [state, setState] = React.useState<WidgetState>({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    resolveWidget(widget, projectId)
      .then((payload) => {
        if (!cancelled) setState({ status: 'ready', payload });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              e instanceof Error ? e.message : 'This widget could not be loaded.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-run when the widget definition or reload token changes.
  }, [widget, projectId, reloadToken]);

  const isWide = widget.type === 'bar' || widget.type === 'recent' || widget.type === 'pipeline';
  const empty = EMPTY_BY_TYPE[widget.type];

  return (
    <div
      className={`st-panel st-widget${isWide ? ' st-widget--wide' : ''}`}
      data-widget-type={widget.type}
    >
      <div className="st-widget__head">
        <span className="st-widget__type-icon" aria-hidden="true">
          {TYPE_ICON[widget.type]}
        </span>
        <span className="st-widget__title">{widget.title}</span>
        {editing ? (
          <button
            type="button"
            className="st-widget__remove"
            onClick={() => onRemove(widget.id)}
            aria-label={`Remove ${widget.title}`}
            title="Remove widget"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        ) : (
          <span className="st-widget__grip" aria-hidden="true">
            <GripVertical size={13} />
          </span>
        )}
      </div>

      <div className="st-widget__body">
        {state.status === 'loading' ? (
          <div className="st-widget__loading">
            <div className="st-skeleton st-widget__skel" />
          </div>
        ) : state.status === 'error' ? (
          <div className="st-widget__error">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{state.message}</span>
          </div>
        ) : state.payload.kind === 'kpi' ? (
          <KpiBody value={state.payload.value} sub={state.payload.sub} />
        ) : state.payload.kind === 'bar' ? (
          <BarBody rows={state.payload.rows} empty={empty} />
        ) : state.payload.kind === 'recent' ? (
          <RecentBody records={state.payload.records} empty={empty} />
        ) : (
          <PipelineBody
            total={state.payload.total}
            buckets={state.payload.buckets}
            empty={empty}
          />
        )}
      </div>
    </div>
  );
}
