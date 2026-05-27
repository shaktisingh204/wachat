'use client';
import type { Coordinates } from '@/lib/sabflow/types';

type Props = {
  origin: Coordinates;
  dimension: {
    width: number;
    height: number;
  };
};

export function SelectBox({ origin, dimension }: Props) {
  return (
    <div
      className="fixed pointer-events-none rounded-md border border-zoru-line bg-zoru-ink/10 z-50"
      style={{
        left: origin.x,
        top: origin.y,
        width: dimension.width,
        height: dimension.height,
      }}
    />
  );
}
