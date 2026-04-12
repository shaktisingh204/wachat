'use client';

/**
 * Sparkline — tiny inline SVG trend line. Zero deps.
 * Used inside SabStat and anywhere else that needs a lightweight
 * at-a-glance trend indicator.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  stroke?: string;
  fillOpacity?: number;
  className?: string;
  ariaLabel?: string;
}

export const Sparkline = React.memo(function Sparkline({
  data,
  width = 120,
  height = 32,
  strokeWidth = 1.5,
  stroke = 'currentColor',
  fillOpacity = 0.14,
  className,
  ariaLabel,
}: SparklineProps) {
  const { linePath, areaPath, hasData } = React.useMemo(() => {
    if (!data || data.length === 0) {
      return { linePath: '', areaPath: '', hasData: false };
    }
    const pad = strokeWidth;
    const usableW = Math.max(1, width - pad * 2);
    const usableH = Math.max(1, height - pad * 2);
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = data.length > 1 ? usableW / (data.length - 1) : 0;
    const points = data.map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + usableH - ((v - min) / range) * usableH;
      return [x, y] as const;
    });
    const line = points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ');
    const lastX = (pad + (data.length - 1) * stepX).toFixed(2);
    const area = `${line} L${lastX},${(height - pad).toFixed(2)} L${pad.toFixed(2)},${(height - pad).toFixed(2)} Z`;
    return { linePath: line, areaPath: area, hasData: max !== min || max !== 0 };
  }, [data, width, height, strokeWidth]);

  if (!linePath) {
    return (
      <svg
        width={width}
        height={height}
        className={cn('opacity-30', className)}
        aria-label={ariaLabel ?? 'No data'}
        role="img"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label={ariaLabel ?? 'Trend sparkline'}
      role="img"
    >
      {hasData && fillOpacity > 0 ? (
        <path d={areaPath} fill={stroke} fillOpacity={fillOpacity} />
      ) : null}
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});
