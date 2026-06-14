'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Code2,
  Database,
  Filter as FilterIcon,
  Gauge,
  LineChart,
  PieChart,
  Plug,
  Plus,
  Ruler,
  Sigma,
  Table2,
  Trash2,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { runMetricQueryAction } from '@/app/actions/sabbi-models.actions';
import type { BiChartRunResponse, BiChartType } from '@/lib/rust-client/bi-charts';
import type { BiModelDoc } from '@/lib/rust-client/bi-models';

import { ResultChart, type ResultChartType } from '../_components/result-chart';

const OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'nin'] as const;
const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte']);
const selectCls =
  'h-9 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-surface)] px-2 text-sm text-[var(--st-text)]';

const CHART_TYPES: { key: ResultChartType; label: string; icon: typeof BarChart3 }[] = [
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'bar', label: 'Bar', icon: BarChart3 },
  { key: 'stacked', label: 'Stacked', icon: BarChart3 },
  { key: 'line', label: 'Line', icon: LineChart },
  { key: 'area', label: 'Area', icon: LineChart },
  { key: 'pie', label: 'Pie', icon: PieChart },
  { key: 'donut', label: 'Donut', icon: PieChart },
  { key: 'kpi', label: 'KPI', icon: Gauge },
];

/** Visual chart type → the server-side query type (which pipeline to build). */
const SERVER_TYPE: Record<ResultChartType, BiChartType> = {
  table: 'table',
  kpi: 'table',
  bar: 'bar',
  stacked: 'bar',
  line: 'line',
  area: 'line',
  pie: 'pie',
  donut: 'pie',
};

interface FilterRow {
  column: string;
  op: string;
  value: string;
}

function coerce(op: string, raw: string): unknown {
  if (NUMERIC_OPS.has(op)) {
    const n = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(n)) return n;
  }
  if (op === 'in' || op === 'nin') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return raw;
}

