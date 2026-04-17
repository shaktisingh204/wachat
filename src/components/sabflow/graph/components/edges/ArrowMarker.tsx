'use client';

/**
 * SVG `<defs>` block containing arrow markers for every edge status colour.
 *
 * Markers are referenced via `markerEnd="url(#arrow-idle)"` etc. on edge paths.
 * The arrow shape is a small polyline that auto-orients to the path direction.
 */

type MarkerDef = { id: string; fill: string };

const MARKERS: MarkerDef[] = [
  { id: 'arrow-idle', fill: 'var(--gray-8)' },
  { id: 'arrow-hover', fill: '#f76808' },
  { id: 'arrow-success', fill: '#10b981' },
  { id: 'arrow-error', fill: '#ef4444' },
  { id: 'arrow-pinned', fill: '#f59e0b' },
  { id: 'arrow-running', fill: '#f76808' },
  // Legacy IDs kept for backward compatibility with existing edges
  { id: 'arrow', fill: 'var(--gray-8)' },
  { id: 'orange-arrow', fill: '#f76808' },
];

export function ArrowMarkers() {
  return (
    <defs>
      {MARKERS.map((m) => (
        <marker
          key={m.id}
          id={m.id}
          viewBox="-6 -5 12 10"
          refX="0"
          refY="0"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
          markerWidth="16"
          markerHeight="16"
        >
          <polyline
            points="-5,-4 0,0 -5,4 -5,-4"
            fill={m.fill}
            stroke="none"
          />
        </marker>
      ))}
    </defs>
  );
}

/**
 * Given an edge status, return the marker URL for the arrow head.
 */
export function getArrowMarkerId(
  status: string | undefined,
  isHovered: boolean,
): string {
  if (isHovered) return 'url(#arrow-hover)';
  switch (status) {
    case 'success': return 'url(#arrow-success)';
    case 'error': return 'url(#arrow-error)';
    case 'pinned': return 'url(#arrow-pinned)';
    case 'running': return 'url(#arrow-running)';
    default: return 'url(#arrow-idle)';
  }
}

/**
 * Given an edge status, return the stroke colour for the edge path.
 */
export function getEdgeStrokeColor(
  status: string | undefined,
  isHovered: boolean,
): string {
  if (isHovered) return '#f76808';
  switch (status) {
    case 'success': return '#10b981';
    case 'error': return '#ef4444';
    case 'pinned': return '#f59e0b';
    case 'running': return '#f76808';
    default: return 'var(--gray-8)';
  }
}
