'use client';
import { useEffect, useRef, useState } from 'react';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { getBlockIcon, getBlockLabel, getBlockColor } from '@/lib/sabflow/blocks';

/**
 * A floating ghost card that follows the mouse cursor while the user is
 * dragging a block type from the sidebar onto the canvas.
 *
 * Rendered at the root of EditorPage (outside the sidebar/canvas stack)
 * so it always floats above everything else (z-50, pointer-events-none).
 */
export function BlockCardOverlay() {
  const { draggedBlockType } = useBlockDnd();
  const [pos, setPos] = useState({ x: -9999, y: -9999 });
  const animFrame = useRef<number>(0);

  useEffect(() => {
    if (!draggedBlockType) return;

    const onMove = (e: MouseEvent) => {
      // Use rAF to throttle to display refresh rate
      cancelAnimationFrame(animFrame.current);
      animFrame.current = requestAnimationFrame(() => {
        setPos({ x: e.clientX, y: e.clientY });
      });
    };

    // Reset position to cursor-adjacent on drag start
    const onDown = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousedown', onDown);
      cancelAnimationFrame(animFrame.current);
    };
  }, [draggedBlockType]);

  // Clear position when drag ends so it doesn't flash on next drag start
  useEffect(() => {
    if (!draggedBlockType) {
      setPos({ x: -9999, y: -9999 });
    }
  }, [draggedBlockType]);

  if (!draggedBlockType) return null;

  const Icon = getBlockIcon(draggedBlockType);
  const label = getBlockLabel(draggedBlockType);
  const color = getBlockColor(draggedBlockType);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] shadow-lg opacity-90"
      style={{
        left: pos.x + 14,
        top: pos.y - 14,
        transform: 'rotate(-2deg)',
        willChange: 'left, top',
        minWidth: '140px',
      }}
    >
      {/* Icon badge */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: color + '20', color }}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </div>

      {/* Label */}
      <span className="text-[12px] font-medium text-[var(--gray-12)] whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}
