'use client';

/**
 * AutomationCanvas — the 20ui composite for rendering an automation workflow
 * as a node canvas (@xyflow/react, the repo standard for node canvases).
 *
 * GENERIC + PRESENTATIONAL: no server calls, no SabCRM model dependency. The
 * caller maps its own workflow shape to an **ordered linear chain** of
 * {@link AutomationFlowNode} items (trigger first, then steps in run order)
 * and this component owns layout, node rendering, edge styling and chrome.
 *
 * ## Model mapping (the caller's contract)
 *
 * `nodes[i]` becomes a React Flow node at `{ x: 0, y: i * V_GAP }` (a vertical
 * chain — SabCRM workflows are strictly linear; FILTER / IF_ELSE conditions
 * gate the rest of the run rather than branching, so there is no branch
 * layout). An edge is drawn between each consecutive pair. Nodes are NOT
 * freely draggable or connectable: the chain's order *is* the model, and
 * reordering belongs to the caller's config panel.
 *
 * ## Node types
 *
 * Three registered node types share one card renderer, varying by accent:
 *  - `trigger`   — accent ring icon (the workflow's entry event),
 *  - `condition` — warn-tinted icon (filter / if-else gates),
 *  - `action`    — neutral icon (side-effect steps).
 *
 * Each card shows icon + kind eyebrow + title + one summary line, a selected
 * ring, an invalid ("Needs setup") state and a muted (disabled-step) state.
 *
 * ## Editing surface
 *
 * - `onNodeSelect(id | null)` — node click / pane click. The SIDE CONFIG PANEL
 *   is rendered by the page, not here; selection is controlled via
 *   `selectedId` (falls back to internal state when uncontrolled).
 * - `onChange(orderedIds)` — fired when nodes are deleted on-canvas
 *   (Backspace / Delete on a selected, deletable node). Emits the surviving
 *   node ids in chain order; the trigger node is never deletable. Structural
 *   adds / reorders / config edits flow through the caller's panel instead.
 * - `readOnly` disables deletion and shows a static (but still pannable /
 *   zoomable, and selectable-for-inspection) canvas.
 */

import * as React from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { cn } from '@/lib/utils';
import { renderIcon, type IconProp } from '../../_icon';

import './flow.css';

// ---------------------------------------------------------------------------
// Public model
// ---------------------------------------------------------------------------

/** The three node families the canvas renders. */
export type AutomationNodeKind = 'trigger' | 'condition' | 'action';

/** One node of the linear chain (the caller's mapped workflow). */
export interface AutomationFlowNode {
  /** Stable id — the workflow step id (or a sentinel for the trigger). */
  id: string;
  kind: AutomationNodeKind;
  /** Card title (e.g. "Record Created" / "Update Field"). */
  title: string;
  /** One-line config summary under the title (truncated). */
  summary?: string;
  /** Leading icon — a Lucide component or an already-rendered node. */
  icon?: IconProp;
  /** Required config is missing — danger border + "Needs setup" flag. */
  invalid?: boolean;
  /** Step is disabled (`enabled: false`) — dimmed card. */
  muted?: boolean;
}

export interface AutomationCanvasProps {
  /** Ordered linear chain: trigger first, then steps in run order. */
  nodes: AutomationFlowNode[];
  /** Controlled selection (node id). Omit to let the canvas self-manage. */
  selectedId?: string | null;
  /** Node clicked (id) or pane clicked (null). */
  onNodeSelect?: (id: string | null) => void;
  /**
   * Structural change from the canvas itself (on-canvas node deletion).
   * Receives the surviving node ids in chain order. Omit (or set `readOnly`)
   * to disable on-canvas deletion entirely.
   */
  onChange?: (orderedIds: string[]) => void;
  /** Read-only mode: no deletion; selection still works for inspection. */
  readOnly?: boolean;
  /** Fit the chain into view on mount. Defaults to `true`. */
  fitView?: boolean;
  /** Render the minimap (off by default — most chains are short). */
  minimap?: boolean;
  className?: string;
  'aria-label'?: string;
}

// ---------------------------------------------------------------------------
// Internal React Flow mapping
// ---------------------------------------------------------------------------

/** Vertical distance between chained nodes. */
const V_GAP = 104;

const KIND_LABEL: Record<AutomationNodeKind, string> = {
  trigger: 'Trigger',
  condition: 'Condition',
  action: 'Action',
};

/** Node `data` bag (React Flow v12 requires `Record<string, unknown>`). */
interface AfcNodeData extends Record<string, unknown> {
  kind: AutomationNodeKind;
  title: string;
  summary?: string;
  icon?: IconProp;
  invalid?: boolean;
  muted?: boolean;
  isFirst: boolean;
  isLast: boolean;
}

type AfcRfNode = Node<AfcNodeData>;

