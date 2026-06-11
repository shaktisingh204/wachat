'use client';

/**
 * CanvasNodeDefault - port of n8n's CanvasNodeDefault.vue.
 *
 * Renders the standard n8n rectangular node (icon + handles + description
 * beneath), plus trigger variant (left side rounded). Status borders, disabled
 * strike-through, running gradient-ring, hover toolbar - all ported visually.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Play, Plus, Trash2, Power, Copy, Circle } from 'lucide-react';
import { Button, IconButton, Input } from '@/components/sabcrm/20ui';
import { CanvasHandle } from '../handles/CanvasHandle';
import { CanvasConnectionMode, type CanvasNode, type CanvasNodeData } from '../types';
import { blockRegistryMap } from '@/components/sabflow/editor/blockRegistry';
import { getBlockIcon, getBlockColor } from '@/lib/sabflow/blocks';
import { cn } from '@/lib/utils';

type Props = NodeProps<CanvasNode> & {
  /** Add a new node downstream of this one. `handleId` identifies which
      specific output port to wire from - required for multi-output nodes
      like Condition (True/False), Switch (per-case), Choice (per-item),
      Loop (Loop/Done), AB-test (A/B), and integrations (Success/Error). */
  onAdd?: (nodeId: string, handleId: string) => void;
  onDelete?: (nodeId: string) => void;
  onToggleDisabled?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  onRename?: (nodeId: string, label: string) => void;
  /** ID of the node currently being renamed - switches its label to an input. */
  renamingId?: string;
  onRenameDone?: () => void;
  isReadOnly?: boolean;
};

/** Mirror of CanvasHandle's vertical distribution so a "+" lines up with its handle. */
function plusTopForIndex(total: number, index: number): string {
  if (total <= 1) return '50%';
  const min = 25;
  const max = 75;
  const step = (max - min) / (total - 1);
  return `${min + index * step}%`;
}

function RenameInput({
  initial,
  onCommit,
}: {
  initial: string;
  onCommit: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <Input
      ref={ref}
      value={value}
      inputSize="sm"
      aria-label="Rename node"
      className="nodrag nopan w-[90%] text-center [pointer-events:all]"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value.trim() || initial)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(value.trim() || initial);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCommit(initial);
        }
      }}
    />
  );
}

