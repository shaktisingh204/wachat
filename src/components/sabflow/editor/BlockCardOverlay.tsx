'use client';
import { useEffect, useRef, useState } from 'react';
import { useBlockDnd } from '@/components/sabflow/graph/providers/GraphDndProvider';
import { Card } from '@/components/sabcrm/20ui';
import { getRegistryEntry } from './blockRegistry';

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

  const entry = getRegistryEntry(draggedBlockType);
  if (!entry) return null;
  const { icon: Icon, label, color } = entry;

  return (
    <Card
      variant="elevated"
      padding="none"
      aria-hidden="true"
      className="pointer-events-none fixed z-50 flex min-w-[140px] -rotate-2 items-center gap-2.5 px-3 py-2.5 opacity-90 will-change-[left,top]"
      style={{ left: pos.x + 14, top: pos.y - 14 }}
    >
      {/* Icon badge: color is runtime-computed from the block registry entry */}
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)]"
        style={{ backgroundColor: color + '20', color }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </div>

      {/* Label */}
      <span className="whitespace-nowrap text-[12px] font-medium text-[var(--st-text)]">
        {label}
      </span>
    </Card>
  );
}
