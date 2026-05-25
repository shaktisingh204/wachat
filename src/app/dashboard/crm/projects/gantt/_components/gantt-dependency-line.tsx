'use client';

import * as React from 'react';

export interface GanttCoordinate {
  x: number;
  y: number;
}

export interface GanttDependencyLineProps {
  linkId: string;
  source: GanttCoordinate;
  target: GanttCoordinate;
  onClick?: (linkId: string) => void;
}

/**
 * SVG arrow rendered between two task bars. Path:
 *   start at source (right edge of source bar) ─ small step right ─ vertical
 *   to target row ─ horizontal to target's left edge ─ arrowhead.
 */
export function GanttDependencyLine({
  linkId,
  source,
  target,
  onClick,
}: GanttDependencyLineProps) {
  const STEP = 12;
  // If the target is to the left of the source we wrap the line around
  // to make a backwards-pointing arrow look sensible.
  const midX = Math.max(source.x + STEP, target.x - STEP);
  const d = [
    `M ${source.x} ${source.y}`,
    `L ${source.x + STEP} ${source.y}`,
    `L ${midX} ${source.y}`,
    `L ${midX} ${target.y}`,
    `L ${target.x} ${target.y}`,
  ].join(' ');

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(linkId);
      }}
    >
      {/* Wider invisible hit target */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={10}
        pointerEvents="stroke"
      />
      <path
        d={d}
        fill="none"
        stroke="#64748b"
        strokeWidth={1.5}
        markerEnd="url(#gantt-arrow)"
      />
    </g>
  );
}

/** Reusable arrowhead marker. Render once per chart. */
export function GanttArrowDefs() {
  return (
    <defs>
      <marker
        id="gantt-arrow"
        markerWidth={8}
        markerHeight={8}
        refX={7}
        refY={4}
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L8,4 L0,8 z" fill="#64748b" />
      </marker>
    </defs>
  );
}
