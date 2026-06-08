'use client';

/**
 * ScriptTestPanel - shown after the user clicks "Test run" in the Script
 * block's settings. Presents the sandbox's SandboxResult across four tabs:
 *
 *   - Result             - JSON-pretty-printed return value
 *   - Logs               - console.log / .error entries
 *   - Variables changed  - diff (before to after) for mutated variables
 *   - Error              - stack trace, only when the run failed
 */

import { useMemo } from 'react';
import {
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  Clock,
  X,
} from 'lucide-react';
import {
  Card,
  IconButton,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
  cn,
} from '@/components/sabcrm/20ui';
import type { SandboxResult } from '@/lib/sabflow/execution/sandbox';

type TabId = 'result' | 'logs' | 'vars' | 'error';

type Props = {
  result: SandboxResult;
  variablesBefore: Record<string, unknown>;
  onClose?: () => void;
};

export function ScriptTestPanel({ result, variablesBefore, onClose }: Props) {
  const defaultTab: TabId = result.success ? 'result' : 'error';

  const tabs: { id: TabId; label: string; disabled?: boolean }[] = useMemo(
    () => [
      { id: 'result', label: 'Result' },
      { id: 'logs', label: `Logs (${result.logs.length})` },
      {
        id: 'vars',
        label: `Variables (${Object.keys(result.variables ?? {}).length})`,
      },
      { id: 'error', label: 'Error', disabled: result.success },
    ],
    [result],
  );

  return (
    <Card
      variant="outlined"
      padding="none"
      className="20ui mt-1 overflow-hidden bg-[var(--st-bg-secondary)]"
    >
      {/* Header row */}
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2">
        {result.success ? (
          <CircleCheck
            className="h-3.5 w-3.5 shrink-0 text-[var(--st-status-ok)]"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        ) : (
          <CircleX
            className="h-3.5 w-3.5 shrink-0 text-[var(--st-danger)]"
            strokeWidth={2.2}
            aria-hidden="true"
          />
        )}
        <Badge tone={result.success ? 'success' : 'danger'} kind="soft">
          {result.success ? 'Passed' : 'Failed'}
        </Badge>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-[var(--st-text-secondary)]">
          <Clock className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
          {result.executionTimeMs}ms
        </span>
        {onClose && (
          <IconButton label="Close" icon={X} size="sm" onClick={onClose} />
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList
          aria-label="Test result sections"
          className="border-b border-[var(--st-border)] bg-[var(--st-bg)]"
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              disabled={t.disabled}
              className="flex-1 text-[11px]"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          value="result"
          className="max-h-[320px] overflow-y-auto p-3"
        >
          <ResultTab result={result} />
        </TabsContent>
        <TabsContent value="logs" className="max-h-[320px] overflow-y-auto p-3">
          <LogsTab logs={result.logs} />
        </TabsContent>
        <TabsContent value="vars" className="max-h-[320px] overflow-y-auto p-3">
          <VariablesTab
            before={variablesBefore}
            after={result.variables ?? {}}
          />
        </TabsContent>
        <TabsContent value="error" className="max-h-[320px] overflow-y-auto p-3">
          <ErrorTab message={result.error} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

/* -- Tabs ------------------------------------------------------------------- */

function ResultTab({ result }: { result: SandboxResult }) {
  // Hooks must run unconditionally, before any early return.
  const pretty = useMemo(() => safeStringify(result.returnValue), [result]);
  if (!result.success) {
    return (
      <EmptyState
        icon={Info}
        size="sm"
        tone="info"
        title="Script failed"
        description="See the Error tab for details."
      />
    );
  }
  return (
    <pre
      className={cn(
        'rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3',
        'font-mono text-[11.5px] leading-[1.55] text-[var(--st-text)]',
        'overflow-auto whitespace-pre-wrap break-words',
      )}
    >
      {pretty}
    </pre>
  );
}

function LogsTab({ logs }: { logs: SandboxResult['logs'] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Info}
        size="sm"
        tone="neutral"
        title="No log output"
        description="This run did not print any console messages."
      />
    );
  }
  return (
    <ul className="space-y-1">
      {logs.map((entry, idx) => (
        <li
          key={idx}
          className={cn(
            'flex items-start gap-2 rounded-[var(--st-radius-sm)] px-2 py-1.5',
            'font-mono text-[11.5px] leading-relaxed',
            entry.level === 'error'
              ? 'bg-[var(--st-danger-soft)] text-[var(--st-danger)]'
              : 'bg-[var(--st-bg)] text-[var(--st-text)]',
          )}
        >
          {entry.level === 'error' ? (
            <TriangleAlert
              className="mt-0.5 h-3 w-3 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
          ) : (
            <Info
              className="mt-0.5 h-3 w-3 shrink-0 text-[var(--st-text-secondary)]"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          )}
          <span className="whitespace-pre-wrap break-words">
            {entry.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

function VariablesTab({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const keys = useMemo(() => Object.keys(after), [after]);
  if (keys.length === 0) {
    return (
      <EmptyState
        icon={Info}
        size="sm"
        tone="neutral"
        title="No variables changed"
        description="The script did not mutate any flow variables."
      />
    );
  }
  return (
    <ul className="divide-y divide-[var(--st-border)] overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
      {keys.map((k) => {
        const b = safeStringify(before[k]);
        const a = safeStringify(after[k]);
        const changed = b !== a;
        return (
          <li key={k} className="px-3 py-2 text-[11.5px]">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-[var(--st-text)]">{k}</span>
              {changed && (
                <Badge tone="accent" kind="soft" className="text-[9.5px]">
                  changed
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <span className="text-[var(--st-text-secondary)]">before</span>
              <code className="whitespace-pre-wrap break-words font-mono text-[var(--st-text-secondary)]">
                {b}
              </code>
              <span className="text-[var(--st-text-secondary)]">after</span>
              <code
                className={cn(
                  'whitespace-pre-wrap break-words font-mono',
                  changed
                    ? 'text-[var(--st-text)]'
                    : 'text-[var(--st-text-secondary)]',
                )}
              >
                {a}
              </code>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ErrorTab({ message }: { message?: string }) {
  if (!message) {
    return (
      <EmptyState
        icon={Info}
        size="sm"
        tone="success"
        title="No error"
        description="The script ran without throwing."
      />
    );
  }
  return (
    <pre
      className={cn(
        'rounded-[var(--st-radius)] border border-[var(--st-danger)] bg-[var(--st-danger-soft)] p-3',
        'font-mono text-[11px] leading-relaxed text-[var(--st-danger)]',
        'overflow-auto whitespace-pre-wrap break-words',
      )}
    >
      {message}
    </pre>
  );
}

/* -- Helpers ---------------------------------------------------------------- */

function safeStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
