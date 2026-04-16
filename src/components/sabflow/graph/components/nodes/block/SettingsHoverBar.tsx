'use client';
import { LuSettings, LuCopy, LuTrash2 } from 'react-icons/lu';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  onSettingsClick: () => void;
  onDuplicateClick: () => void;
  onDeleteClick: () => void;
};

/**
 * Floating action bar that appears when hovering over a BlockNode.
 *
 * - `prevent-group-drag` class stops pointer events from bubbling to the
 *   group drag handler (mirrors Typebot's pattern).
 * - Gear icon opens the block settings panel via `setOpenedNodeId` in BlockNode.
 * - Duplicate / delete are forwarded to the parent BlockNodesList.
 */
export function SettingsHoverBar({
  className,
  onSettingsClick,
  onDuplicateClick,
  onDeleteClick,
}: Props) {
  return (
    <div
      className={cn(
        'prevent-group-drag',
        'flex items-center rounded-md border shadow-md bg-[var(--gray-1)]',
        'divide-x divide-[var(--gray-4)]',
        className,
      )}
      // Stop pointer events so the bar itself never triggers group drag
      onPointerDown={(e) => e.stopPropagation()}
    >
      <HoverBarButton
        label="Block settings"
        onClick={onSettingsClick}
        className="rounded-l-md rounded-r-none"
      >
        <LuSettings className="h-3 w-3" />
      </HoverBarButton>

      <HoverBarButton
        label="Duplicate block"
        onClick={onDuplicateClick}
        className="rounded-none"
      >
        <LuCopy className="h-3 w-3" />
      </HoverBarButton>

      <HoverBarButton
        label="Delete block"
        onClick={onDeleteClick}
        className="rounded-r-md rounded-l-none text-red-500 hover:text-red-600 dark:text-red-400"
      >
        <LuTrash2 className="h-3 w-3" />
      </HoverBarButton>
    </div>
  );
}

/* ── tiny reusable button ────────────────────────────────────────────────── */

function HoverBarButton({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cn(
        'flex h-6 w-6 items-center justify-center',
        'text-[var(--gray-11)] hover:text-[var(--gray-12)]',
        'hover:bg-[var(--gray-3)] transition-colors',
        className,
      )}
    >
      {children}
    </button>
  );
}
