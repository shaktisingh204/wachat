'use client';

/**
 * useNodeContext — thin helper hook that exposes the node-data store in the
 * shape the Test-Node panel expects.
 *
 * The returned getters read the non-reactive store snapshot so that calling
 * them inside a `useCallback` handler does not cause unnecessary re-renders.
 * The callbacks themselves are stable across renders.
 */

import { useCallback } from 'react';
import {
  useNodeDataStore,
  getLastInput,
  getPinnedOutput,
} from '@/lib/sabflow/execution/nodeData';

export type NodeContextApi = {
  /** Returns the last input observed for the given block, or undefined. */
  getInput: (blockId: string) => unknown;
  /** Returns the pinned output for the given block, or undefined. */
  getPinnedData: (blockId: string) => unknown;
  /** Returns the last observed output (pinned preferred) or undefined. */
  getOutput: (blockId: string) => unknown;
};

export function useNodeContext(): NodeContextApi {
  const getInput = useCallback((blockId: string) => getLastInput(blockId), []);
  const getPinnedData = useCallback(
    (blockId: string) => getPinnedOutput(blockId),
    [],
  );
  const getOutput = useCallback((blockId: string) => {
    const entry = useNodeDataStore.getState().entries[blockId];
    if (!entry) return undefined;
    return entry.pinnedOutput !== undefined
      ? entry.pinnedOutput
      : entry.lastOutput;
  }, []);

  return { getInput, getPinnedData, getOutput };
}