export function ExploreBuilder({ models }: { models: BiModelDoc[] }) {
  const [modelId, setModelId] = useState<string>(models[0]?._id ?? '');
  const model = useMemo(() => models.find((m) => m._id === modelId), [models, modelId]);

  const [measures, setMeasures] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [chartType, setChartType] = useState<ResultChartType>('bar');
  const [limit, setLimit] = useState(50);

  const [result, setResult] = useState<BiChartRunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuery, setShowQuery] = useState(false);

  // Reset selections when the model changes.
  useEffect(() => {
    setMeasures([]);
    setDimensions([]);
    setSegments([]);
    setFilters([]);
    setResult(null);
  }, [modelId]);

  const metricQuery = useMemo(
    () => ({
      modelId,
      measures,
      dimensions,
      segments,
      filters: filters
        .filter((f) => f.column.trim())
        .map((f) => ({ column: f.column.trim(), op: f.op, value: coerce(f.op, f.value) })),
      chartType: SERVER_TYPE[chartType],
      limit,
    }),
    [modelId, measures, dimensions, segments, filters, chartType, limit],
  );

  const formats = useMemo(
    () => Object.fromEntries((model?.measures ?? []).map((m) => [m.key, m.format])),
    [model],
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryKey = JSON.stringify(metricQuery);

  useEffect(() => {
    if (!modelId || (measures.length === 0 && dimensions.length === 0)) {
      setResult(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setRunning(true);
      setError(null);
      try {
        const res = await runMetricQueryAction(metricQuery);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Query failed');
        setResult(null);
      } finally {
        setRunning(false);
      }
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  function toggle(list: string[], set: (v: string[]) => void, key: string) {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  if (models.length === 0) {
    return (
      <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow>SabBI</PageEyebrow>
            <PageTitle>Explore</PageTitle>
          </PageHeaderHeading>
        </PageHeader>
        <EmptyState
          icon={Plug}
          tone="info"
          title="No models to explore yet"
          description="Connect a SabNode module or create a model first."
          action={
            <Button asChild>
              <Link href="/dashboard/sabbi/connectors">
                <Plug size={16} aria-hidden="true" /> Connect a module
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI · Query builder</PageEyebrow>
          <PageTitle>Explore</PageTitle>
          <PageDescription>
            Build a query step by step on a governed model. Results preview live.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Steps */}
        <div className="flex flex-col gap-[var(--st-space-4)]">
          {/* Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database size={16} aria-hidden="true" /> Data
              </CardTitle>
            </CardHeader>
            <CardBody>
              <select className={`${selectCls} w-full`} value={modelId} onChange={(e) => setModelId(e.target.value)}>
                {models.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </CardBody>
          </Card>

          {/* Summarize */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sigma size={16} aria-hidden="true" /> Summarize
              </CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--st-text-secondary)]">Measures</p>
                <div className="flex flex-wrap gap-1.5">
                  {(model?.measures ?? []).map((m) => (
                    <button key={m.key} type="button" onClick={() => toggle(measures, setMeasures, m.key)} className="cursor-pointer">
                      <Badge tone={measures.includes(m.key) ? 'success' : 'neutral'}>
                        <Sigma size={12} aria-hidden="true" /> {m.label}
                      </Badge>
                    </button>
                  ))}
                  {(model?.measures ?? []).length === 0 && (
                    <span className="text-xs text-[var(--st-text-secondary)]">No measures on this model.</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--st-text-secondary)]">Group by</p>
                <div className="flex flex-wrap gap-1.5">
                  {(model?.dimensions ?? []).map((d) => (
                    <button key={d.key} type="button" onClick={() => toggle(dimensions, setDimensions, d.key)} className="cursor-pointer">
                      <Badge tone={dimensions.includes(d.key) ? 'info' : 'neutral'}>
                        <Ruler size={12} aria-hidden="true" /> {d.label}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
              {(model?.segments ?? []).length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-[var(--st-text-secondary)]">Segments</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(model?.segments ?? []).map((s) => (
                      <button key={s.key} type="button" onClick={() => toggle(segments, setSegments, s.key)} className="cursor-pointer">
                        <Badge tone={segments.includes(s.key) ? 'accent' : 'neutral'}>{s.label}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Filter */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FilterIcon size={16} aria-hidden="true" /> Filter
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setFilters((f) => [...f, { column: '', op: 'eq', value: '' }])}>
                <Plus size={14} aria-hidden="true" /> Add
              </Button>
            </CardHeader>
            <CardBody className="flex flex-col gap-2">
              {filters.length === 0 && (
                <span className="text-xs text-[var(--st-text-secondary)]">No filters — all rows.</span>
              )}
              {filters.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input
                    value={f.column}
                    placeholder="column"
                    onChange={(e) => setFilters((arr) => arr.map((x, j) => (j === i ? { ...x, column: e.target.value } : x)))}
                    className="font-mono text-xs"
                  />
                  <select
                    className={selectCls}
                    value={f.op}
                    onChange={(e) => setFilters((arr) => arr.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}
                  >
                    {OPS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={f.value}
                    placeholder="value"
                    onChange={(e) => setFilters((arr) => arr.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  />
                  <Button variant="ghost" size="icon" aria-label="Remove filter" onClick={() => setFilters((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-[var(--st-space-4)]">
          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {CHART_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Button
                      key={t.key}
                      variant={chartType === t.key ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setChartType(t.key)}
                    >
                      <Icon size={14} aria-hidden="true" /> {t.label}
                    </Button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                {running && <span className="text-xs text-[var(--st-text-secondary)]">Running…</span>}
                <Button variant="ghost" size="sm" onClick={() => setShowQuery((s) => !s)}>
                  <Code2 size={14} aria-hidden="true" /> Query
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {error && <p className="mb-2 text-sm text-[var(--st-danger)]">{error}</p>}
              {result ? (
                <ResultChart result={result} type={chartType} formats={formats} />
              ) : (
                <EmptyState
                  icon={BarChart3}
                  tone="neutral"
                  title="Pick a measure to start"
                  description="Choose at least one measure or dimension to run a query."
                />
              )}
            </CardBody>
          </Card>

          {showQuery && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code2 size={16} aria-hidden="true" /> Generated MetricQuery
                </CardTitle>
              </CardHeader>
              <CardBody>
                <pre className="overflow-auto rounded-[var(--st-radius-sm)] bg-[var(--st-surface-2)] p-3 font-mono text-xs text-[var(--st-text)]">
                  {JSON.stringify(metricQuery, null, 2)}
                </pre>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
