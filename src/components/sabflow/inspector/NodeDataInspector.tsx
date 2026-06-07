'use client';

/**
 * NodeDataInspector - right-side sliding panel showing per-node
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
  X,
  Copy,
  Pin,
  Search,
  Table as TableIcon,
  Code,
  Braces,
  CircleAlert,
} from 'lucide-react';
import type { Block, Group } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { useNodeDataStore } from '@/lib/sabflow/execution/nodeData';
import { getRegistryEntry } from '@/components/sabflow/editor/blockRegistry';
import {
  Alert,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  useToast,
} from '@/components/sabcrm/20ui';
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

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* no-op */
  }
  return false;
}

function humanizeBlockLabel(block: Block | undefined): string {
  if (!block) return 'Node';
  const entry = getRegistryEntry(block.type);
  return entry?.label ?? block.type;
}

/* ── Main panel ─────────────────────────────────────────────────── */

function NodeDataInspectorImpl({ nodeId, onClose, block, group }: Props) {
  const { toast } = useToast();
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
  // Fall back to block.options if the engine hasn't run yet - the store
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
      toast.info('Output unpinned');
    } else {
      pinData(nodeId, nodeEntry?.lastOutput);
      toast.success('Output pinned');
    }
  }, [isPinned, nodeId, nodeEntry?.lastOutput, pinData, unpinData, toast]);

  const handleCopy = useCallback(() => {
    void writeToClipboard(safeStringify(displayedData)).then((ok) => {
      if (ok) toast.success('JSON copied to clipboard');
      else toast.error('Could not copy to clipboard');
    });
  }, [displayedData, toast]);

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
        'shrink-0 flex flex-col w-[380px] bg-[var(--st-bg)] z-20 overflow-hidden',
        'border-l border-[var(--st-border)]',
        isPinned && 'ring-2 ring-inset ring-[var(--st-accent)]/60',
      )}
      aria-label="Node data inspector"
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] px-3 py-2.5 shrink-0">
        <Braces className="h-4 w-4 text-[var(--st-text)]" strokeWidth={2} aria-hidden="true" />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-[var(--st-text)] truncate">
              {nodeLabel}
            </span>
            <NodeStatusBadge nodeId={nodeId} size="xs" showIdle />
          </div>
          {groupLabel && (
            <span className="text-[11px] text-[var(--st-text-secondary)] truncate">
              in {groupLabel}
            </span>
          )}
        </div>
        <IconButton
          icon={X}
          label="Close inspector"
          size="sm"
          onClick={onClose}
        />
      </div>

      {/* ── Filter ────────────────────────────────────────────── */}
      <div className="border-b border-[var(--st-border)] px-3 py-2 shrink-0">
        <Field label="Filter keys" className="[&_.u-field__label]:sr-only">
          <Input
            inputSize="sm"
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter keys..."
            iconLeft={Search}
          />
        </Field>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="border-b border-[var(--st-border)] px-2 shrink-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList aria-label="Node data view">
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="error">
              {errorMessage ? 'Error ●' : 'Error'}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Toolbar (Output only) ─────────────────────────────── */}
      {tab === 'output' && (
        <div className="flex items-center gap-1.5 border-b border-[var(--st-border)] px-2 py-1.5 shrink-0">
          <Button
            size="sm"
            variant={isPinned ? 'primary' : 'ghost'}
            iconLeft={Pin}
            onClick={handlePinToggle}
            aria-pressed={isPinned}
            title={isPinned ? 'Unpin data' : 'Pin output data'}
          >
            {isPinned ? 'Pinned' : 'Pin'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            iconLeft={Copy}
            onClick={handleCopy}
            title="Copy JSON to clipboard"
          >
            Copy JSON
          </Button>
          <Button
            size="sm"
            variant={viewAsTable ? 'secondary' : 'ghost'}
            iconLeft={viewAsTable ? Code : TableIcon}
            onClick={() => setViewAsTable((v) => !v)}
            disabled={!outputIsArrayOfObjects}
            aria-pressed={viewAsTable}
            title={
              outputIsArrayOfObjects
                ? 'Toggle table view'
                : 'Table view requires an array of objects'
            }
          >
            {viewAsTable ? 'JSON' : 'Table'}
          </Button>
          <div className="ml-auto text-[10.5px] tabular-nums text-[var(--st-text-tertiary)]">
            {nodeEntry?.executionTimeMs !== undefined &&
              `${nodeEntry.executionTimeMs} ms`}
          </div>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {tab === 'error' ? (
          errorMessage ? (
            <Alert tone="danger" title="Execution error" icon={CircleAlert}>
              <pre className="text-[11.5px] font-mono leading-relaxed whitespace-pre-wrap break-words">
                {errorMessage}
              </pre>
            </Alert>
          ) : (
            <EmptyState
              icon={CircleAlert}
              title="No error recorded for this node."
              size="sm"
            />
          )
        ) : displayedData === undefined ? (
          <EmptyState
            icon={CircleAlert}
            size="sm"
            title={
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

export const NodeDataInspector = memo(NodeDataInspectorImpl);
