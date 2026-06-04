'use client';

/**
 * SabCRM — Data model GRAPH (`/dashboard/settings/crm/data-model/graph`).
 *
 * A Twenty-style entity-relationship diagram of the whole CRM schema: every
 * object is laid out as a card-node on a circle and every RELATION field is
 * drawn as a directed SVG edge between two objects, labelled with the relation
 * kind (MANY_TO_ONE / ONE_TO_MANY).
 *
 * Architecture (dependency-free, no graph lib):
 *   - We load the object catalogue with the same gated server action the
 *     sibling Data Model page uses (`listObjectsTw`) so this view sees exactly
 *     the objects the active project can.
 *   - Layout is a deterministic circle: N objects → N points evenly spaced on
 *     a ring sized to the count. Self-relations get a small loop.
 *   - The canvas is one positioned box. Underneath sits a single inline <svg>
 *     EDGE LAYER (cubic-Bézier curves + arrowheads + kind labels). On top sit
 *     absolutely-positioned <Link> card-nodes (icon + label + field count),
 *     sharing the same pixel space so a node sits exactly on its edge endpoint.
 *   - Hovering a node dims everything else and lights its edges + neighbours.
 *   - Clicking a node navigates to that object's data-model view.
 *
 * The Rust engine behind the action may be DOWN; the action returns an
 * `ActionResult`, so the page degrades to loading / empty / error states and
 * never crashes. NO ZoruUI / Tailwind / clay — Twenty look only (`.st-*` kit +
 * `.dmg-*` from the sibling `./graph.css`). Auth / RBAC / project context are
 * enforced by the parent `../../../layout.tsx`; the action re-runs the gate.
 */

import * as React from 'react';
import Link from 'next/link';
import { Database, GitBranch, AlertTriangle, ArrowLeft } from 'lucide-react';

import { TwentyPageHeader } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

import './graph.css';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const NODE_W = 200; // nominal card width (for collision-free ring sizing)
const NODE_H = 56; // nominal card height
const PADDING = 80; // breathing room around the ring

interface Point {
  x: number;
  y: number;
}

interface LaidOutNode {
  object: ObjectMetadata;
  pos: Point;
}

/** A directed relation edge between two objects (or an object → itself). */
interface Edge {
  /** Unique id (sourceSlug · fieldKey). */
  id: string;
  sourceSlug: string;
  targetSlug: string;
  /** Relation cardinality as seen from the source. */
  kind: 'MANY_TO_ONE' | 'ONE_TO_MANY';
  /** Field that declares the relation, used in the edge title. */
  fieldLabel: string;
}

const KIND_LABEL: Record<Edge['kind'], string> = {
  MANY_TO_ONE: 'N:1',
  ONE_TO_MANY: '1:N',
};

/**
 * Lay objects out on a circle. The radius grows with the object count so that
 * cards never overlap — circumference must fit N cards of width ~NODE_W.
 */
function layoutCircle(objects: ObjectMetadata[]): {
  nodes: LaidOutNode[];
  width: number;
  height: number;
} {
  const n = objects.length;

  if (n === 0) {
    return { nodes: [], width: 600, height: 400 };
  }

  if (n === 1) {
    const width = NODE_W + PADDING * 2;
    const height = NODE_H + PADDING * 2;
    return {
      nodes: [{ object: objects[0]!, pos: { x: width / 2, y: height / 2 } }],
      width,
      height,
    };
  }

  // Minimum radius so the chord between two neighbours clears one card width.
  const byCircumference = (n * (NODE_W + 28)) / (2 * Math.PI);
  const byCount = 150 + n * 14;
  const radius = Math.max(byCircumference, byCount, 180);

  const size = radius * 2 + NODE_W + PADDING;
  const cx = size / 2;
  const cy = size / 2;

  const nodes: LaidOutNode[] = objects.map((object, i) => {
    // Start at the top (−90°) and go clockwise.
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      object,
      pos: {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      },
    };
  });

  return { nodes, width: size, height: size };
}