/** Shared card renderer for all three node types. */
function AfcNodeCard({ data, selected }: NodeProps<AfcRfNode>): React.JSX.Element {
  return (
    <div
      className={cn(
        'afc-node',
        selected && 'is-selected',
        data.invalid && 'is-invalid',
        data.muted && 'is-muted',
      )}
      data-kind={data.kind}
    >
      {!data.isFirst ? (
        <Handle
          type="target"
          position={Position.Top}
          className="afc-handle"
          isConnectable={false}
        />
      ) : null}
      <span className="afc-node__icon" aria-hidden="true">
        {renderIcon(data.icon, { size: 14 })}
      </span>
      <span className="afc-node__body">
        <span className="afc-node__kind">
          {KIND_LABEL[data.kind]}
          {data.invalid ? <span className="afc-node__flag">Needs setup</span> : null}
        </span>
        <span className="afc-node__title">{data.title}</span>
        {data.summary ? <span className="afc-node__summary">{data.summary}</span> : null}
      </span>
      {!data.isLast ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="afc-handle"
          isConnectable={false}
        />
      ) : null}
    </div>
  );
}

/** Module-level (stable identity) — all three kinds share the card. */
const NODE_TYPES: NodeTypes = {
  trigger: AfcNodeCard,
  condition: AfcNodeCard,
  action: AfcNodeCard,
};

const FIT_VIEW_OPTIONS = { padding: 0.25, maxZoom: 1 } as const;

/** Map the chain to positioned React Flow nodes. */
function buildRfNodes(
  items: AutomationFlowNode[],
  selectedId: string | null,
  readOnly: boolean,
): AfcRfNode[] {
  const last = items.length - 1;
  return items.map((item, i) => ({
    id: item.id,
    type: item.kind,
    position: { x: 0, y: i * V_GAP },
    data: {
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      icon: item.icon,
      invalid: item.invalid,
      muted: item.muted,
      isFirst: i === 0,
      isLast: i === last,
    },
    selected: item.id === selectedId,
    draggable: false,
    connectable: false,
    deletable: !readOnly && item.kind !== 'trigger',
  }));
}

/** One edge between each consecutive pair of the chain. */
function buildRfEdges(items: AutomationFlowNode[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 1; i < items.length; i += 1) {
    edges.push({
      id: `afc-e-${items[i - 1].id}-${items[i].id}`,
      source: items[i - 1].id,
      target: items[i].id,
      type: 'smoothstep',
      focusable: false,
      selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
    });
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AutomationCanvas({
  nodes,
  selectedId,
  onNodeSelect,
  onChange,
  readOnly = false,
  fitView = true,
  minimap = false,
  className,
  'aria-label': ariaLabel,
}: AutomationCanvasProps): React.JSX.Element {
  // Uncontrolled-selection fallback (the page normally controls `selectedId`).
  const [innerSelected, setInnerSelected] = React.useState<string | null>(null);
  const effectiveSelected = selectedId !== undefined ? selectedId : innerSelected;

  const select = React.useCallback(
    (id: string | null) => {
      setInnerSelected(id);
      onNodeSelect?.(id);
    },
    [onNodeSelect],
  );

  const rfNodes = React.useMemo(
    () => buildRfNodes(nodes, effectiveSelected ?? null, readOnly),
    [nodes, effectiveSelected, readOnly],
  );
  const rfEdges = React.useMemo(() => buildRfEdges(nodes), [nodes]);

  /**
   * The chain is fully derived from props (auto-layout, no drag), so the only
   * change we act on is on-canvas deletion: emit the surviving ordered ids and
   * let the caller re-derive `nodes`. Everything else (selection) is driven
   * through `selectedId` / `onNodeSelect`.
   */
  const handleNodesChange: OnNodesChange<AfcRfNode> = React.useCallback(
    (changes) => {
      if (readOnly || !onChange) return;
      const removed = new Set(
        changes.filter((c) => c.type === 'remove').map((c) => c.id),
      );
      if (removed.size === 0) return;
      const remaining = nodes
        .filter((n) => n.kind === 'trigger' || !removed.has(n.id))
        .map((n) => n.id);
      if (remaining.length !== nodes.length) onChange(remaining);
    },
    [nodes, onChange, readOnly],
  );

  return (
    <div
      className={cn('afc', readOnly && 'is-readonly', className)}
      aria-label={ariaLabel ?? 'Automation flow canvas'}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={handleNodesChange}
        onNodeClick={(_, node) => select(node.id)}
        onPaneClick={() => select(null)}
        fitView={fitView}
        fitViewOptions={FIT_VIEW_OPTIONS}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        deleteKeyCode={readOnly || !onChange ? null : ['Backspace', 'Delete']}
        minZoom={0.3}
        maxZoom={1.5}
        panOnScroll
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.25} />
        <Controls showInteractive={false} />
        {minimap ? <MiniMap pannable zoomable /> : null}
      </ReactFlow>
    </div>
  );
}

export default AutomationCanvas;
