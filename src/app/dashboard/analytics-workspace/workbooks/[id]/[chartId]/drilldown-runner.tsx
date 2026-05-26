'use client';

import { useState, useTransition } from 'react';

import { runChartAction } from '@/app/actions/analytics-bi.actions';
import type {
  BiChartRunResponse,
  BiChartType,
  BiFilterOp,
} from '@/lib/rust-client/bi-charts';
import {
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';

import { ChartPreview } from '../chart-preview';

const OPS: BiFilterOp[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'];

interface FilterRow {
  column: string;
  op: BiFilterOp;
  value: string;
}

export function DrilldownRunner({
  chartId,
  chartType,
  initialRun,
}: {
  chartId: string;
  chartType: BiChartType;
  initialRun: BiChartRunResponse;
}) {
  const [filters, setFilters] = useState<FilterRow[]>([
    { column: '', op: 'eq', value: '' },
  ]);
  const [result, setResult] = useState<BiChartRunResponse>(initialRun);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    const extraFilters = filters
      .filter((f) => f.column.trim())
      .map((f) => ({
        column: f.column.trim(),
        op: f.op,
        value: coerceValue(f.value),
      }));
    startTransition(async () => {
      try {
        const res = await runChartAction(chartId, { extraFilters });
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to run chart');
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Filters</Label>
        {filters.map((f, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[1fr_140px_1fr_auto] items-center gap-2"
          >
            <Input
              value={f.column}
              onChange={(e) =>
                setFilters((prev) =>
                  prev.map((p, i) => (i === idx ? { ...p, column: e.target.value } : p)),
                )
              }
              placeholder="column"
            />
            <Select
              value={f.op}
              onValueChange={(v) =>
                setFilters((prev) =>
                  prev.map((p, i) => (i === idx ? { ...p, op: v as BiFilterOp } : p)),
                )
              }
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {OPS.map((o) => (
                  <ZoruSelectItem key={o} value={o}>
                    {o}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <Input
              value={f.value}
              onChange={(e) =>
                setFilters((prev) =>
                  prev.map((p, i) => (i === idx ? { ...p, value: e.target.value } : p)),
                )
              }
              placeholder="value"
            />
            <Button
              variant="ghost"
              onClick={() =>
                setFilters((prev) => prev.filter((_, i) => i !== idx))
              }
              disabled={filters.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              setFilters((prev) => [...prev, { column: '', op: 'eq', value: '' }])
            }
          >
            Add filter
          </Button>
          <Button onClick={run} disabled={pending}>
            {pending ? 'Running…' : 'Run drilldown'}
          </Button>
        </div>
        {error && <p className="text-sm text-zoru-danger">{error}</p>}
      </div>

      <ChartPreview
        chartType={chartType}
        rows={result.rows}
        columns={result.columns}
      />
    </div>
  );
}

function coerceValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^-?\d*\.\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}
