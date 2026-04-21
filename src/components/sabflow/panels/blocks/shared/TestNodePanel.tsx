'use client';

/**
 * TestNodePanel — n8n-style "Execute this node" runner, rendered as a
 * collapsible section at the bottom of every block settings panel.
 *
 * Responsibilities:
 *   - Collect a sample JSON input + variables JSON.
 *   - Invoke testNode() with the block, input, variables, and optional
 *     credentials, then push the result into the nodeData store.
 *   - Render the most recent result (status pill, duration, output tree,
 *     logs, and an error banner) below the run controls.
 */

import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  LuChevronDown,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuLoader,
  LuPlay,
} from 'react-icons/lu';
import { testNode, type TestNodeResult } from '@/lib/sabflow/execution/testNode';
import {
  useNodeDataStore,
  type NodeTestLog,
} from '@/lib/sabflow/execution/nodeData';
import { useNodeContext } from '@/lib/sabflow/execution/useNodeContext';
import type { Block, SabFlowDoc } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { PinDataButton } from '@/components/sabflow/panels/blocks/shared/PinDataButton';

/* ── Props ───────────────────────────────────────────────────────────────── */

type TestNodePanelProps = {
  block: Block;
  flow: SabFlowDoc;
  /** When provided, pin/unpin writes to `block.pinData` via this callback. */
  onBlockChange?: (changes: Partial<Block>) => void;
};

/**
 * Walk the flow edges and return the set of block IDs upstream of the target.
 * Used to build the pinned-upstream map that feeds into testNode.
 */
function getUpstreamBlockIds(flow: SabFlowDoc, blockId: string): Set<string> {
  const upstream = new Set<string>();
  const queue: string[] = [blockId];
  const seen = new Set<string>([blockId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of flow.edges) {
      if (edge.to.blockId === current) {
        const sourceId =
          'blockId' in edge.from ? edge.from.blockId : undefined;
        if (sourceId && !seen.has(sourceId)) {
          seen.add(sourceId);
          upstream.add(sourceId);
          queue.push(sourceId);
        }
      }
    }
  }
  return upstream;
}

type Tab = 'input' | 'variables';

/* ── Utilities ───────────────────────────────────────────────────────────── */

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? '');
  }
}

function parseJson(text: string): {
  value: Record<string, unknown>;
  error?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) return { value: {} };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { value: parsed as Record<string, unknown> };
    }
    return { value: {}, error: 'JSON must be an object' };
  } catch (err) {
    return {
      value: {},
      error: err instanceof Error ? err.message : 'Invalid JSON',
    };
  }
}

function buildVariablesSeed(flow: SabFlowDoc): Record<string, unknown> {
  const seed: Record<string, unknown> = {};
  for (const v of flow.variables) {
    if (v.defaultValue !== undefined) {
      seed[v.name] = v.defaultValue;
    } else if (v.value !== undefined) {
      seed[v.name] = v.value;
    } else {
      seed[v.name] = '';
    }
  }
  return seed;
}

/* ── Collapsible wrapper ─────────────────────────────────────────────────── */

