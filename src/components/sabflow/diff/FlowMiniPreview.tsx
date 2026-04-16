'use client';

/**
 * FlowMiniPreview
 *
 * Tiny read-only canvas preview — groups rendered as rectangles, events
 * rendered as smaller rectangles, edges rendered as SVG lines.
 *
 * Used for the before/after thumbnails in the flow diff view.  Designed to
 * be deterministic and dependency-free so it can render server-side or
 * client-side without relying on any graph state.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type {
  Group,
  Edge,
  SabFlowEvent,
  Coordinates,
} from '@/lib/sabflow/types';

/* ── Rendering constants ────────────────────────────────────────────────── */

const GROUP_W = 300;
const GROUP_H = 100;
const EVENT_W = 200;
const EVENT_H = 70;
/** Canvas padding so elements never touch the preview frame. */
const CONTENT_PADDING = 160;

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface FlowMiniPreviewProps {
  groups: Group[];
  events: SabFlowEvent[];
  edges: Edge[];
  /** Width of the preview frame in CSS pixels. */
  width?: number;
  /** Height of the preview frame in CSS pixels. */
  height?: number;
  /**
   * Optional set of element ids to highlight as "added".
   * Renders the element with the green accent palette.
   */
  addedIds?: ReadonlySet<string>;
  /**
   * Optional set of element ids to highlight as "removed".
   * Renders the element with the red accent palette.
   */
  removedIds?: ReadonlySet<string>;
  /**
   * Optional set of element ids to highlight as "modified".
   * Renders the element with the amber accent palette.
   */
  modifiedIds?: ReadonlySet<string>;
  /** Accessible label announced to screen readers. */
  label?: string;
  className?: string;
}

/* ── Bounds computation ─────────────────────────────────────────────────── */

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBounds(groups: Group[], events: SabFlowEvent[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const g of groups) {
    minX = Math.min(minX, g.graphCoordinates.x);
    minY = Math.min(minY, g.graphCoordinates.y);
    maxX = Math.max(maxX, g.graphCoordinates.x + GROUP_W);
    maxY = Math.max(maxY, g.graphCoordinates.y + GROUP_H);
  }
  for (const ev of events) {
    minX = Math.min(minX, ev.graphCoordinates.x);
    minY = Math.min(minY, ev.graphCoordinates.y);
    maxX = Math.max(maxX, ev.graphCoordinates.x + EVENT_W);
    maxY = Math.max(maxY, ev.graphCoordinates.y + EVENT_H);
  }

  if (!Number.isFinite(minX)) {
    return { minX: -400, minY: -300, maxX: 400, maxY: 300 };
  }

  return {
    minX: minX - CONTENT_PADDING,
    minY: minY - CONTENT_PADDING,
    maxX: maxX + CONTENT_PADDING,
    maxY: maxY + CONTENT_PADDING,
  };
}

/* ── Edge anchor calculation ────────────────────────────────────────────── */

interface EdgeAnchor {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  highlight: 'added' | 'removed' | null;
}

/**
 * Derive approximate edge endpoints from its `from` / `to` group coordinates.
 * Uses the centre of the owning group / event as the anchor — good enough
 * for a minimap-style preview.
 */
function computeEdgeAnchors(
  edges: Edge[],
  groups: Group[],
  events: SabFlowEvent[],
  addedIds: ReadonlySet<string>,
  removedIds: ReadonlySet<string>,
): EdgeAnchor[] {
  const groupCenters = new Map<string, Coordinates>();
  for (const g of groups) {
    groupCenters.set(g.id, {
      x: g.graphCoordinates.x + GROUP_W / 2,
      y: g.graphCoordinates.y + GROUP_H / 2,
    });
  }
  const eventCenters = new Map<string, Coordinates>();
  for (const ev of events) {
    eventCenters.set(ev.id, {
      x: ev.graphCoordinates.x + EVENT_W / 2,
      y: ev.graphCoordinates.y + EVENT_H / 2,
    });
  }

  const anchors: EdgeAnchor[] = [];
  for (const edge of edges) {
    const fromCenter: Coordinates | undefined = edge.from.eventId
      ? eventCenters.get(edge.from.eventId)
      : edge.from.groupId
        ? groupCenters.get(edge.from.groupId)
        : undefined;

    const toCenter = edge.to.groupId ? groupCenters.get(edge.to.groupId) : undefined;

    if (!fromCenter || !toCenter) continue;

    const highlight: EdgeAnchor['highlight'] = addedIds.has(edge.id)
      ? 'added'
      : removedIds.has(edge.id)
        ? 'removed'
        : null;

    anchors.push({
      id: edge.id,
      x1: fromCenter.x,
      y1: fromCenter.y,
      x2: toCenter.x,
      y2: toCenter.y,
      highlight,
    });
  }
  return anchors;
}

/* ── Component ──────────────────────────────────────────────────────────── */

const DEFAULT_ADDED = new Set<string>();
const DEFAULT_REMOVED = new Set<string>();
const DEFAULT_MODIFIED = new Set<string>();

