'use client';

/**
 * UpstreamDataPicker — the popover dropdown opened from a DataPickerInput.
 *
 * Layout (mirrors the user's diagram):
 *
 *   ┌───────────────────────────────────────┐
 *   │  Search…                              │  ← global, fuzzy
 *   ├───────────────────────────────────────┤
 *   │  ▸ WhatsApp Trigger        5          │  ← collapsible sections
 *   │  ▾ OpenAI                  10         │
 *   │      Str  Message content   "…"       │  ← rows
 *   │      Num  Total tokens      245       │
 *   │      ...                              │
 *   │  ▸ ElevenLabs              10         │
 *   └───────────────────────────────────────┘
 *
 * Beyond n8n/Typebot:
 *  - search filters across *all* nodes at once (not per-node)
 *  - per-field live preview from the last run
 *  - type-aware cast suggestion (`.toNumber()` when the consuming input is numeric)
 *  - keyboard nav ↑/↓ + Enter, Esc to close
 *  - includes the flow's variables under a "Variables" section so picker is
 *    the single point of reference for any insertable value
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { LuSearch, LuX, LuVariable, LuSparkles } from 'react-icons/lu';
import {
  tokenForField,
  type NodeOutputField,
  type UpstreamNode,
} from '@/lib/sabflow/nodeOutputs';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { NodeOutputBadge } from './NodeOutputBadge';
import { NodeOutputRow } from './NodeOutputRow';

type Props = {
  upstream: UpstreamNode[];
  variables: Variable[];
  /** Used to surface a `.toNumber()` cast hint on string fields. */
  expectedType?: 'string' | 'number';
  onPick: (token: string) => void;
  onClose: () => void;
};

/**
 * Built-in globals available in every expression scope. Mirrors the n8n
 * data-proxy globals our runner now exposes (see `expression-runner.ts`).
 * Surfaced here so users can discover them without memorising syntax.
 */
type GlobalEntry = {
  id: string;
  label: string;
  description: string;
  /** Token inserted into the input when picked. */
  insert: string;
  /** Free-text tokens used for fuzzy search matching. */
  searchTokens: string;
};

const GLOBAL_ENTRIES: GlobalEntry[] = [
  {
    id: 'prevNode-json',
    label: 'Previous node output',
    description: '$prevNode.json — JSON from the immediately upstream block.',
    insert: '{{ $prevNode.json. }}',
    searchTokens: 'prevnode previous upstream json',
  },
  {
    id: 'prevNode-name',
    label: 'Previous node name',
    description: '$prevNode.name — display name of the upstream block.',
    insert: '{{ $prevNode.name }}',
    searchTokens: 'prevnode previous name upstream',
  },
  {
    id: 'now',
    label: 'Now (formatted)',
    description: 'Current timestamp, Luxon-formatted (defaults to ISO).',
    insert: "{{ $now.toFormat('yyyy-MM-dd HH:mm:ss') }}",
    searchTokens: 'now today date time timestamp datetime',
  },
  {
    id: 'today',
    label: 'Today (UTC date)',
    description: "Today's date in UTC, ISO format.",
    insert: '{{ $today.toISODate() }}',
    searchTokens: 'today date day',
  },
  {
    id: 'workflow-id',
    label: 'Workflow id',
    description: '$workflow.id — id of the current flow.',
    insert: '{{ $workflow.id }}',
    searchTokens: 'workflow flow id',
  },
  {
    id: 'workflow-name',
    label: 'Workflow name',
    description: '$workflow.name — human-readable flow name.',
    insert: '{{ $workflow.name }}',
    searchTokens: 'workflow flow name',
  },
  {
    id: 'execution-id',
    label: 'Execution id',
    description: '$execution.id — id of the current run.',
    insert: '{{ $execution.id }}',
    searchTokens: 'execution run id',
  },
  {
    id: 'execution-mode',
    label: 'Execution mode',
    description: '$execution.mode — manual | trigger | test.',
    insert: '{{ $execution.mode }}',
    searchTokens: 'execution mode trigger manual',
  },
  {
    id: 'env',
    label: 'Environment variable',
    description: 'Read a whitelisted env var ($env.MY_KEY).',
    insert: '{{ $env.KEY_NAME }}',
    searchTokens: 'env environment variable secret config',
  },
  {
    id: 'jmespath',
    label: 'JMESPath query',
    description: 'Run a JMESPath query over JSON data.',
    insert: "{{ $jmesPath($json, '<query>') }}",
    searchTokens: 'jmespath jmes query path filter',
  },
  {
    id: 'datetime-now',
    label: 'DateTime.now()',
    description: 'Luxon DateTime instance — full formatting + math.',
    insert: "{{ DateTime.now().toFormat('yyyy-MM-dd') }}",
    searchTokens: 'datetime luxon date time',
  },
  {
    id: 'duration',
    label: 'Duration (Luxon)',
    description: 'Luxon Duration instance for time spans.',
    insert: "{{ Duration.fromObject({ days: 1 }) }}",
    searchTokens: 'duration luxon time span',
  },
  {
    id: 'interval',
    label: 'Interval (Luxon)',
    description: 'Luxon Interval instance for time ranges.',
    insert: "{{ Interval.fromDateTimes($now, $now.plus({ days: 1 })) }}",
    searchTokens: 'interval luxon time range',
  },
];