type CollapsibleProps = {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function Collapsible({ title, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const Chevron = open ? LuChevronDown : LuChevronRight;

  return (
    <div className="mt-6 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-[var(--gray-12)] hover:bg-[var(--gray-3)] transition-colors"
        aria-expanded={open}
      >
        <Chevron className="h-3.5 w-3.5 text-[var(--gray-10)]" strokeWidth={2} />
        <span className="flex-1">{title}</span>
      </button>
      {open ? (
        <div className="border-t border-[var(--gray-5)] p-3 bg-[var(--gray-1)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ── Status pill ─────────────────────────────────────────────────────────── */

type Status = 'idle' | 'running' | 'success' | 'error';

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; Icon: typeof LuLoader; className: string }> = {
    idle: {
      label: 'Not run',
      Icon: LuCircleCheck,
      className: 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-10)]',
    },
    running: {
      label: 'Running…',
      Icon: LuLoader,
      className: 'border-[#f76808]/40 bg-[#f76808]/10 text-[#f76808]',
    },
    success: {
      label: 'Success',
      Icon: LuCircleCheck,
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    error: {
      label: 'Error',
      Icon: LuCircleAlert,
      className: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
    },
  };
  const { label, Icon, className } = map[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
        className,
      )}
    >
      <Icon
        className={cn('h-3 w-3', status === 'running' && 'animate-spin')}
        strokeWidth={2}
      />
      {label}
    </span>
  );
}

/* ── Logs list ───────────────────────────────────────────────────────────── */

function LogList({ logs }: { logs: NodeTestLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--gray-5)] px-3 py-2 text-[11.5px] text-[var(--gray-9)]">
        No logs.
      </div>
    );
  }
  return (
    <ul className="space-y-1 font-mono text-[11px]">
      {logs.map((log, i) => (
        <li
          // Logs are append-only and stable per run; index is acceptable here.
          // eslint-disable-next-line react/no-array-index-key
          key={`${log.level}-${i}`}
          className={cn(
            'rounded border px-2 py-1',
            log.level === 'error'
              ? 'border-red-500/40 bg-red-500/5 text-red-600 dark:text-red-400'
              : log.level === 'warn'
                ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400'
                : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-11)]',
          )}
        >
          <span className="mr-1 font-semibold uppercase tracking-wide">
            {log.level}
          </span>
          {log.message}
        </li>
      ))}
    </ul>
  );
}

/* ── Result panel ────────────────────────────────────────────────────────── */

type ResultPanelProps = {
  blockId: string;
  result: TestNodeResult | null;
  status: Status;
  onPersistPinData?: (value: unknown) => void;
  onClearPinData?: () => void;
  pinPersisted?: boolean;
};

function ResultPanel({
  blockId,
  result,
  status,
  onPersistPinData,
  onClearPinData,
  pinPersisted,
}: ResultPanelProps) {
  if (!result && status !== 'running') {
    return (
      <p className="mt-3 text-[11.5px] text-[var(--gray-9)]">
        Click <strong>Execute Node</strong> to run this block in isolation.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <StatusPill status={status} />
        {result ? (
          <span className="text-[11px] text-[var(--gray-10)]">
            {result.durationMs} ms
          </span>
        ) : null}
        <div className="flex-1" />
        {result && !result.error ? (
          <PinDataButton
            blockId={blockId}
            value={result.output}
            onPersistPin={onPersistPinData}
            onClearPin={onClearPinData}
            persisted={pinPersisted}
          />
        ) : null}
      </div>

      {result?.error ? (
        <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-2.5 text-[11.5px] text-red-700 dark:text-red-400">
          <LuCircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="break-all">{result.error}</span>
        </div>
      ) : null}

      {result ? (
        <div>
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-10)]">
            Output
          </div>
          <pre className="max-h-64 overflow-auto rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] p-2 font-mono text-[11px] leading-snug text-[var(--gray-12)]">
            {pretty(result.output)}
          </pre>
        </div>
      ) : null}

      {result ? (
        <div>
          <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-10)]">
            Logs
          </div>
          <LogList logs={result.logs} />
        </div>
      ) : null}
    </div>
  );
}

/* ── Main panel ──────────────────────────────────────────────────────────── */