export function FlowMiniPreview({
  groups,
  events,
  edges,
  width = 320,
  height = 200,
  addedIds = DEFAULT_ADDED,
  removedIds = DEFAULT_REMOVED,
  modifiedIds = DEFAULT_MODIFIED,
  label,
  className,
}: FlowMiniPreviewProps) {
  const { bounds, scale, edgeAnchors } = useMemo(() => {
    const computedBounds = computeBounds(groups, events);
    const boundsW = computedBounds.maxX - computedBounds.minX;
    const boundsH = computedBounds.maxY - computedBounds.minY;
    const scaleX = width / Math.max(boundsW, 1);
    const scaleY = height / Math.max(boundsH, 1);
    const computedScale = Math.min(scaleX, scaleY);
    const anchors = computeEdgeAnchors(edges, groups, events, addedIds, removedIds);
    return { bounds: computedBounds, scale: computedScale, edgeAnchors: anchors };
  }, [groups, events, edges, width, height, addedIds, removedIds]);

  const toLocal = (cx: number, cy: number) => ({
    left: (cx - bounds.minX) * scale,
    top: (cy - bounds.minY) * scale,
  });

  const toSvg = (cx: number, cy: number) => ({
    x: (cx - bounds.minX) * scale,
    y: (cy - bounds.minY) * scale,
  });

  const isEmpty = groups.length === 0 && events.length === 0;

  return (
    <div
      role="img"
      aria-label={label ?? 'Flow preview'}
      className={cn(
        'relative overflow-hidden rounded-lg border border-[var(--gray-5)]',
        className,
      )}
      style={{
        width,
        height,
        backgroundColor: 'var(--gray-2)',
        backgroundImage: 'radial-gradient(var(--gray-5) 1px, transparent 0)',
        backgroundSize: '8px 8px',
      }}
    >
      {isEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[var(--gray-9)]">
          Empty flow
        </div>
      ) : (
        <>
          {/* Edges (SVG, underneath the boxes) */}
          <svg
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
            {edgeAnchors.map((a) => {
              const start = toSvg(a.x1, a.y1);
              const end = toSvg(a.x2, a.y2);
              const stroke =
                a.highlight === 'added'
                  ? 'rgba(34, 197, 94, 0.85)'
                  : a.highlight === 'removed'
                    ? 'rgba(239, 68, 68, 0.75)'
                    : 'rgba(156, 163, 175, 0.55)';
              const strokeWidth = a.highlight ? 1.4 : 0.9;
              const dashArray = a.highlight === 'removed' ? '3 2' : undefined;
              return (
                <line
                  key={a.id}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                />
              );
            })}
          </svg>

          {/* Event nodes */}
          {events.map((ev) => {
            const pos = toLocal(ev.graphCoordinates.x, ev.graphCoordinates.y);
            const highlight = resolveHighlight(ev.id, addedIds, removedIds, modifiedIds);
            return (
              <div
                key={ev.id}
                className="absolute rounded-[1px]"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width: EVENT_W * scale,
                  height: EVENT_H * scale,
                  backgroundColor: eventColor(highlight),
                  outline: highlight ? `1px solid ${outlineColor(highlight)}` : undefined,
                }}
              />
            );
          })}

          {/* Group nodes */}
          {groups.map((g) => {
            const pos = toLocal(g.graphCoordinates.x, g.graphCoordinates.y);
            const highlight = resolveHighlight(g.id, addedIds, removedIds, modifiedIds);
            return (
              <div
                key={g.id}
                className="absolute rounded-[2px]"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width: GROUP_W * scale,
                  height: GROUP_H * scale,
                  backgroundColor: groupColor(highlight),
                  outline: highlight ? `1px solid ${outlineColor(highlight)}` : undefined,
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

/* ── Highlight helpers ──────────────────────────────────────────────────── */

type Highlight = 'added' | 'removed' | 'modified' | null;

function resolveHighlight(
  id: string,
  added: ReadonlySet<string>,
  removed: ReadonlySet<string>,
  modified: ReadonlySet<string>,
): Highlight {
  if (added.has(id)) return 'added';
  if (removed.has(id)) return 'removed';
  if (modified.has(id)) return 'modified';
  return null;
}

function groupColor(h: Highlight): string {
  switch (h) {
    case 'added':
      return 'rgba(34, 197, 94, 0.75)';
    case 'removed':
      return 'rgba(239, 68, 68, 0.6)';
    case 'modified':
      return 'rgba(245, 158, 11, 0.75)';
    default:
      return 'rgba(249, 115, 22, 0.7)';
  }
}

function eventColor(h: Highlight): string {
  switch (h) {
    case 'added':
      return 'rgba(34, 197, 94, 0.75)';
    case 'removed':
      return 'rgba(239, 68, 68, 0.6)';
    case 'modified':
      return 'rgba(245, 158, 11, 0.75)';
    default:
      return 'rgba(107, 114, 128, 0.7)';
  }
}

function outlineColor(h: Highlight): string {
  switch (h) {
    case 'added':
      return 'rgb(22, 163, 74)';
    case 'removed':
      return 'rgb(220, 38, 38)';
    case 'modified':
      return 'rgb(217, 119, 6)';
    default:
      return 'transparent';
  }
}
