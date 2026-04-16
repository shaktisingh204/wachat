'use client';
import { useEffect, useRef, useState } from 'react';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { getBlockIcon, getBlockLabel, getBlockColor } from '@/lib/sabflow/blocks';

export function BlockCardOverlay() {
  const { draggedBlockType } = useBlockDnd();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!draggedBlockType) return;
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [draggedBlockType]);

  if (!draggedBlockType) return null;

  const Icon = getBlockIcon(draggedBlockType);
  const label = getBlockLabel(draggedBlockType);
  const color = getBlockColor(draggedBlockType);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] px-3 py-2 shadow-lg opacity-90"
      style={{ left: pos.x + 14, top: pos.y - 14 }}
    >
      <div
        className="flex h-6 w-6 items-center justify-center rounded"
        style={{ background: `${color}22`, color }}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </div>
      <span className="text-[12px] font-medium text-[var(--gray-12)]">{label}</span>
    </div>
  );
}
