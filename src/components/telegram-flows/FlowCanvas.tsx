'use client';

import { Button } from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  } from 'react';

import { Trash2 } from 'lucide-react';

import {
  TELEGRAM_NODE_TYPES,
  nodeMeta,
  type NodeTypeMeta,
  } from './node-registry';
import type {
  FlowEdge,
  FlowNode,
  FlowTrigger,
  } from '@/lib/rust-client/telegram-flows';

/**
 * Lightweight Telegram-flow canvas. Renders nodes as draggable cards on an
 * SVG-backed surface and the edges as straight connectors. Intentionally
 * minimal — the spec permits a placeholder canvas when the full SabFlow
 * editor cannot be easily reused (it speaks a different graph shape).
 *
 * The canvas is self-contained: positions live on each `FlowNode.position`,
 * dragging a node mutates that position through `onChangeNodes`, and
 * clicking a node selects it via `onSelectNode`. No external graph state
 * provider needed.
 */

import { cn } from '@/lib/utils';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 88;
const SNAP = 8;

type Props = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  trigger: FlowTrigger;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
  onChangeNodes: (next: FlowNode[]) => void;
  onChangeEdges: (next: FlowEdge[]) => void;
  disabled?: boolean;
};

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function FlowCanvas({
  nodes,
  edges,
  trigger,
  selectedId,
  onSelectNode,
  onChangeNodes,
  onChangeEdges,
  disabled,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  /* ── add a node from the palette ─────────────────────────────────────── */
  const addNode = useCallback(
    (meta: NodeTypeMeta) => {
      if (disabled) return;
      const id = newId(meta.type);
      // Stack new nodes diagonally so they don't sit exactly on top of each
      // other when the user clicks the palette repeatedly.
      const offset = nodes.length * 24;
      const node: FlowNode = {
        id,
        type: meta.type,
        position: { x: 160 + offset, y: 140 + offset },
        data: meta.defaultData(),
      };
      onChangeNodes([...nodes, node]);
      onSelectNode(id);
    },
    [disabled, nodes, onChangeNodes, onSelectNode],
  );

  /* ── delete the selected node ────────────────────────────────────────── */
  const deleteNode = useCallback(
    (id: string) => {
      if (disabled) return;
      onChangeNodes(nodes.filter((n) => n.id !== id));
      onChangeEdges(edges.filter((e) => e.source !== id && e.target !== id));
      if (selectedId === id) onSelectNode(null);
    },
    [disabled, edges, nodes, onChangeEdges, onChangeNodes, onSelectNode, selectedId],
  );

  /* ── drag handling ──────────────────────────────────────────────────── */
  const onPointerDownNode = (e: ReactPointerEvent<HTMLDivElement>, node: FlowNode) => {
    if (disabled) return;
    e.stopPropagation();
    const surface = surfaceRef.current?.getBoundingClientRect();
    if (!surface) return;
    setDragging({
      id: node.id,
      offsetX: e.clientX - surface.left - node.position.x,
      offsetY: e.clientY - surface.top - node.position.y,
    });
    onSelectNode(node.id);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current?.getBoundingClientRect();
    if (!surface) return;
    const x = e.clientX - surface.left;
    const y = e.clientY - surface.top;
    if (linking) {
      setPointer({ x, y });
      return;
    }
    if (!dragging) return;
    const nx = Math.max(0, Math.round((x - dragging.offsetX) / SNAP) * SNAP);
    const ny = Math.max(0, Math.round((y - dragging.offsetY) / SNAP) * SNAP);
    onChangeNodes(
      nodes.map((n) =>
        n.id === dragging.id ? { ...n, position: { x: nx, y: ny } } : n,
      ),
    );
  };

  const onPointerUp = () => {
    setDragging(null);
  };

  /* ── linking ────────────────────────────────────────────────────────── */
  const startLink = (e: ReactPointerEvent<HTMLButtonElement>, fromId: string) => {
    if (disabled) return;
    e.stopPropagation();
    setLinking(fromId);
    const surface = surfaceRef.current?.getBoundingClientRect();
    if (surface) {
      setPointer({ x: e.clientX - surface.left, y: e.clientY - surface.top });
    }
  };

  const finishLink = (toId: string) => {
    if (!linking || linking === toId) {
      setLinking(null);
      setPointer(null);
      return;
    }
    const id = newId('edge');
    const next: FlowEdge = { id, source: linking, target: toId };
    onChangeEdges([...edges, next]);
    setLinking(null);
    setPointer(null);
  };

  const deleteEdge = (id: string) => {
    if (disabled) return;
    onChangeEdges(edges.filter((e) => e.id !== id));
  };

  /* ── node lookup for edge endpoints ─────────────────────────────────── */
  const nodeById = useMemo(() => {
    const m = new Map<string, FlowNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const triggerCard = useMemo(() => {
    return {
      id: 'trigger',
      label: `Trigger · ${trigger?.kind ?? 'incoming_message'}`,
      position: { x: 40, y: 40 },
    };
  }, [trigger]);

  /* ── render ─────────────────────────────────────────────────────────── */

  // Auto-cancel a pending link if the user presses Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setLinking(null);
        setPointer(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Only react when the focus is NOT on a form control — otherwise
        // backspace in the inspector wipes the canvas.
        const target = e.target as HTMLElement | null;
        if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
        if (target?.isContentEditable) return;
        deleteNode(selectedId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteNode, selectedId]);

  return (
    <div className="flex h-full w-full">
      {/* Node palette */}
      <aside className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r bg-muted/30 p-3">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Nodes
        </p>
        {TELEGRAM_NODE_TYPES.filter((m) => m.type !== 'trigger').map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.type}
              type="button"
              onClick={() => addNode(m)}
              className={cn(
                'group flex items-start gap-2 rounded-lg border bg-background p-2 text-left text-sm shadow-sm transition',
                'hover:border-primary hover:bg-accent disabled:opacity-50',
              )}
              disabled={disabled}
            >
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-white"
                style={{ background: m.accent }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex flex-col">
                <span className="font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.subtitle}</span>
              </span>
            </button>
          );
        })}
      </aside>

      {/* Canvas surface */}
      <div
        ref={surfaceRef}
        className="relative flex-1 overflow-auto bg-[linear-gradient(0deg,transparent_24%,rgba(0,0,0,0.04)_25%,rgba(0,0,0,0.04)_26%,transparent_27%,transparent_74%,rgba(0,0,0,0.04)_75%,rgba(0,0,0,0.04)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(0,0,0,0.04)_25%,rgba(0,0,0,0.04)_26%,transparent_27%,transparent_74%,rgba(0,0,0,0.04)_75%,rgba(0,0,0,0.04)_76%,transparent_77%,transparent)] bg-[length:24px_24px]"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => onSelectNode(null)}
        style={{ minHeight: 480 }}
      >
        {/* Edge layer */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <marker
              id="tg-flow-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#229ED9" />
            </marker>
          </defs>
          {edges.map((e) => {
            const a =
              e.source === 'trigger'
                ? { x: triggerCard.position.x + NODE_WIDTH, y: triggerCard.position.y + NODE_HEIGHT / 2 }
                : nodeById.get(e.source);
            const aPoint =
              a && 'position' in a
                ? {
                    x: a.position.x + NODE_WIDTH,
                    y: a.position.y + NODE_HEIGHT / 2,
                  }
                : a;
            const b = nodeById.get(e.target);
            if (!aPoint || !b) return null;
            const bPoint = { x: b.position.x, y: b.position.y + NODE_HEIGHT / 2 };
            return (
              <g key={e.id} className="pointer-events-auto">
                <path
                  d={`M ${aPoint.x} ${aPoint.y} C ${aPoint.x + 60} ${aPoint.y}, ${bPoint.x - 60} ${bPoint.y}, ${bPoint.x} ${bPoint.y}`}
                  stroke="#229ED9"
                  strokeWidth={2}
                  fill="none"
                  markerEnd="url(#tg-flow-arrow)"
                />
                <path
                  d={`M ${aPoint.x} ${aPoint.y} C ${aPoint.x + 60} ${aPoint.y}, ${bPoint.x - 60} ${bPoint.y}, ${bPoint.x} ${bPoint.y}`}
                  stroke="transparent"
                  strokeWidth={14}
                  fill="none"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    deleteEdge(e.id);
                  }}
                  style={{ cursor: 'pointer' }}
                  aria-label="Delete edge"
                />
              </g>
            );
          })}
          {linking && pointer
            ? (() => {
                const src =
                  linking === 'trigger'
                    ? {
                        x: triggerCard.position.x + NODE_WIDTH,
                        y: triggerCard.position.y + NODE_HEIGHT / 2,
                      }
                    : (() => {
                        const n = nodeById.get(linking);
                        return n
                          ? {
                              x: n.position.x + NODE_WIDTH,
                              y: n.position.y + NODE_HEIGHT / 2,
                            }
                          : null;
                      })();
                if (!src) return null;
                return (
                  <path
                    d={`M ${src.x} ${src.y} L ${pointer.x} ${pointer.y}`}
                    stroke="#229ED9"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    fill="none"
                  />
                );
              })()
            : null}
        </svg>

        {/* Trigger card */}
        <div
          className="absolute rounded-lg border-2 border-[#229ED9] bg-white shadow-md"
          style={cardStyle(triggerCard.position.x, triggerCard.position.y, NODE_WIDTH, NODE_HEIGHT)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectNode(null);
          }}
        >
          <div className="flex h-full flex-col justify-center gap-1 px-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#229ED9]">
              Trigger
            </span>
            <span className="truncate text-sm font-medium">{trigger?.kind ?? 'incoming_message'}</span>
          </div>
          <PortButton
            onPointerDown={(e) => startLink(e, 'trigger')}
            style={{ right: -10, top: NODE_HEIGHT / 2 - 8 }}
            label="Drag to connect"
          />
        </div>

        {/* Action nodes */}
        {nodes.map((node) => {
          const meta = nodeMeta(node.type);
          const Icon = meta.icon;
          const selected = node.id === selectedId;
          return (
            <div
              key={node.id}
              className={cn(
                'absolute rounded-lg border bg-background shadow-sm transition',
                selected ? 'ring-2 ring-offset-2' : 'hover:shadow-md',
              )}
              style={{
                ...cardStyle(node.position.x, node.position.y, NODE_WIDTH, NODE_HEIGHT),
                borderColor: selected ? meta.accent : undefined,
                ['--tw-ring-color' as string]: meta.accent,
              }}
              onPointerDown={(e) => onPointerDownNode(e, node)}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(node.id);
              }}
            >
              <div className="flex h-full items-stretch gap-2">
                <span
                  aria-hidden
                  className="w-1.5 shrink-0 rounded-l-lg"
                  style={{ background: meta.accent }}
                />
                <div className="flex flex-1 flex-col justify-center gap-0.5 py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: meta.accent }} />
                    <span className="truncate text-sm font-medium">{meta.label}</span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {summariseNode(node)}
                  </span>
                </div>
                {selected && !disabled ? (
                  <button
                    type="button"
                    aria-label="Delete node"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode(node.id);
                    }}
                    className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
              <PortButton
                onPointerDown={(e) => startLink(e, node.id)}
                style={{ right: -10, top: NODE_HEIGHT / 2 - 8 }}
                label="Drag to connect"
              />
              <PortButton
                inbound
                onPointerUp={() => finishLink(node.id)}
                style={{ left: -10, top: NODE_HEIGHT / 2 - 8 }}
                label="Drop to connect"
              />
            </div>
          );
        })}

        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            <div className="rounded-lg border border-dashed bg-background/80 p-6 text-center">
              <p className="font-medium">Empty canvas</p>
              <p className="mt-1 text-xs">
                Click a node in the palette to add it. Drag the right edge of a card to
                connect it to the next step.
              </p>
              {disabled ? (
                <p className="mt-2 text-xs">
                  Published flows are read-only. Disable the flow to edit it.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Toolbar (floating, top-right) */}
      <div className="pointer-events-none absolute right-72 top-4 flex gap-2">
        {linking ? (
          <ZoruButton
            variant="secondary"
            size="sm"
            className="pointer-events-auto"
            onClick={() => {
              setLinking(null);
              setPointer(null);
            }}
          >
            Cancel link
          </ZoruButton>
        ) : null}
      </div>
    </div>
  );
}