type FlatRow =
  | {
      kind: 'field';
      node: UpstreamNode;
      field: NodeOutputField;
    }
  | { kind: 'variable'; variable: Variable }
  | { kind: 'global'; entry: GlobalEntry };

export function UpstreamDataPicker({
  upstream,
  variables,
  expectedType,
  onPick,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus the search box on open.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matchingFields = useMemo(() => filterNodes(upstream, search), [upstream, search]);
  const matchingVars = useMemo(() => filterVars(variables, search), [variables, search]);
  const matchingGlobals = useMemo(() => filterGlobals(GLOBAL_ENTRIES, search), [search]);

  /* Flatten visible rows for keyboard navigation. */
  const flatRows = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    for (const node of matchingFields) {
      if (collapsed.has(node.blockId)) continue;
      for (const field of node.fields) {
        out.push({ kind: 'field', node, field });
      }
    }
    for (const v of matchingVars) out.push({ kind: 'variable', variable: v });
    for (const g of matchingGlobals) out.push({ kind: 'global', entry: g });
    return out;
  }, [matchingFields, collapsed, matchingVars, matchingGlobals]);

  // Reset focus when the search changes.
  useEffect(() => {
    setFocusIdx(0);
  }, [search]);

  const insertField = (
    node: UpstreamNode,
    field: NodeOutputField,
    cast?: 'number' | 'string',
  ) => {
    let token = tokenForField(node.displayName, field.key);
    if (cast === 'number') token = token.replace(/\}\}$/, '.toNumber() }}');
    if (cast === 'string') token = token.replace(/\}\}$/, '.toString() }}');
    onPick(token);
    onClose();
  };

  const insertVar = (variable: Variable) => {
    onPick(`{{ ${variable.name} }}`);
    onClose();
  };

  const insertGlobal = (entry: GlobalEntry) => {
    onPick(entry.insert);
    onClose();
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, Math.max(0, flatRows.length - 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = flatRows[focusIdx];
      if (!row) return;
      if (row.kind === 'field') insertField(row.node, row.field);
      else if (row.kind === 'variable') insertVar(row.variable);
      else insertGlobal(row.entry);
    }
  };

  const toggle = (blockId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  // Build a quick lookup so each row can ask "am I the focused one?"
  const focusedKey = flatRowKey(flatRows[focusIdx]);

  const noResults = flatRows.length === 0;

  return (
    <div
      className={cn(
        'absolute right-0 top-full z-50 mt-1 w-[320px] max-h-[420px]',
        'overflow-hidden rounded-xl border border-[var(--gray-5)]',
        'bg-[var(--gray-1)] shadow-xl',
      )}
      onMouseDown={(e) => {
        // Prevent the underlying input from losing focus when clicking inside
        // the popover — without this the picker would close on every click.
        e.preventDefault();
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-[var(--gray-4)] px-2.5 py-2">
        <LuSearch className="h-3.5 w-3.5 shrink-0 text-[var(--gray-9)]" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search node outputs…"
          className="flex-1 min-w-0 bg-transparent text-[12.5px] text-[var(--gray-12)] placeholder:text-[var(--gray-9)] outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-[var(--gray-9)] hover:text-[var(--gray-12)]"
            title="Clear search"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* List */}
      <div ref={listRef} className="max-h-[360px] overflow-y-auto p-1.5 space-y-1">
        {matchingFields.length === 0 &&
          matchingVars.length === 0 &&
          matchingGlobals.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <p className="text-[12px] text-[var(--gray-10)]">
                {upstream.length === 0
                  ? 'Connect this node to an upstream node to pick its output.'
                  : 'No matching fields.'}
              </p>
            </div>
          )}

        {matchingFields.map((node) => {
          const open = !collapsed.has(node.blockId);
          return (
            <div key={node.blockId} className="space-y-0.5">
              <NodeOutputBadge
                blockType={node.blockType}
                typeLabel={node.typeLabel}
                displayName={node.displayName}
                fieldCount={node.fields.length}
                distance={node.distance}
                hasLiveData={node.lastRun !== undefined && node.lastRun !== null}
                open={open}
                onToggle={() => toggle(node.blockId)}
              />
              {open && (
                <div className="pl-2">
                  {node.fields.map((field) => {
                    const key = `field:${node.blockId}:${field.key}`;
                    return (
                      <NodeOutputRow
                        key={field.key}
                        field={field}
                        focused={focusedKey === key}
                        castHint={
                          expectedType === 'number' && field.type === 'string'
                            ? 'number'
                            : undefined
                        }
                        onInsert={(f, cast) => insertField(node, f, cast)}
                        onFocus={() => {
                          const idx = flatRows.findIndex(
                            (r) => r.kind === 'field' && r.field.key === field.key && r.node.blockId === node.blockId,
                          );
                          if (idx >= 0) setFocusIdx(idx);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {matchingVars.length > 0 && (
          <div className="space-y-0.5 pt-2">
            <div className="flex items-center gap-2 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
              <LuVariable className="h-3 w-3" />
              Flow variables
            </div>
            {matchingVars.map((variable) => {
              const key = `var:${variable.id}`;
              return (
                <div
                  key={variable.id}
                  role="option"
                  aria-selected={focusedKey === key}
                  onMouseEnter={() => {
                    const idx = flatRows.findIndex(
                      (r) => r.kind === 'variable' && r.variable.id === variable.id,
                    );
                    if (idx >= 0) setFocusIdx(idx);
                  }}
                  onClick={() => insertVar(variable)}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5',
                    focusedKey === key ? 'bg-[#f76808]/10' : 'hover:bg-[var(--gray-3)]',
                  )}
                >
                  <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                    Var
                  </span>
                  <div className="flex flex-1 flex-col min-w-0 leading-tight">
                    <span className="truncate font-mono text-[12px] font-medium text-[var(--gray-12)]">
                      {variable.name}
                    </span>
                    {variable.value && (
                      <span className="truncate text-[10.5px] text-[var(--gray-9)]">
                        = {variable.value}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {matchingGlobals.length > 0 && (
          <div className="space-y-0.5 pt-2">
            <div className="flex items-center gap-2 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-9)]">
              <LuSparkles className="h-3 w-3" />
              Globals
            </div>
            {matchingGlobals.map((entry) => {
              const key = `global:${entry.id}`;
              return (
                <div
                  key={entry.id}
                  role="option"
                  aria-selected={focusedKey === key}
                  onMouseEnter={() => {
                    const idx = flatRows.findIndex(
                      (r) => r.kind === 'global' && r.entry.id === entry.id,
                    );
                    if (idx >= 0) setFocusIdx(idx);
                  }}
                  onClick={() => insertGlobal(entry)}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5',
                    focusedKey === key
                      ? 'bg-[#f76808]/10'
                      : 'hover:bg-[var(--gray-3)]',
                  )}
                >
                  <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                    Glb
                  </span>
                  <div className="flex flex-1 flex-col min-w-0 leading-tight">
                    <span className="truncate text-[12px] font-medium text-[var(--gray-12)]">
                      {entry.label}
                    </span>
                    <span className="truncate text-[10.5px] text-[var(--gray-9)]">
                      {entry.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {noResults && search && (
          <div className="px-2 py-2 text-[11px] text-[var(--gray-9)]">
            Tip: connect more nodes upstream to expand this list.
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-[var(--gray-4)] px-3 py-1.5 text-[10.5px] text-[var(--gray-9)]">
        <kbd className="rounded bg-[var(--gray-3)] px-1 font-mono text-[10px]">↑↓</kbd>{' '}
        navigate ·{' '}
        <kbd className="rounded bg-[var(--gray-3)] px-1 font-mono text-[10px]">Enter</kbd>{' '}
        insert ·{' '}
        <kbd className="rounded bg-[var(--gray-3)] px-1 font-mono text-[10px]">Esc</kbd>{' '}
        close
      </div>
    </div>
  );
}

/* ── Filtering helpers ──────────────────────────────────────────────────── */

function filterNodes(upstream: UpstreamNode[], q: string): UpstreamNode[] {
  if (!q.trim()) return upstream;
  const needle = q.toLowerCase();
  const out: UpstreamNode[] = [];
  for (const node of upstream) {
    const fields = node.fields.filter(
      (f) =>
        f.label.toLowerCase().includes(needle) ||
        f.key.toLowerCase().includes(needle) ||
        node.displayName.toLowerCase().includes(needle) ||
        node.typeLabel.toLowerCase().includes(needle),
    );
    if (fields.length > 0) out.push({ ...node, fields });
  }
  return out;
}

function filterVars(variables: Variable[], q: string): Variable[] {
  if (!q.trim()) return variables;
  const needle = q.toLowerCase();
  return variables.filter((v) => v.name.toLowerCase().includes(needle));
}

function filterGlobals(entries: GlobalEntry[], q: string): GlobalEntry[] {
  if (!q.trim()) return entries;
  const needle = q.toLowerCase();
  return entries.filter(
    (e) =>
      e.label.toLowerCase().includes(needle) ||
      e.description.toLowerCase().includes(needle) ||
      e.searchTokens.includes(needle),
  );
}

function flatRowKey(row: FlatRow | undefined): string | null {
  if (!row) return null;
  if (row.kind === 'field') return `field:${row.node.blockId}:${row.field.key}`;
  if (row.kind === 'variable') return `var:${row.variable.id}`;
  return `global:${row.entry.id}`;
}
