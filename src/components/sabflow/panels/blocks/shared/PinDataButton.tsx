'use client';

/**
 * PinDataButton - inline "Pin this output" toggle.
 *
 * When clicked with a value, the current node's output is pinned in the
 * nodeData store so that downstream test executions read the pinned value
 * instead of re-running the upstream node. Clicking again unpins it.
 */

import { useCallback, useMemo } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui';
import { useNodeDataStore } from '@/lib/sabflow/execution/nodeData';

type Props = {
  /** The block id whose output is being pinned. */
  blockId: string;
  /** The value to pin - usually the last successful test output. */
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
        ? { label: 'Unpin output', Icon: PinOff }
        : { label: 'Pin this output', Icon: Pin },
    [isPinned],
  );

  const disabled = !isPinned && !canPin;

  return (
    <Button
      variant={isPinned ? 'primary' : 'secondary'}
      size="sm"
      iconLeft={Icon}
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      title={disabled ? 'Run the node at least once to pin its output' : label}
      className={className}
    >
      {label}
    </Button>
  );
}
