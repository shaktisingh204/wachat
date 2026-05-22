'use client';

import { Badge, Button, Card, useZoruToast } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { ChevronDown,
  ChevronRight,
  LoaderCircle,
  RefreshCw } from 'lucide-react';

import { listTelegramFlowRuns } from '@/app/actions/telegram-flows.actions';
import type { RunRow } from '@/lib/rust-client/telegram-flows';

/**
 * Bottom-strip run log. Paginated via cursor — each entry expands to show the
 * per-step trace produced by the test endpoint (or by a future runtime).
 */

import { cn } from '@/lib/utils';

type Props = {
  flowId: string;
  projectId: string;
  /** Bumping this counter re-loads the run log — used after running "Test". */
  refreshKey?: number;
};

function fmt(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function statusVariant(s: string): 'default' | 'secondary' | 'danger' | 'outline' {
  if (s === 'success') return 'default';
  if (s === 'error') return 'danger';
  if (s === 'test') return 'secondary';
  return 'outline';
}

export function FlowRunLogPanel({ flowId, projectId, refreshKey = 0 }: Props) {
  const { toast } = useZoruToast();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const reload = useCallback(
    (append = false) => {
      startLoading(async () => {
        const res = await listTelegramFlowRuns(flowId, projectId, {
          cursor: append ? cursor : undefined,
          limit: 25,
        });
        if (res.error) {
          toast({
            title: 'Run log',
            description: res.error,
            variant: 'destructive',
          });
          return;
        }
        setRuns((prev) => (append ? [...prev, ...res.runs] : res.runs));
        setNextCursor(res.nextCursor);
      });
    },
    [cursor, flowId, projectId, toast],
  );

  useEffect(() => {
    // Reset and reload whenever the flow or the refresh key changes.
    setCursor(undefined);
    setRuns([]);
    setNextCursor(undefined);
    reload(false);
    // We intentionally omit `reload` from deps — it would loop on the cursor
    // state it reads. Only `flowId` / `refreshKey` should re-trigger here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, refreshKey]);

  return (
    <Card className="flex flex-col">
      <header className="flex items-center justify-between border-b p-3">
        <div>
          <h3 className="text-sm font-semibold">Run log</h3>
          <p className="text-xs text-muted-foreground">
            Includes simulated runs from the Test panel.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => reload(false)}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoaderCircle className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh
        </Button>
      </header>

      <div className="max-h-64 overflow-y-auto">
        {runs.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">
            No runs yet. Press <strong>Test</strong> to simulate a message.
          </p>
        ) : (
          <ul className="divide-y">
            {runs.map((r) => {
              const isOpen = expanded === r._id;
              return (
                <li key={r._id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : r._id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50',
                    )}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r._id.slice(-6)}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmt(r.startedAt)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {r.steps.length} step{r.steps.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  {isOpen ? (
                    <ol className="space-y-1 px-10 pb-3 text-xs">
                      {r.steps.map((s, i) => (
                        <li key={`${r._id}-${i}`} className="flex items-start gap-2">
                          <Badge variant={statusVariant(s.status)} className="shrink-0">
                            {s.status}
                          </Badge>
                          <span className="font-mono text-muted-foreground">{s.nodeType}</span>
                          <span>{s.message}</span>
                        </li>
                      ))}
                      {r.error ? (
                        <li className="text-destructive">Error: {r.error}</li>
                      ) : null}
                    </ol>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {nextCursor ? (
        <footer className="border-t p-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={() => {
              setCursor(nextCursor);
              reload(true);
            }}
          >
            Load more
          </Button>
        </footer>
      ) : null}
    </Card>
  );
}
