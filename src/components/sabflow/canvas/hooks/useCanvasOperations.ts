'use client';
/**
 * useCanvasOperations — add/duplicate/delete/connect helpers that mutate the
 * SabFlowDoc and hand back to EditorPage via onFlowChange.
 *
 * This is the React equivalent of n8n's useCanvasOperations composable.
 */
import { useCallback } from 'react';
import { createId } from '@paralleldrive/cuid2';
import type {
  Block,
  BlockType,
  Coordinates,
  Edge as SabEdge,
  Group,
  SabFlowDoc,
} from '@/lib/sabflow/types';
import { DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE } from '@/lib/sabflow/ports';
import { addEdge, removeEdge, removeNodes } from '../adapter';
import { createCanvasConnectionId } from '../utils';

type Update = (next: SabFlowDoc) => void;

/** Generate a new group that wraps a single block at the given canvas position. */
function createGroupWithBlock(
  type: BlockType,
  position: Coordinates,
): { group: Group; block: Block } {
  const blockId = createId();
  const groupId = createId();
  const block: Block = {
    id: blockId,
    type,
    groupId,
    graphCoordinates: position,
  };
  const group: Group = {
    id: groupId,
    title: '',
    graphCoordinates: position,
    blocks: [block],
  };
  return { group, block };
}

export function useCanvasOperations(
  flow: SabFlowDoc,
  update: Update,
) {
  /** Add a new block as a new group at the given canvas position. */
  const addBlock = useCallback(
    (args: {
      type: BlockType;
      position: Coordinates;
      connectFrom?: { nodeId: string; handleId: string };
      spliceEdgeId?: string;
    }): string => {
      const { group, block } = createGroupWithBlock(args.type, args.position);
      let next: SabFlowDoc = {
        ...flow,
        groups: [...(flow.groups ?? []), group],
      };

      // Auto-wire from source handle if provided
      if (args.connectFrom) {
        next = addEdge(next, {
          source: args.connectFrom.nodeId,
          sourceHandle: args.connectFrom.handleId,
          target: block.id,
          targetHandle: DEFAULT_TARGET_HANDLE,
        });
      }

      // Splice onto an existing edge: remove it, add src→new + new→tgt
      if (args.spliceEdgeId) {
        const orig = next.edges?.find((e) => e.id === args.spliceEdgeId);
        if (orig) {
          next = removeEdge(next, args.spliceEdgeId);
          const srcId = 'eventId' in orig.from ? orig.from.eventId : orig.from.blockId;
          const tgtId = orig.to.blockId;
          if (srcId) {
            next = addEdge(next, {
              source: srcId,
              sourceHandle: orig.sourceHandle ?? DEFAULT_SOURCE_HANDLE,
              target: block.id,
              targetHandle: DEFAULT_TARGET_HANDLE,
            });
          }
          if (tgtId) {
            next = addEdge(next, {
              source: block.id,
              sourceHandle: DEFAULT_SOURCE_HANDLE,
              target: tgtId,
              targetHandle: orig.targetHandle ?? DEFAULT_TARGET_HANDLE,
            });
          }
        }
      }

      update(next);
      return block.id;
    },
    [flow, update],
  );

  /** Connect two nodes via an edge. */
  const connect = useCallback(
    (params: {
      source: string;
      sourceHandle: string;
      target: string;
      targetHandle: string;
    }) => {
      update(addEdge(flow, params));
    },
    [flow, update],
  );

  /** Delete selected nodes + their edges. */
  const deleteNodes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      update(removeNodes(flow, ids));
    },
    [flow, update],
  );

  /** Delete a single edge. */
  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      update(removeEdge(flow, edgeId));
    },
    [flow, update],
  );

  /** Duplicate selected blocks (offset by 40,40). */
  const duplicateNodes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      let next = flow;
      for (const id of ids) {
        // Find block
        let srcBlock: Block | undefined;
        let srcGroup: Group | undefined;
        for (const g of next.groups ?? []) {
          const b = g.blocks.find((b) => b.id === id);
          if (b) {
            srcBlock = b;
            srcGroup = g;
            break;
          }
        }
        if (!srcBlock || !srcGroup) continue;

        const newGroupId = createId();
        const newBlockId = createId();
        const offset: Coordinates = {
          x: (srcBlock.graphCoordinates ?? srcGroup.graphCoordinates).x + 40,
          y: (srcBlock.graphCoordinates ?? srcGroup.graphCoordinates).y + 40,
        };
        const newBlock: Block = {
          ...srcBlock,
          id: newBlockId,
          groupId: newGroupId,
          graphCoordinates: offset,
        };
        const newGroup: Group = {
          id: newGroupId,
          title: '',
          graphCoordinates: offset,
          blocks: [newBlock],
        };
        next = { ...next, groups: [...(next.groups ?? []), newGroup] };
      }
      update(next);
    },
    [flow, update],
  );

  /** Toggle disabled on blocks. We store disabled state in block.options.disabled
   *  since the legacy schema didn't include it; the engine respects this. */
  const toggleDisabled = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const groups = (flow.groups ?? []).map((g) => ({
        ...g,
        blocks: g.blocks.map((b) => {
          if (!idSet.has(b.id)) return b;
          const opts = (b.options ?? {}) as Record<string, unknown>;
          return {
            ...b,
            options: { ...opts, disabled: !opts.disabled },
          } as Block;
        }),
      }));
      update({ ...flow, groups });
    },
    [flow, update],
  );

  /** Pin / unpin a block's output. Resets pinData to undefined when unpinning. */
  const togglePin = useCallback(
    (nodeId: string) => {
      const groups = (flow.groups ?? []).map((g) => ({
        ...g,
        blocks: g.blocks.map((b) => {
          if (b.id !== nodeId) return b;
          return { ...b, pinData: b.pinData === undefined ? {} : undefined } as Block;
        }),
      }));
      update({ ...flow, groups });
    },
    [flow, update],
  );

  return {
    addBlock,
    connect,
    deleteNodes,
    deleteEdgeById,
    duplicateNodes,
    toggleDisabled,
    togglePin,
  };
}
