'use client';
import { computeEdgePath, stubLength } from '@/components/sabflow/graph/helpers/computeEdgePath';
import type { Coordinates } from '@/lib/sabflow/types';

type Props = {
  id: string;
  from: Coordinates;
  to: Coordinates;
  isActive?: boolean;
  isPreviewing?: boolean;
};

export function Edge({ id, from, to, isActive, isPreviewing }: Props) {
  const path = computeEdgePath({ from, to });

  return (
    <g>
      {/* Invisible wide hit area for hover/click */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        className="cursor-pointer"
      />
      {/* Visible path */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={isActive || isPreviewing ? '#f76808' : 'var(--gray-8)'}
        strokeWidth={2}
        strokeLinecap="round"
        className="pointer-events-none transition-[stroke]"
      />
      {/* Arrow head */}
      <circle
        cx={to.x - stubLength}
        cy={to.y}
        r={4}
        fill={isActive || isPreviewing ? '#f76808' : 'var(--gray-8)'}
        className="pointer-events-none transition-[fill]"
      />
    </g>
  );
}