function cardStyle(x: number, y: number, w: number, h: number): CSSProperties {
  return {
    // `top:0/left:0` anchors the transform origin so `translate()` maps
    // directly onto the canvas coordinate space.
    top: 0,
    left: 0,
    transform: `translate(${x}px, ${y}px)`,
    width: w,
    height: h,
    cursor: 'grab',
    touchAction: 'none',
  };
}

function summariseNode(n: FlowNode): string {
  switch (n.type) {
    case 'send_message':
      return String((n.data as { text?: string }).text ?? '');
    case 'send_media':
      return String((n.data as { caption?: string }).caption ?? '(media)');
    case 'send_keyboard':
      return `${((n.data as { buttons?: unknown[] }).buttons ?? []).length} button(s)`;
    case 'branch_by_text':
      return `${((n.data as { cases?: unknown[] }).cases ?? []).length} case(s)`;
    case 'branch_by_callback':
      return `${((n.data as { cases?: unknown[] }).cases ?? []).length} case(s)`;
    case 'set_variable':
      return String((n.data as { name?: string }).name ?? '');
    case 'http_request':
      return `${(n.data as { method?: string }).method ?? 'GET'} ${(n.data as { url?: string }).url ?? ''}`;
    default:
      return n.type;
  }
}

function PortButton({
  onPointerDown,
  onPointerUp,
  style,
  label,
  inbound,
}: {
  onPointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: () => void;
  style: CSSProperties;
  label: string;
  inbound?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      aria-label={label}
      className={cn(
        'absolute inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white shadow ring-1 ring-border',
        inbound ? 'bg-muted' : 'bg-[#229ED9]',
      )}
      style={style}
    />
  );
}
