'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Database, Play, Plug, Terminal } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { runRawQueryAction } from '@/app/actions/sabbi-models.actions';
import type { BiChartRunResponse } from '@/lib/rust-client/bi-charts';
import type { BiModelDoc } from '@/lib/rust-client/bi-models';

import { ResultChart } from '../_components/result-chart';

const EXAMPLE = `[
  { "$group": { "_id": "$status", "count": { "$sum": 1 } } },
  { "$sort": { "count": -1 } }
]`;

const editorCls =
  'min-h-[220px] w-full resize-y rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-surface)] p-3 font-mono text-xs text-[var(--st-text)]';
const selectCls =
  'h-9 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-surface)] px-2 text-sm text-[var(--st-text)]';

export function QueryLab({ models }: { models: BiModelDoc[] }) {
  const [modelId, setModelId] = useState(models[0]?._id ?? '');
  const model = useMemo(() => models.find((m) => m._id === modelId), [models, modelId]);
  const [stagesText, setStagesText] = useState(EXAMPLE);
  const [result, setResult] = useState<BiChartRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, startRun] = useTransition();

  function run() {
    setError(null);
    let stages: Record<string, unknown>[];
    try {
      const parsed = JSON.parse(stagesText);
      if (!Array.isArray(parsed)) throw new Error('Pipeline must be a JSON array of stages.');
      stages = parsed as Record<string, unknown>[];
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
      return;
    }
    startRun(async () => {
      try {
        const res = await runRawQueryAction({ modelId, stages, limit: 500 });
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Query failed');
        setResult(null);
      }
    });
  }

  if (models.length === 0) {
    return (
      <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow>SabBI</PageEyebrow>
            <PageTitle>Query Lab</PageTitle>
          </PageHeaderHeading>
        </PageHeader>
        <EmptyState
          icon={Plug}
          tone="info"
          title="No models to query"
          description="Connect a module or create a model first."
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
          <PageEyebrow>SabBI · Raw</PageEyebrow>
          <PageTitle>Query Lab</PageTitle>
          <PageDescription>
            Author aggregation stages against a model. The tenant scope is
            enforced automatically; write stages are blocked.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-[var(--st-space-4)]">
          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Terminal size={16} aria-hidden="true" /> Pipeline
              </CardTitle>
              <div className="flex items-center gap-2">
                <select className={selectCls} value={modelId} onChange={(e) => setModelId(e.target.value)}>
                  {models.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={run} disabled={running}>
                  <Play size={14} aria-hidden="true" /> {running ? 'Running…' : 'Run'}
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              <textarea
                className={editorCls}
                value={stagesText}
                onChange={(e) => setStagesText(e.target.value)}
                spellCheck={false}
              />
              {error && <p className="mt-2 text-sm text-[var(--st-danger)]">{error}</p>}
            </CardBody>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Results
                  <Badge tone="neutral">{result.rows.length} rows</Badge>
                </CardTitle>
              </CardHeader>
              <CardBody>
                <ResultChart result={result} type="table" />
              </CardBody>
            </Card>
          )}
        </div>

        {/* Schema reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database size={16} aria-hidden="true" /> Schema
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3 text-xs">
            <div>
              <p className="text-[var(--st-text-secondary)]">Collection</p>
              <p className="font-mono">{model?.collection}</p>
            </div>
            <div>
              <p className="mb-1 text-[var(--st-text-secondary)]">Measure columns</p>
              <div className="flex flex-col gap-1">
                {(model?.measures ?? []).map((m) => (
                  <span key={m.key} className="font-mono">
                    {m.column ?? '(count)'} <span className="text-[var(--st-text-secondary)]">· {m.agg}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[var(--st-text-secondary)]">Dimension columns</p>
              <div className="flex flex-col gap-1">
                {(model?.dimensions ?? []).map((d) => (
                  <span key={d.key} className="font-mono">
                    {d.column}
                  </span>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
