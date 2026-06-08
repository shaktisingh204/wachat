'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  createChartAction,
  deleteChartAction,
  runChartAction,
} from '@/app/actions/analytics-bi.actions';
import type {
  BiChartAgg,
  BiChartDoc,
  BiChartRunResponse,
  BiChartType,
} from '@/lib/rust-client/bi-charts';
import {
  BarChart3,
  Maximize2,
  PlayCircle,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';

import { ChartPreview } from './chart-preview';

interface DatasetRef {
  id: string;
  name: string;
}

const CHART_TYPES: BiChartType[] = ['bar', 'line', 'pie', 'table', 'kpi', 'map', 'heatmap'];
const AGGS: BiChartAgg[] = ['sum', 'avg', 'min', 'max', 'count'];

export function WorkbookEditor({
  workbookId,
  datasets,
  initialCharts,
}: {
  workbookId: string;
  datasets: DatasetRef[];
  initialCharts: BiChartDoc[];
}) {
  const router = useRouter();
  const [charts, setCharts] = useState(initialCharts);
  const [name, setName] = useState('');
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? '');
  const [chartType, setChartType] = useState<BiChartType>('bar');
  const [dimensions, setDimensions] = useState('');
  const [measureColumn, setMeasureColumn] = useState('');
  const [agg, setAgg] = useState<BiChartAgg>('sum');
  const [previewResult, setPreviewResult] = useState<BiChartRunResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const draftSpec = useMemo(
    () => ({
      dimensions: dimensions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      measures: measureColumn.trim()
        ? [{ column: measureColumn.trim(), agg }]
        : [],
    }),
    [dimensions, measureColumn, agg],
  );

  function saveChart() {
    setError(null);
    if (!name.trim() || !datasetId) {
      setError('Name and dataset are required');
      return;
    }
    startTransition(async () => {
      try {
        const { entity } = await createChartAction({
          name: name.trim(),
          workbookId,
          datasetId,
          type: chartType,
          configJson: draftSpec,
          filtersJson: [],
        });
        setCharts((prev) => [entity, ...prev]);
        setName('');
        setDimensions('');
        setMeasureColumn('');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save chart');
      }
    });
  }

  function previewDraft() {
    // Live preview requires a saved chart id; create a transient one is
    // overkill for the MVP. We rely on saving + previewing for now and
    // show a hint instead.
    setError(
      'Save the chart first — live preview re-runs against the saved id.',
    );
  }

  function removeChart(chartId: string) {
    startTransition(async () => {
      await deleteChartAction(chartId);
      setCharts((prev) => prev.filter((c) => c._id !== chartId));
      router.refresh();
    });
  }

  function runSavedChart(chartId: string) {
    startTransition(async () => {
      try {
        const res = await runChartAction(chartId);
        setPreviewResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to run chart');
      }
    });
  }

  return (
    <div className="grid gap-[var(--st-space-4)] lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal size={16} aria-hidden="true" />
            Chart builder
          </CardTitle>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Type dimension / measure column names. Saved charts run via the Rust
            query exec layer.
          </p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ch-name">Name</Label>
            <Input
              id="ch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Revenue by region"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Dataset</Label>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a dataset" />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as BiChartType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ch-dims">Dimensions (comma-separated)</Label>
            <Input
              id="ch-dims"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="region, month"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ch-meas">Measure column</Label>
            <Input
              id="ch-meas"
              value={measureColumn}
              onChange={(e) => setMeasureColumn(e.target.value)}
              placeholder="amount"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Aggregation</Label>
            <Select value={agg} onValueChange={(v) => setAgg(v as BiChartAgg)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGGS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-[var(--st-danger)]">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={saveChart} disabled={pending} iconLeft={Plus}>
              {pending ? 'Saving…' : 'Save chart'}
            </Button>
            <Button
              variant="ghost"
              onClick={previewDraft}
              disabled={pending}
              iconLeft={PlayCircle}
            >
              Preview
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-[var(--st-space-4)]">
        {previewResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle size={16} aria-hidden="true" />
                Preview
                <Badge tone="info">{previewResult.mode}</Badge>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <ChartPreview
                chartType={chartType}
                rows={previewResult.rows}
                columns={previewResult.columns}
              />
            </CardBody>
          </Card>
        )}

        {charts.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={BarChart3}
                tone="info"
                title="No charts saved"
                description="Build a chart on the left and click Save to persist it here."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-[var(--st-space-4)] xl:grid-cols-2">
            {charts.map((c) => (
              <SavedChartCard
                key={c._id}
                chart={c}
                onRun={() => runSavedChart(c._id)}
                onRemove={() => removeChart(c._id)}
                workbookId={workbookId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SavedChartCard({
  chart,
  workbookId,
  onRun,
  onRemove,
}: {
  chart: BiChartDoc;
  workbookId: string;
  onRun: () => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex items-center gap-2">
              <BarChart3
                size={16}
                className="text-[var(--st-accent)]"
                aria-hidden="true"
              />
              {chart.name}
            </CardTitle>
            <div>
              <Badge tone="neutral">{chart.type}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onRun} iconLeft={PlayCircle}>
              Run
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a
                href={`/dashboard/analytics-workspace/workbooks/${workbookId}/${chart._id}`}
              >
                <Maximize2 size={14} aria-hidden="true" />
                Drilldown
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRemove}
              iconLeft={Trash2}
              aria-label={`Remove ${chart.name}`}
            >
              Remove
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
