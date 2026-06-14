'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { LayoutDashboard, ScanSearch } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { createBoardAction, updateBoardAction } from '@/app/actions/sabbi-boards.actions';
import { runMetricQueryAction } from '@/app/actions/sabbi-models.actions';
import type { BiChartRunResponse, BiChartType } from '@/lib/rust-client/bi-charts';
import type { BiModelDoc } from '@/lib/rust-client/bi-models';

import { ResultChart, type Formats, type ResultChartType } from '../../_components/result-chart';

const SERVER_TYPE: Record<string, BiChartType> = {
  table: 'table', kpi: 'table', bar: 'bar', line: 'line', pie: 'pie',
};

interface GenCard {
  title: string;
  measures: string[];
  dimensions: string[];
  chartType: ResultChartType;
  w: number;
}

/** Build an auto-dashboard from a model's semantic types. */
function generate(model: BiModelDoc): GenCard[] {
  const cards: GenCard[] = [];
  const measures = model.measures ?? [];
  const dims = model.dimensions ?? [];
  // KPI per measure.
  for (const m of measures.slice(0, 4)) {
    cards.push({ title: m.label, measures: [m.key], dimensions: [], chartType: 'kpi', w: 3 });
  }
  const primary = measures[0]?.key;
  // Primary measure broken out by each dimension.
  for (const d of dims) {
    cards.push({
      title: `${measures[0]?.label ?? 'Count'} by ${d.label}`,
      measures: primary ? [primary] : [],
      dimensions: [d.key],
      chartType: d.kind === 'date' ? 'line' : 'bar',
      w: 6,
    });
  }
  return cards;
}

function XrayCard({ model, card, formats }: { model: BiModelDoc; card: GenCard; formats: Formats }) {
  const [result, setResult] = useState<BiChartRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await runMetricQueryAction({
          modelId: model._id,
          measures: card.measures,
          dimensions: card.dimensions,
          chartType: SERVER_TYPE[card.chartType] ?? 'bar',
          limit: 100,
        });
        if (!cancelled) setResult(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Query failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [model._id, card]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate text-sm">{card.title}</CardTitle>
      </CardHeader>
      <CardBody>
        {error ? (
          <p className="text-sm text-[var(--st-danger)]">{error}</p>
        ) : result ? (
          <ResultChart result={result} type={card.chartType} formats={formats} height={card.chartType === 'kpi' ? 120 : 240} />
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-[var(--st-text-secondary)]">Loading…</div>
        )}
      </CardBody>
    </Card>
  );
}

export function XrayView({ model }: { model: BiModelDoc }) {
  const router = useRouter();
  const cards = useMemo(() => generate(model), [model]);
  const formats = useMemo(
    () => Object.fromEntries((model.measures ?? []).map((m) => [m.key, m.format])),
    [model],
  );
  const [saving, startSave] = useTransition();

  function saveAsBoard() {
    startSave(async () => {
      const res = await createBoardAction({ name: `${model.name} · X-ray` });
      await updateBoardAction(res.id, {
        cards: cards.map((c, i) => ({
          id: `xr_${i}`,
          title: c.title,
          modelId: model._id,
          measures: c.measures,
          dimensions: c.dimensions,
          segments: [],
          chartType: c.chartType,
          w: c.w,
        })),
      });
      router.push(`/dashboard/sabbi/boards/${res.id}`);
    });
  }

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI · X-ray</PageEyebrow>
          <PageTitle className="flex items-center gap-2">
            <ScanSearch size={20} aria-hidden="true" />
            {model.name}
          </PageTitle>
          <PageDescription>Auto-generated from this model&apos;s measures and dimensions.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button onClick={saveAsBoard} disabled={saving || cards.length === 0}>
            <LayoutDashboard size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save as board'}
          </Button>
        </PageActions>
      </PageHeader>

      {cards.length === 0 ? (
        <EmptyState
          icon={ScanSearch}
          tone="info"
          title="Nothing to X-ray"
          description="This model has no measures yet. Add measures and dimensions in the model editor."
          action={
            <Button asChild>
              <a href={`/dashboard/sabbi/models/${model._id}`}>Open model</a>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-2 lg:grid-cols-12">
          {cards.map((card, i) => (
            <div key={i} style={{ gridColumn: `span ${Math.min(card.w, 12)} / span ${Math.min(card.w, 12)}` }}>
              <XrayCard model={model} card={card} formats={formats} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
