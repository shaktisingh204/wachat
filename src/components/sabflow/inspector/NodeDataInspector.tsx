'use client';

/**
 * NodeDataInspector — right-side sliding panel showing per-node
 * Input / Output / Parameters / Error JSON for the selected block.
 *
 * Designed to sit alongside the existing Typebot-style block settings
 * panel without replacing it.  Subscribes to the `nodeData` store so it
 * re-renders live as the engine reports status changes.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  LuX,
  LuCopy,
  LuPin,
  LuSearch,
  LuTable,
  LuCode,
  LuBraces,
  LuCircleAlert,
  LuTriangleAlert,
} from 'react-icons/lu';
import type { Block, Group } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { useNodeDataStore } from '@/lib/sabflow/execution/nodeData';
import { getRegistryEntry } from '@/components/sabflow/editor/blockRegistry';
import { NodeStatusBadge } from './NodeStatusBadge';
import { JsonTreeView } from './JsonTreeView';
import { JsonTableView } from './JsonTableView';

/* ── Types ───────────────────────────────────────────────────────── */

type TabKey = 'input' | 'output' | 'parameters' | 'error';

interface Props {
  nodeId: string;
  onClose: () => void;
  block?: Block;
  group?: Group;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_k, v: unknown) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v as object)) return '[Circular]';
          seen.add(v as object);
        }
        return v;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

async function writeToClipboard(text: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    /* no-op */
  }
}

function humanizeBlockLabel(block: Block | undefined): string {
  if (!block) return 'Node';
  const entry = getRegistryEntry(block.type);
  return entry?.label ?? block.type;
}

/* ── Tab button ─────────────────────────────────────────────────── */

interface TabButtonProps {
  label: string;
  active: boolean;
  accent?: 'default' | 'red';
  onClick: () => void;
}

function TabButton({ label, active, accent = 'default', onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative px-3 py-2 text-[12px] font-medium transition-colors',
        active
          ? accent === 'red'
            ? 'text-red-600 dark:text-red-400'
            : 'text-[var(--gray-12)]'
          : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
      )}
    >
      {label}
      <span
        className={cn(
          'absolute left-0 right-0 -bottom-px h-0.5 rounded-full',
          active
            ? accent === 'red'
              ? 'bg-red-500'
              : 'bg-[#f76808]'
            : 'bg-transparent',
        )}
      />
    </button>
  );
}

/* ── Main panel ─────────────────────────────────────────────────── */

