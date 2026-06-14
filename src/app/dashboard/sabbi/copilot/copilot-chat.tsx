'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Code2, Plug, Send, Sparkles, User } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { askCopilotAction, type CopilotAnswer } from '@/app/actions/sabbi-copilot.actions';
import type { BiModelDoc } from '@/lib/rust-client/bi-models';

import { ResultChart, type ResultChartType } from '../_components/result-chart';

const selectCls =
  'h-9 rounded-[var(--st-radius-sm)] border border-[var(--st-border)] bg-[var(--st-surface)] px-2 text-sm text-[var(--st-text)]';

const EXAMPLES = [
  'Total by status',
  'Trend over the last months',
  'Top categories',
];

interface Turn {
  question: string;
  pending: boolean;
  result?: CopilotAnswer;
  showQuery?: boolean;
}

export function CopilotChat({ models }: { models: BiModelDoc[] }) {
  const [modelId, setModelId] = useState(models[0]?._id ?? '');
  const model = useMemo(() => models.find((m) => m._id === modelId), [models, modelId]);
  const formats = useMemo(
    () => Object.fromEntries((model?.measures ?? []).map((m) => [m.key, m.format])),
    [model],
  );
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, startTransition] = useTransition();

  function ask(q: string) {
    const question = q.trim();
    if (!question || !modelId) return;
    setInput('');
    const idx = turns.length;
    setTurns((t) => [...t, { question, pending: true }]);
    startTransition(async () => {
      const res = await askCopilotAction(modelId, question);
      setTurns((t) => t.map((turn, i) => (i === idx ? { ...turn, pending: false, result: res } : turn)));
    });
  }

  if (models.length === 0) {
    return (
      <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow>SabBI</PageEyebrow>
            <PageTitle>Copilot</PageTitle>
          </PageHeaderHeading>
        </PageHeader>
        <EmptyState
          icon={Plug}
          tone="info"
          title="Connect a model to ask the copilot"
          description="The copilot answers strictly from a governed model's measures and dimensions."
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
          <PageEyebrow>SabBI · AI</PageEyebrow>
          <PageTitle className="flex items-center gap-2">
            <Sparkles size={20} aria-hidden="true" /> Copilot
          </PageTitle>
          <PageDescription>
            Ask in plain English. Answers are built from a governed model — never
            raw text-to-SQL.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="flex flex-col gap-[var(--st-space-4)]">
        {turns.length === 0 && (
          <Card>
            <CardBody className="flex flex-col gap-2">
              <p className="text-sm text-[var(--st-text-secondary)]">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => ask(ex)} className="cursor-pointer">
                    <Badge tone="neutral">{ex}</Badge>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-[var(--st-text)]">
              <User size={14} aria-hidden="true" /> <span className="font-medium">{turn.question}</span>
            </div>
            <Card>
              <CardBody>
                {turn.pending ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                    <Sparkles size={14} aria-hidden="true" className="animate-pulse" /> Thinking…
                  </div>
                ) : turn.result?.ok ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-[var(--st-text)]">{turn.result.answer}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTurns((t) => t.map((x, j) => (j === i ? { ...x, showQuery: !x.showQuery } : x)))}
                      >
                        <Code2 size={14} aria-hidden="true" /> Query
                      </Button>
                    </div>
                    <ResultChart
                      result={turn.result.result}
                      type={(turn.result.query.chartType ?? 'bar') as ResultChartType}
                      formats={formats}
                    />
                    {turn.showQuery && (
                      <pre className="overflow-auto rounded-[var(--st-radius-sm)] bg-[var(--st-surface-2)] p-3 font-mono text-xs">
                        {JSON.stringify(turn.result.query, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--st-danger)]">{turn.result?.error ?? 'No answer.'}</p>
                )}
              </CardBody>
            </Card>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <select className={selectCls} value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {models.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ask(input);
            }}
            placeholder="Ask about this model…"
            disabled={pending}
            className="flex-1"
          />
          <Button onClick={() => ask(input)} disabled={pending || !input.trim()}>
            <Send size={16} aria-hidden="true" /> Ask
          </Button>
        </div>
      </div>
    </div>
  );
}
