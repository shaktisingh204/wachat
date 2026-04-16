'use client';
import type { Coordinates } from '@/lib/sabflow/types';

type SelectBoxDimensions = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function computeSelectBoxDimensions(
  start: Coordinates,
  current: Coordinates,
): SelectBoxDimensions {
  return {
    top: Math.min(start.y, current.y),
    left: Math.min(start.x, current.x),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

export function SelectBox({ dimensions }: { dimensions: SelectBoxDimensions }) {
  return (
    <div
      className="absolute pointer-events-none border-2 border-[#f76808] bg-[#f76808]/10 rounded z-50"
      style={{
        top: dimensions.top,
        left: dimensions.left,
        width: dimensions.width,
        height: dimensions.height,
      }}
    />
  );
}