/** Extract every RELATION field across all objects as a directed edge. */
function collectEdges(
  objects: ObjectMetadata[],
  knownSlugs: ReadonlySet<string>,
): Edge[] {
  const edges: Edge[] = [];
  for (const obj of objects) {
    for (const field of obj.fields as FieldMetadata[]) {
      if (field.type !== 'RELATION' || !field.relation) continue;
      const target = field.relation.targetObject;
      // Only draw edges whose target is an object we actually laid out.
      if (!target || !knownSlugs.has(target)) continue;
      edges.push({
        id: `${obj.slug}::${field.key}`,
        sourceSlug: obj.slug,
        targetSlug: target,
        kind: field.relation.kind,
        fieldLabel: field.label,
      });
    }
  }
  return edges;
}

/**
 * Build a cubic-Bézier path between two points with a gentle outward bow so
 * that parallel edges (and bidirectional pairs) don't perfectly overlap. The
 * `bow` factor offsets the control points perpendicular to the line.
 */
function curvePath(a: Point, b: Point, bow: number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector.
  const px = -dy / len;
  const py = dx / len;
  const cx = mx + px * bow;
  const cy = my + py * bow;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

/** Point on a quadratic Bézier at parameter t (for label placement). */
function quadPoint(a: Point, ctrl: Point, b: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * a.x + 2 * mt * t * ctrl.x + t * t * b.x,
    y: mt * mt * a.y + 2 * mt * t * ctrl.y + t * t * b.y,
  };
}

function controlPoint(a: Point, b: Point, bow: number): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mx + (-dy / len) * bow, y: my + (dx / len) * bow };
}