export const CanvasNodeDefault = memo(function CanvasNodeDefault({
  id,
  data,
  selected,
  onAdd,
  onDelete,
  onToggleDisabled,
  onDuplicate,
  onExecute,
  onRename,
  renamingId,
  onRenameDone,
  isReadOnly,
}: Props) {
  const d = data as CanvasNodeData;
  const entry = d.blockType ? blockRegistryMap.get(d.blockType) : undefined;
  // Fall back to the global block registry (rust/forge/preset types) so the
  // unified catalog's nodes don't render as a bare circle.
  const Icon =
    entry?.icon ?? (d.blockType ? getBlockIcon(d.blockType) ?? undefined : undefined);
  const accent =
    entry?.color ?? (d.blockType ? getBlockColor(d.blockType) : 'var(--st-accent)');

  const classes = useMemo(
    () =>
      cn(
        'sabflow-node',
        selected && 'is-selected',
        d.isTrigger && 'is-trigger',
        d.disabled && 'is-disabled',
        d.pinned && 'is-pinned',
        d.execution.status === 'success' && 'is-success',
        d.execution.status === 'error' && 'is-error',
        d.execution.status === 'waiting' && 'is-waiting',
        (d.execution.running || d.execution.status === 'running') && 'is-running',
        d.isUnconnected && 'is-unconnected',
      ),
    [selected, d.isTrigger, d.disabled, d.pinned, d.execution, d.isUnconnected],
  );

  // Strike-through only when disabled AND node has a single in/out on main.
  const singleMainIn = d.inputs.filter((p) => p.type === 'main').length === 1;
  const singleMainOut = d.outputs.filter((p) => p.type === 'main').length === 1;
  const showStrike = d.disabled && singleMainIn && singleMainOut;

  return (
    <div className={classes} data-node-id={id} data-testid="canvas-node">
      {/* Handles - left for inputs, right for outputs */}
      <CanvasHandle
        nodeId={id}
        mode={CanvasConnectionMode.Input}
        ports={d.inputs}
        isReadOnly={isReadOnly}
      />
      <CanvasHandle
        nodeId={id}
        mode={CanvasConnectionMode.Output}
        ports={d.outputs}
        isReadOnly={isReadOnly}
      />

      {/* Main icon. `accent` is a runtime, block-driven color. */}
      <div className="sabflow-node__icon" style={{ color: accent }}>
        {Icon ? (
          <Icon className="h-6 w-6" />
        ) : d.isTrigger ? (
          <Play className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Circle className="h-6 w-6" aria-hidden="true" />
        )}
      </div>

      {/* Disabled strike */}
      {showStrike ? <div className="sabflow-node__strike" /> : null}

      {/* Status badges */}
      {!d.disabled ? (
        <div className="sabflow-node__status">
          {d.pinned ? (
            <span className="sabflow-node__status-dot is-pinned" title="Pinned data" />
          ) : null}
          {d.execution.status === 'success' ? (
            <span className="sabflow-node__status-dot is-success" title="Success" />
          ) : null}
          {d.execution.status === 'error' ? (
            <span className="sabflow-node__status-dot is-error" title="Error" />
          ) : null}
          {d.execution.running ? (
            <span className="sabflow-node__status-dot is-running" title="Running" />
          ) : null}
        </div>
      ) : null}

      {/* Description (label + subtitle). Renders an input when renaming */}
      <div className="sabflow-node__description">
        {renamingId === id && !isReadOnly ? (
          <RenameInput initial={d.label} onCommit={(v) => {
            onRename?.(id, v);
            onRenameDone?.();
          }} />
        ) : (
          <div className="sabflow-node__label">{d.label}</div>
        )}
        {d.disabled ? <div className="sabflow-node__disabled-label">(disabled)</div> : null}
        {d.subtitle ? <div className="sabflow-node__subtitle">{d.subtitle}</div> : null}
      </div>

      {/* Hover toolbar */}
      {!isReadOnly ? (
        <div className="sabflow-node__toolbar" onMouseDown={(e) => e.stopPropagation()}>
          {!d.isTrigger ? (
            <IconButton
              label="Execute node"
              icon={Play}
              size="sm"
              className="sabflow-node__toolbar-btn"
              onClick={(e) => {
                e.stopPropagation();
                onExecute?.(id);
              }}
            />
          ) : null}
          <IconButton
            label="Duplicate"
            icon={Copy}
            size="sm"
            className="sabflow-node__toolbar-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate?.(id);
            }}
          />
          <IconButton
            label={d.disabled ? 'Enable' : 'Disable'}
            icon={Power}
            size="sm"
            className="sabflow-node__toolbar-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDisabled?.(id);
            }}
          />
          <IconButton
            label="Delete"
            icon={Trash2}
            size="sm"
            variant="danger"
            className="sabflow-node__toolbar-btn is-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
          />
        </div>
      ) : null}

      {/* Right-side "+" affordances. One per MAIN output port so multi-output
         blocks (Condition True/False, Switch per-case, Choice per-item, Loop,
         AB-test, integrations Success/Error) each get their own
         "Add next step" button. AI/Tool outputs live on the top edge and use
         a different affordance, so they're skipped here. Triggers without any
         downstream edge get a larger, pulsing variant as a setup hint. */}
      {!isReadOnly &&
        d.outputs
          .filter((p) => p.type === 'main')
          .map((port, index, arr) => {
          const handleId = `outputs/${port.type}/${port.index}`;
          const top = plusTopForIndex(arr.length, index);
          const showLabel = arr.length > 1 && !!port.label;
          return (
            <Button
              key={handleId}
              variant="ghost"
              size="sm"
              iconLeft={Plus}
              title={
                d.isUnconnected
                  ? 'Connect a step after this trigger'
                  : port.label
                    ? `Add node - ${port.label}`
                    : 'Add node'
              }
              aria-label={port.label ? `Add node (${port.label})` : 'Add node'}
              className={cn('sabflow-node__plus', d.isUnconnected && 'is-prompt')}
              /* Only override `top` so CSS keeps owning `transform`
                 (hover scale, etc.). The base rule already supplies
                 translateY(-50%) for vertical centring. `top` is runtime-computed. */
              style={{ top }}
              onClick={(e) => {
                e.stopPropagation();
                onAdd?.(id, handleId);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {showLabel ? (
                <span className="sabflow-node__plus-label">{port.label}</span>
              ) : null}
            </Button>
          );
        })}
    </div>
  );
});