function NodeDataInspectorImpl({ nodeId, onClose, block, group }: Props) {
  const nodeEntry = useNodeDataStore((s) => s.entries[nodeId]);
  const pinnedOutput = useNodeDataStore((s) => s.entries[nodeId]?.pinnedOutput);
  const pinData = useNodeDataStore((s) => s.pinData);
  const unpinData = useNodeDataStore((s) => s.unpinData);

  const isPinned = useNodeDataStore((s) => s.entries[nodeId]?.pinnedOutput !== undefined);

  const [tab, setTab] = useState<TabKey>('output');
  const [filter, setFilter] = useState('');
  const [viewAsTable, setViewAsTable] = useState(false);

  // Reset filter when user switches node
  useEffect(() => {
    setFilter('');
    setViewAsTable(false);
    setTab('output');
  }, [nodeId]);

  /* ── Derived values ─────────────────────────────────────────── */

  // When output is pinned, the pinned value takes precedence for display.
  const effectiveOutput = isPinned ? pinnedOutput : nodeEntry?.lastOutput;
  const input = nodeEntry?.lastInput;
  // Fall back to block.options if the engine hasn't run yet — the store
  // doesn't track per-block parameters separately any more.
  const parameters: Record<string, unknown> = useMemo(() => {
    return (block?.options as Record<string, unknown> | undefined) ?? {};
  }, [block?.options]);

  const errorMessage = nodeEntry?.error;

  const displayedData: unknown = useMemo(() => {
    switch (tab) {
      case 'input':
        return input;
      case 'output':
        return effectiveOutput;
      case 'parameters':
        return parameters;
      case 'error':
        return errorMessage;
    }
  }, [tab, input, effectiveOutput, parameters, errorMessage]);

  /* ── Actions ────────────────────────────────────────────────── */

  const handlePinToggle = useCallback(() => {
    if (isPinned) {
      unpinData(nodeId);
    } else {
      pinData(nodeId, nodeEntry?.lastOutput);
    }
  }, [isPinned, nodeId, nodeEntry?.lastOutput, pinData, unpinData]);

  const handleCopy = useCallback(() => {
    void writeToClipboard(safeStringify(displayedData));
  }, [displayedData]);

  /* ── Render ─────────────────────────────────────────────────── */

  const nodeLabel = humanizeBlockLabel(block);
  const groupLabel = group?.title;

  const outputIsArrayOfObjects =
    Array.isArray(effectiveOutput) &&
    effectiveOutput.every(
      (v) => !!v && typeof v === 'object' && !Array.isArray(v),
    );

  return (
    <div
      className={cn(
        'shrink-0 flex flex-col w-[380px] bg-[var(--gray-1)] z-20 overflow-hidden',
        'border-l border-[var(--gray-5)]',
        isPinned && 'ring-2 ring-inset ring-amber-400/60',
      )}
      aria-label="Node data inspector"
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[var(--gray-4)] px-3 py-2.5 shrink-0">
        <LuBraces className="h-4 w-4 text-[#f76808]" strokeWidth={2} />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-[var(--gray-12)] truncate">
              {nodeLabel}
            </span>
            <NodeStatusBadge nodeId={nodeId} size="xs" showIdle />
          </div>
          {groupLabel && (
            <span className="text-[11px] text-[var(--gray-9)] truncate">
              in {groupLabel}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close inspector"
          aria-label="Close inspector"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
        >
          <LuX className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* ── Filter ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 border-b border-[var(--gray-4)] px-3 py-2 shrink-0">
        <LuSearch
          className="h-3.5 w-3.5 text-[var(--gray-8)] shrink-0"
          strokeWidth={2}
        />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter keys…"
          className="flex-1 min-w-0 bg-transparent outline-none text-[12px] text-[var(--gray-12)] placeholder:text-[var(--gray-7)]"
        />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-[var(--gray-4)] px-2 shrink-0">
        <TabButton label="Input" active={tab === 'input'} onClick={() => setTab('input')} />
        <TabButton label="Output" active={tab === 'output'} onClick={() => setTab('output')} />
        <TabButton
          label="Parameters"
          active={tab === 'parameters'}
          onClick={() => setTab('parameters')}
        />
        <TabButton
          label={errorMessage ? 'Error ●' : 'Error'}
          active={tab === 'error'}
          accent="red"
          onClick={() => setTab('error')}
        />
      </div>

      {/* ── Toolbar (Output only) ─────────────────────────────── */}
      {tab === 'output' && (
        <div className="flex items-center gap-1.5 border-b border-[var(--gray-4)] px-2 py-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePinToggle}
            title={isPinned ? 'Unpin data' : 'Pin output data'}
            aria-pressed={isPinned}
            className={cn(
              'flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium transition-colors',
              isPinned
                ? 'bg-amber-100 text-amber-700 border border-amber-400/50 dark:bg-amber-950/40 dark:text-amber-300'
                : 'text-[var(--gray-10)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] border border-transparent',
            )}
          >
            <LuPin className="h-3 w-3" strokeWidth={2} />
            {isPinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy JSON to clipboard"
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-[var(--gray-10)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
          >
            <LuCopy className="h-3 w-3" strokeWidth={2} />
            Copy JSON
          </button>
          <button
            type="button"
            onClick={() => setViewAsTable((v) => !v)}
            disabled={!outputIsArrayOfObjects}
            title={
              outputIsArrayOfObjects
                ? 'Toggle table view'
                : 'Table view requires an array of objects'
            }
            aria-pressed={viewAsTable}
            className={cn(
              'flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium transition-colors',
              viewAsTable
                ? 'bg-[var(--gray-4)] text-[var(--gray-12)]'
                : 'text-[var(--gray-10)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
              !outputIsArrayOfObjects && 'opacity-50 cursor-not-allowed',
            )}
          >
            {viewAsTable ? (
              <LuCode className="h-3 w-3" strokeWidth={2} />
            ) : (
              <LuTable className="h-3 w-3" strokeWidth={2} />
            )}
            {viewAsTable ? 'JSON' : 'Table'}
          </button>
          <div className="ml-auto text-[10.5px] tabular-nums text-[var(--gray-8)]">
            {nodeEntry?.executionTimeMs !== undefined &&
              `${nodeEntry.executionTimeMs} ms`}
          </div>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {tab === 'error' ? (
          errorMessage ? (
            <div className="rounded-md border border-red-500/30 bg-red-50 dark:bg-red-950/30 p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-red-700 dark:text-red-300 mb-2">
                <LuCircleAlert className="h-3.5 w-3.5" strokeWidth={2} />
                Execution error
              </div>
              <pre className="text-[11.5px] font-mono leading-relaxed whitespace-pre-wrap break-words text-red-700 dark:text-red-300">
                {errorMessage}
              </pre>
            </div>
          ) : (
            <EmptyState
              icon="triangle"
              text="No error recorded for this node."
            />
          )
        ) : displayedData === undefined ? (
          <EmptyState
            icon="triangle"
            text={
              tab === 'output'
                ? 'No output yet. Run the flow to populate.'
                : tab === 'input'
                  ? 'No input captured yet.'
                  : 'No parameters.'
            }
          />
        ) : tab === 'output' && viewAsTable ? (
          <JsonTableView data={displayedData} />
        ) : (
          <JsonTreeView data={displayedData} searchQuery={filter} />
        )}
      </div>
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────── */

function EmptyState({ icon, text }: { icon: 'triangle' | 'alert'; text: string }) {
  const Icon = icon === 'triangle' ? LuTriangleAlert : LuCircleAlert;
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Icon
        className="h-5 w-5 text-[var(--gray-8)]"
        strokeWidth={1.75}
      />
      <p className="text-[12px] text-[var(--gray-9)] max-w-[260px]">{text}</p>
    </div>
  );
}

export const NodeDataInspector = memo(NodeDataInspectorImpl);