/** Trim a point inward from `from` toward `to` so the line stops at the card edge. */
function shortenToward(from: Point, to: Point, by: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const f = Math.max(0, (len - by) / len);
  return { x: from.x + dx * f, y: from.y + dy * f };
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="dmg-legend" aria-label="Diagram legend">
      <span className="dmg-legend__item">
        <span className="dmg-legend__swatch dmg-legend__swatch--standard" />
        Standard object
      </span>
      <span className="dmg-legend__item">
        <span className="dmg-legend__swatch dmg-legend__swatch--custom" />
        Custom object
      </span>
      <span className="dmg-legend__item">
        <span className="dmg-legend__line dmg-legend__line--m1" />
        Many&nbsp;→&nbsp;one (N:1)
      </span>
      <span className="dmg-legend__item">
        <span className="dmg-legend__line dmg-legend__line--1m" />
        One&nbsp;→&nbsp;many (1:N)
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card node
// ---------------------------------------------------------------------------

function GraphNode({
  node,
  active,
  onHover,
}: {
  node: LaidOutNode;
  active: boolean;
  onHover: (slug: string | null) => void;
}) {
  const { object, pos } = node;
  const fieldCount = object.fields.length;
  const isCustom = !object.standard;
  return (
    <Link
      href={`/dashboard/settings/crm/data-model#${encodeURIComponent(object.slug)}`}
      className={[
        'dmg-node',
        isCustom ? 'dmg-node--custom' : '',
        active ? 'is-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: pos.x, top: pos.y }}
      title={`${object.labelPlural} — ${fieldCount} field${
        fieldCount === 1 ? '' : 's'
      } · open data model`}
      onMouseEnter={() => onHover(object.slug)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(object.slug)}
      onBlur={() => onHover(null)}
    >
      <span className="dmg-node__icon" aria-hidden="true">
        <Database size={15} />
      </span>
      <span className="dmg-node__body">
        <span className="dmg-node__label">{object.labelPlural}</span>
        <span className="dmg-node__meta">
          <span className="dmg-node__count">{fieldCount}</span>
          {fieldCount === 1 ? 'field' : 'fields'}
        </span>
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DataModelGraphPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setObjects([]);
      } else {
        setObjects(res.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const knownSlugs = React.useMemo(
    () => new Set(objects.map((o) => o.slug)),
    [objects],
  );

  const { nodes, width, height } = React.useMemo(
    () => layoutCircle(objects),
    [objects],
  );

  const posBySlug = React.useMemo(() => {
    const map = new Map<string, Point>();
    for (const n of nodes) map.set(n.object.slug, n.pos);
    return map;
  }, [nodes]);

  const edges = React.useMemo(
    () => collectEdges(objects, knownSlugs),
    [objects, knownSlugs],
  );

  /**
   * Pre-compute drawable geometry for each edge. Parallel edges between the
   * same pair are bowed apart by indexing within their pair-bucket; a node
   * pointing at itself becomes a small loop above the card.
   */
  const drawn = React.useMemo(() => {
    // Bucket edges by unordered pair so we can fan them out.
    const buckets = new Map<string, Edge[]>();
    for (const e of edges) {
      const key = [e.sourceSlug, e.targetSlug].sort().join('|');
      const arr = buckets.get(key);
      if (arr) arr.push(e);
      else buckets.set(key, [e]);
    }

    type DrawnEdge = {
      edge: Edge;
      path: string;
      labelPos: Point;
      arrow: { tip: Point; angle: number };
      self: boolean;
    };

    const out: DrawnEdge[] = [];

    for (const [, bucket] of buckets) {
      bucket.forEach((edge, idx) => {
        const a = posBySlug.get(edge.sourceSlug);
        const b = posBySlug.get(edge.targetSlug);
        if (!a || !b) return;

        // Self-relation → loop.
        if (edge.sourceSlug === edge.targetSlug) {
          const loopR = 34 + idx * 12;
          const top: Point = { x: a.x, y: a.y - NODE_H / 2 };
          const path = `M ${top.x - 14} ${top.y} C ${top.x - loopR} ${
            top.y - loopR * 1.6
          }, ${top.x + loopR} ${top.y - loopR * 1.6}, ${top.x + 14} ${top.y}`;
          out.push({
            edge,
            path,
            labelPos: { x: top.x, y: top.y - loopR * 1.4 },
            arrow: { tip: { x: top.x + 14, y: top.y }, angle: Math.PI / 3 },
            self: true,
          });
          return;
        }

        // Fan parallel edges: alternate sides, growing magnitude.
        const sign = idx % 2 === 0 ? 1 : -1;
        const bow = (Math.floor(idx / 2) + (bucket.length > 1 ? 1 : 0)) * 34 * sign;

        // Stop the curve short of each card so it meets the border, not the centre.
        const ctrl = controlPoint(a, b, bow);
        const start = shortenToward(a, ctrl, NODE_W / 2 - 8);
        const endRaw = shortenToward(b, ctrl, NODE_W / 2 - 8);

        const path = curvePath(start, endRaw, bow);
        const labelCtrl = controlPoint(start, endRaw, bow);
        const labelPos = quadPoint(start, labelCtrl, endRaw, 0.5);

        // Arrowhead angle = tangent at the curve's end (control → endpoint).
        const ang = Math.atan2(endRaw.y - labelCtrl.y, endRaw.x - labelCtrl.x);
        out.push({
          edge,
          path,
          labelPos,
          arrow: { tip: endRaw, angle: ang },
          self: false,
        });
      });
    }

    return out;
  }, [edges, posBySlug]);

  /** Slugs related to the hovered node (for highlight). */
  const relatedSlugs = React.useMemo(() => {
    if (!hovered) return null;
    const set = new Set<string>([hovered]);
    for (const e of edges) {
      if (e.sourceSlug === hovered) set.add(e.targetSlug);
      if (e.targetSlug === hovered) set.add(e.sourceSlug);
    }
    return set;
  }, [hovered, edges]);

  const isEdgeActive = (e: Edge) =>
    hovered != null && (e.sourceSlug === hovered || e.targetSlug === hovered);

  // ---- Render -------------------------------------------------------------

  const header = (
    <TwentyPageHeader
      title="Data model graph"
      icon={GitBranch}
      actions={
        <Link href="/dashboard/settings/crm/data-model" className="st-btn st-btn--secondary">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to data model
        </Link>
      }
    />
  );

  if (error) {
    return (
      <div className="st-page">
        {header}
        <ErrorBanner message={error} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="st-page">
        {header}
        <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="st-skeleton st-skeleton-row" />
          ))}
        </div>
      </div>
    );
  }

  if (objects.length === 0) {
    return (
      <div className="st-page">
        {header}
        <div className="st-empty">
          <span className="st-empty__icon">
            <GitBranch size={20} />
          </span>
          <h2 className="st-empty__title">No objects to graph</h2>
          <p className="st-empty__desc">
            Once you create objects in the data model, they&apos;ll appear here
            as nodes with their relations drawn between them.
          </p>
          <Link href="/dashboard/settings/crm/data-model" className="st-btn st-btn--primary">
            Open data model
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="st-page">
      {header}

      <div className="dmg-toolbar">
        <span className="dmg-stat">
          <span className="dmg-stat__num">{objects.length}</span>
          {objects.length === 1 ? 'object' : 'objects'}
        </span>
        <span className="dmg-stat">
          <span className="dmg-stat__num">{edges.length}</span>
          {edges.length === 1 ? 'relation' : 'relations'}
        </span>
        <span className="dmg-toolbar__spacer" />
      </div>

      <Legend />

      <div className="dmg-canvas-wrap">
        <div
          className="dmg-canvas"
          data-hover={hovered ?? undefined}
          style={{ width, height }}
        >
          {/* ----- Edge layer (single inline SVG) ----- */}
          <svg
            className="dmg-edges"
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label="Object relationship edges"
          >
            {drawn.map(({ edge, path, labelPos, arrow, self }) => {
              const active = isEdgeActive(edge);
              const cls = [
                'dmg-edge',
                edge.kind === 'ONE_TO_MANY' ? 'dmg-edge--1m' : '',
                self ? (edge.kind === 'ONE_TO_MANY' ? 'dmg-self--1m' : 'dmg-self') : '',
                active ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ');

              // Arrowhead as two short strokes forming a "<" at the tip.
              const ax = arrow.tip.x;
              const ay = arrow.tip.y;
              const head = 8;
              const a1 = arrow.angle + Math.PI - 0.4;
              const a2 = arrow.angle + Math.PI + 0.4;
              const label = `${KIND_LABEL[edge.kind]} · ${edge.fieldLabel}`;
              const labelW = label.length * 5.6 + 10;

              return (
                <g
                  key={edge.id}
                  className={`dmg-edge-group${active ? ' is-active' : ''}`}
                >
                  <title>
                    {`${edge.sourceSlug} → ${edge.targetSlug} (${edge.kind}) via ${edge.fieldLabel}`}
                  </title>
                  <path className={cls} d={path} />
                  {/* arrowhead */}
                  <path
                    className={cls}
                    d={`M ${ax + head * Math.cos(a1)} ${
                      ay + head * Math.sin(a1)
                    } L ${ax} ${ay} L ${ax + head * Math.cos(a2)} ${
                      ay + head * Math.sin(a2)
                    }`}
                  />
                  {/* kind label with a small bg plate for legibility */}
                  <rect
                    className="dmg-edge__label-bg"
                    x={labelPos.x - labelW / 2}
                    y={labelPos.y - 8}
                    width={labelW}
                    height={15}
                    rx={4}
                  />
                  <text
                    className="dmg-edge__label"
                    x={labelPos.x}
                    y={labelPos.y + 3}
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* ----- Node layer (positioned cards over the SVG) ----- */}
          {nodes.map((node) => (
            <GraphNode
              key={node.object.slug}
              node={node}
              active={relatedSlugs == null || relatedSlugs.has(node.object.slug)}
              onHover={setHovered}
            />
          ))}
        </div>
      </div>

      {edges.length === 0 ? (
        <p className="dmg-norel">
          No relations between objects yet. Add a <strong>Relation</strong>{' '}
          field on any object to draw the first edge.
        </p>
      ) : null}
    </div>
  );
}
