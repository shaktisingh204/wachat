'use client';

/**
 * PinDataButton — inline "Pin this output" toggle.
 *
 * When clicked with a value, the current node's output is pinned in the
 * nodeData store so that downstream test executions read the pinned value
 * instead of re-running the upstream node.  Clicking again unpins it.
 */

import { useCallback, useMemo } from 'react';
import { LuPin, LuPinOff } from 'react-icons/lu';
import { useNodeDataStore } from '@/lib/sabflow/execution/nodeData';
import { cn } from '@/lib/utils';

type Props = {
  /** The block id whose output is being pinned. */
  blockId: string;
  /** The value to pin — usually the last successful test output. */
  value?: unknown;
  /** Optional extra className for layout tweaks. */
  className?: string;
  /** When provided, pin writes persist to `block.pinData`. */
  onPersistPin?: (value: unknown) => void;
  /** When provided, unpin clears `block.pinData`. */
  onClearPin?: () => void;
  /** True when block.pinData is currently set. Drives the pressed state. */
  persisted?: boolean;
};

export function PinDataButton({
  blockId,
  value,
  className,
  onPersistPin,
  onClearPin,
  persisted,
}: Props) {
  const pinnedOutput = useNodeDataStore(
    (state) => state.entries[blockId]?.pinnedOutput,
  );
  const pinData = useNodeDataStore((state) => state.pinData);
  const unpinData = useNodeDataStore((state) => state.unpinData);

  const isPinned = persisted ?? pinnedOutput !== undefined;
  const canPin = value !== undefined && value !== null;

  const handleClick = useCallback(() => {
    if (isPinned) {
      unpinData(blockId);
      onClearPin?.();
      return;
    }
    if (canPin) {
      pinData(blockId, value);
      onPersistPin?.(value);
    }
  }, [isPinned, canPin, pinData, unpinData, blockId, value, onPersistPin, onClearPin]);

  const { label, Icon } = useMemo(
    () =>
      isPinned
        ? { label: 'Unpin output', Icon: LuPinOff }
        : { label: 'Pin this output', Icon: LuPin },
    [isPinned],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isPinned && !canPin}
      title={
        !isPinned && !canPin
          ? 'Run the node at least once to pin its output'
          : label
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        isPinned
          ? 'border-[#f76808]/40 bg-[#f76808]/10 text-[#f76808] hover:bg-[#f76808]/15'
          : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:text-[var(--gray-12)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {label}
    </button>
  );
}
