'use client';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { ChevronDown,
  ChevronRight,
  History,
  LoaderCircle,
  RefreshCw } from 'lucide-react';

import { listTelegramFlowRuns } from '@/app/actions/telegram-flows.actions';
import type { RunRow } from '@/lib/rust-client/telegram-flows';

/**
 * Bottom-strip run log. Paginated via cursor. Each entry expands to show the
 * per-step trace produced by the test endpoint (or by a future runtime).
 */

type Props = {
  flowId: string;
  projectId: string;
  /** Bumping this counter re-loads the run log, used after running "Test". */
  refreshKey?: number;
};

function fmt(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
}

function statusVariant(s: string): 'default' | 'secondary' | 'danger' | 'outline' {
  if (s === 'success') return 'default';
  if (s === 'error') return 'danger';
  if (s === 'test') return 'secondary';
  return 'outline';
}

export function FlowRunLogPanel({ flowId, projectId, refreshKey = 0 }: Props) {
  const { toast } = useToast();
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
            tone: 'danger',
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
    // We intentionally omit `reload` from deps, it would loop on the cursor
    // state it reads. Only `flowId` / `refreshKey` should re-trigger here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, refreshKey]);

  return (
    <Card padding="none" className="flex flex-col">
      <CardHeader className="flex items-center justify-between border-b border-[var(--st-border)] p-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--st-text)]">Run log</h3>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Includes simulated runs from the Test panel.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={isLoading ? undefined : RefreshCw}
          onClick={() => reload(false)}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : null}
          Refresh
        </Button>
      </CardHeader>

      <CardBody className="max-h-64 overflow-y-auto p-0">
        {runs.length === 0 ? (
          <EmptyState
            size="sm"
            icon={History}
            title="No runs yet"
            description="Press Test to simulate a message."
            className="py-8"
          />
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {runs.map((r) => {
              const isOpen = expanded === r._id;
              return (
                <li key={r._id}>
                  <Button
                    variant="ghost"
                    block
                    onClick={() => setExpanded(isOpen ? null : r._id)}
                    aria-expanded={isOpen}
                    className={cn(
                      'justify-start gap-2 rounded-none px-3 py-2 text-left text-sm font-normal',
                    )}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    <span className="font-mono text-xs text-[var(--st-text-secondary)]">
                      {r._id.slice(-6)}
                    </span>
                    <span className="text-xs text-[var(--st-text-secondary)]">{fmt(r.startedAt)}</span>
                    <span className="ml-auto text-xs text-[var(--st-text-secondary)]">
                      {r.steps.length} step{r.steps.length === 1 ? '' : 's'}
                    </span>
                  </Button>
                  {isOpen ? (
                    <ol className="space-y-1 px-10 pb-3 text-xs">
                      {r.steps.map((s, i) => (
                        <li key={`${r._id}-${i}`} className="flex items-start gap-2">
                          <Badge variant={statusVariant(s.status)} className="shrink-0">
                            {s.status}
                          </Badge>
                          <span className="font-mono text-[var(--st-text-secondary)]">{s.nodeType}</span>
                          <span className="text-[var(--st-text)]">{s.message}</span>
                        </li>
                      ))}
                      {r.error ? (
                        <li className="text-[var(--st-text)]">Error: {r.error}</li>
                      ) : null}
                    </ol>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>

      {nextCursor ? (
        <CardFooter className="border-t border-[var(--st-border)] p-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            block
            disabled={isLoading}
            onClick={() => {
              setCursor(nextCursor);
              reload(true);
            }}
          >
            Load more
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
