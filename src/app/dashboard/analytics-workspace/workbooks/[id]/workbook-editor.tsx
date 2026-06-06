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
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';

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
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Chart builder</CardTitle>
          <CardDescription>
            Drag-equivalent: type dimension / measure column names. Saved
            charts run via the Rust query exec layer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
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
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Pick a dataset" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {datasets.map((d) => (
                  <ZoruSelectItem key={d.id} value={d.id}>
                    {d.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as BiChartType)}>
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {CHART_TYPES.map((t) => (
                  <ZoruSelectItem key={t} value={t}>
                    {t}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
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
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {AGGS.map((a) => (
                  <ZoruSelectItem key={a} value={a}>
                    {a}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-[var(--st-danger)]">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={saveChart} disabled={pending}>
              {pending ? 'Saving…' : 'Save chart'}
            </Button>
            <Button variant="ghost" onClick={previewDraft} disabled={pending}>
              Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {previewResult && (
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Mode: {previewResult.mode}</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartPreview
                chartType={chartType}
                rows={previewResult.rows}
                columns={previewResult.columns}
              />
            </CardContent>
          </Card>
        )}

        {charts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No charts saved</CardTitle>
              <CardDescription>
                Build a chart on the left and click Save to persist it here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
          <div>
            <CardTitle>{chart.name}</CardTitle>
            <CardDescription>
              <Badge variant="outline">{chart.type}</Badge>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onRun}>
              Run
            </Button>
            <Button variant="ghost" asChild>
              <a
                href={`/dashboard/analytics-workspace/workbooks/${workbookId}/${chart._id}`}
              >
                Drilldown
              </a>
            </Button>
            <Button variant="ghost" onClick={onRemove}>
              Remove
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
