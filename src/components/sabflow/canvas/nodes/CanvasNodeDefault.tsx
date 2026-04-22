'use client';
/**
 * CanvasNodeDefault — port of n8n's CanvasNodeDefault.vue.
 *
 * Renders the standard n8n rectangular node (icon + handles + description
 * beneath), plus trigger variant (left side rounded). Status borders, disabled
 * strike-through, running gradient-ring, hover toolbar — all ported visually.
 */
import { memo, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { LuPlay, LuPlus, LuTrash2, LuPower, LuCopy, LuCircle } from 'react-icons/lu';
import { CanvasHandle } from '../handles/CanvasHandle';
import { CanvasConnectionMode, type CanvasNode, type CanvasNodeData } from '../types';
import { blockRegistryMap } from '@/components/sabflow/editor/blockRegistry';
import { cn } from '@/lib/utils';

type Props = NodeProps<CanvasNode> & {
  onAdd?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onToggleDisabled?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onExecute?: (nodeId: string) => void;
  isReadOnly?: boolean;
};

export const CanvasNodeDefault = memo(function CanvasNodeDefault({
  id,
  data,
  selected,
  onAdd,
  onDelete,
  onToggleDisabled,
  onDuplicate,
  onExecute,
  isReadOnly,
}: Props) {
  const d = data as CanvasNodeData;
  const entry = d.blockType ? blockRegistryMap.get(d.blockType) : undefined;
  const Icon = entry?.icon;
  const accent = entry?.color ?? '#f76808';

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
      ),
    [selected, d.isTrigger, d.disabled, d.pinned, d.execution],
  );

  // Strike-through only when disabled AND node has a single in/out on main.
  const singleMainIn = d.inputs.filter((p) => p.type === 'main').length === 1;
  const singleMainOut = d.outputs.filter((p) => p.type === 'main').length === 1;
  const showStrike = d.disabled && singleMainIn && singleMainOut;

  return (
    <div className={classes} data-node-id={id} data-testid="canvas-node">
      {/* Handles — left for inputs, right for outputs */}
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

      {/* Main icon */}
      <div className="sabflow-node__icon" style={{ color: accent }}>
        {Icon ? (
          <Icon className="h-6 w-6" />
        ) : d.isTrigger ? (
          <LuPlay className="h-6 w-6" />
        ) : (
          <LuCircle className="h-6 w-6" />
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
            <span className="sabflow-node__status-dot is-running" title="Running…" />
          ) : null}
        </div>
      ) : null}

      {/* Description (label + subtitle) */}
      <div className="sabflow-node__description">
        <div className="sabflow-node__label">{d.label}</div>
        {d.disabled ? <div className="sabflow-node__disabled-label">(disabled)</div> : null}
        {d.subtitle ? <div className="sabflow-node__subtitle">{d.subtitle}</div> : null}
      </div>

      {/* Hover toolbar */}
      {!isReadOnly ? (
        <div className="sabflow-node__toolbar" onMouseDown={(e) => e.stopPropagation()}>
          {!d.isTrigger ? (
            <button
              type="button"
              title="Execute node"
              aria-label="Execute node"
              className="sabflow-node__toolbar-btn"
              onClick={(e) => {
                e.stopPropagation();
                onExecute?.(id);
              }}
            >
              <LuPlay className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            title="Duplicate"
            aria-label="Duplicate"
            className="sabflow-node__toolbar-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate?.(id);
            }}
          >
            <LuCopy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={d.disabled ? 'Enable' : 'Disable'}
            aria-label={d.disabled ? 'Enable' : 'Disable'}
            className="sabflow-node__toolbar-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDisabled?.(id);
            }}
          >
            <LuPower className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Delete"
            aria-label="Delete"
            className="sabflow-node__toolbar-btn is-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
          >
            <LuTrash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Right-side "+" — inserts a new node after this one */}
      {!isReadOnly && d.outputs.length > 0 ? (
        <button
          type="button"
          title="Add node"
          aria-label="Add node"
          className="sabflow-node__plus"
          onClick={(e) => {
            e.stopPropagation();
            onAdd?.(id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <LuPlus className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
});