function TestNodePanelInner({ block, flow, onBlockChange }: TestNodePanelProps) {
  const { getInput } = useNodeContext();
  const recordResult = useNodeDataStore((s) => s.recordResult);
  const cached = useNodeDataStore((s) => s.entries[block.id]);
  const upstreamEntries = useNodeDataStore((s) => s.entries);

  const [tab, setTab] = useState<Tab>('input');
  const [inputText, setInputText] = useState<string>(() =>
    pretty(getInput(block.id) ?? {}),
  );
  const [variablesText, setVariablesText] = useState<string>(() =>
    pretty(buildVariablesSeed(flow)),
  );
  const [status, setStatus] = useState<Status>(() =>
    cached?.lastResult
      ? cached.lastResult.error
        ? 'error'
        : 'success'
      : 'idle',
  );
  const [result, setResult] = useState<TestNodeResult | null>(
    () => cached?.lastResult ?? null,
  );

  const inputParsed = useMemo(() => parseJson(inputText), [inputText]);
  const variablesParsed = useMemo(
    () => parseJson(variablesText),
    [variablesText],
  );
  const parseError = inputParsed.error ?? variablesParsed.error ?? null;

  const handleUseLastInput = useCallback(() => {
    const last = getInput(block.id);
    if (last === undefined) return;
    setInputText(pretty(last));
    setTab('input');
  }, [getInput, block.id]);

  const handleExecute = useCallback(async () => {
    if (parseError) return;
    setStatus('running');

    const pinnedUpstream: Record<string, unknown> = {};
    const upstreamIds = getUpstreamBlockIds(flow, block.id);
    for (const id of upstreamIds) {
      const entry = upstreamEntries[id];
      const pinned = entry?.pinnedOutput ?? entry?.lastOutput;
      if (pinned !== undefined) pinnedUpstream[id] = pinned;
    }

    const r = await testNode({
      block,
      inputData: inputParsed.value,
      variables: variablesParsed.value,
      pinnedUpstream,
    });
    setResult(r);
    setStatus(r.error ? 'error' : 'success');
    recordResult(
      block.id,
      { ...r, ranAt: Date.now() },
      inputParsed.value,
    );
  }, [parseError, block, flow, inputParsed.value, variablesParsed.value, upstreamEntries, recordResult]);

  const activeText = tab === 'input' ? inputText : variablesText;
  const activeError =
    tab === 'input' ? inputParsed.error : variablesParsed.error;
  const setActiveText = tab === 'input' ? setInputText : setVariablesText;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div
        className="flex items-center gap-1 rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] p-0.5"
        role="tablist"
        aria-label="Test node inputs"
      >
        <TabButton active={tab === 'input'} onClick={() => setTab('input')}>
          Input
        </TabButton>
        <TabButton
          active={tab === 'variables'}
          onClick={() => setTab('variables')}
        >
          Variables
        </TabButton>
        <div className="flex-1" />
        {tab === 'input' ? (
          <button
            type="button"
            onClick={handleUseLastInput}
            className="rounded px-2 py-1 text-[10.5px] font-medium text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
            title="Load the last observed input for this block"
          >
            Use last input
          </button>
        ) : null}
      </div>

      {/* Textarea */}
      <div>
        <textarea
          value={activeText}
          onChange={(e) => setActiveText(e.target.value)}
          spellCheck={false}
          className={cn(
            'w-full min-h-[140px] resize-y rounded-md border bg-[var(--gray-2)] p-2 font-mono text-[11.5px] leading-snug text-[var(--gray-12)] outline-none transition-colors',
            activeError
              ? 'border-red-500/60 focus:border-red-500'
              : 'border-[var(--gray-5)] focus:border-[#f76808]',
          )}
          aria-invalid={Boolean(activeError)}
          aria-label={tab === 'input' ? 'Sample input JSON' : 'Variables JSON'}
        />
        {activeError ? (
          <p className="mt-1 text-[10.5px] text-red-600 dark:text-red-400">
            {activeError}
          </p>
        ) : null}
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={handleExecute}
        disabled={status === 'running' || Boolean(parseError)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
          'bg-[#f76808] text-white hover:bg-[#ef6c00]',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        {status === 'running' ? (
          <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <LuPlay className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        Execute Node
      </button>

      {/* Result */}
      <ResultPanel
        blockId={block.id}
        result={result}
        status={status}
        pinPersisted={block.pinData !== undefined}
        onPersistPinData={
          onBlockChange
            ? (value) => onBlockChange({ pinData: value })
            : undefined
        }
        onClearPinData={
          onBlockChange ? () => onBlockChange({ pinData: undefined }) : undefined
        }
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors',
        active
          ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
          : 'text-[var(--gray-10)] hover:text-[var(--gray-12)]',
      )}
    >
      {children}
    </button>
  );
}

/* ── Public wrapper (collapsible) ────────────────────────────────────────── */

export function TestNodePanel({ block, flow, onBlockChange }: TestNodePanelProps) {
  return (
    <Collapsible title="Test this node">
      <TestNodePanelInner
        block={block}
        flow={flow}
        onBlockChange={onBlockChange}
      />
    </Collapsible>
  );
}
