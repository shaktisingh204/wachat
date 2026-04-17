'use client';

import type { NodePort } from '@/lib/sabflow/types';
import { InputHandle } from './InputHandle';
import { OutputHandle } from './OutputHandle';

const MIN_GAP = 24;

type Props = {
  blockId: string;
  groupId: string;
  inputPorts: NodePort[];
  outputPorts: NodePort[];
  /** Height of the block card in px — used to distribute handles vertically. */
  blockHeight: number;
  /** Set of output handle IDs that have at least one outgoing edge. */
  connectedOutputHandles?: Set<string>;
};

/**
 * Renders input handles (left edge) and output handles (right edge) for a block,
 * vertically distributed along the node card.
 *
 * Spacing: evenly distributed with a minimum gap of 24px between handles.
 */
export function HandleRenderer({
  blockId,
  groupId,
  inputPorts,
  outputPorts,
  blockHeight,
  connectedOutputHandles,
}: Props) {
  return (
    <>
      {/* Input handles — left side */}
      {inputPorts.map((port, i) => {
        const topOffset = computeOffset(i, inputPorts.length, blockHeight);
        return (
          <InputHandle
            key={port.id}
            port={port}
            blockId={blockId}
            groupId={groupId}
            topOffset={topOffset}
          />
        );
      })}

      {/* Output handles — right side */}
      {outputPorts.map((port, i) => {
        const topOffset = computeOffset(i, outputPorts.length, blockHeight);
        const hasEdge = connectedOutputHandles?.has(port.id) ?? false;
        return (
          <OutputHandle
            key={port.id}
            port={port}
            blockId={blockId}
            groupId={groupId}
            topOffset={topOffset}
            hasOutgoingEdge={hasEdge}
          />
        );
      })}
    </>
  );
}

/**
 * Compute the vertical offset for a handle at index `i` among `total` handles
 * within a block of height `blockHeight`.
 *
 * Single handle: centered vertically.
 * Multiple handles: evenly spaced with MIN_GAP minimum.
 */
function computeOffset(index: number, total: number, blockHeight: number): number {
  if (total <= 1) {
    // Center single handle
    return Math.max(0, blockHeight / 2 - 10);
  }
  const usableHeight = Math.max(blockHeight - 20, total * MIN_GAP);
  const step = usableHeight / (total - 1);
  return 10 + index * step;
}
