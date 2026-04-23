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
  Annotation,
  AnnotationColor,
  Block,
  BlockType,
  Coordinates,
  Edge as SabEdge,
  Group,
  SabFlowDoc,
} from '@/lib/sabflow/types';
import { DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE } from '@/lib/sabflow/ports';
import {
  addEdge,
  addStickyNote,
  addTriggerEvent,
  changeEventType,
  ensureStartEvent,
  findStartEvent,
  removeEdge,
  removeNodes,
  renameBlock,
  updateStickyNote,
} from '../adapter';
import { createCanvasConnectionId } from '../utils';
import { tidyUp as tidyUpFlow } from './useTidyUp';

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

  /** Delete selected nodes + their edges.
   *  Never lets the user delete every trigger event — the engine needs at
   *  least one to start the flow. If the deletion would leave zero triggers,
   *  the last trigger in the deletion list is preserved. */
  const deleteNodes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const eventIds = new Set((flow.events ?? []).map((e) => e.id));
      const triggersBeingDeleted = ids.filter((id) => eventIds.has(id));
      const remainingTriggers = eventIds.size - triggersBeingDeleted.length;
      let filtered = ids;
      if (remainingTriggers < 1 && triggersBeingDeleted.length > 0) {
        const keepId = triggersBeingDeleted[triggersBeingDeleted.length - 1];
        filtered = ids.filter((id) => id !== keepId);
      }
      if (filtered.length === 0) return;
      update(removeNodes(flow, filtered));
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

  /** Create a new sticky-note at a canvas position. */
  const addSticky = useCallback(
    (position: Coordinates, color: AnnotationColor = 'yellow'): string => {
      const note: Annotation = {
        id: createId(),
        type: 'sticky_note',
        graphCoordinates: position,
        width: 240,
        height: 160,
        content: '',
        color,
      };
      update(addStickyNote(flow, note));
      return note.id;
    },
    [flow, update],
  );

  /** Patch a sticky-note annotation. */
  const patchSticky = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      update(updateStickyNote(flow, id, patch));
    },
    [flow, update],
  );

  /** Rename a block — stored on block.options.title so ports untouched. */
  const rename = useCallback(
    (id: string, label: string) => {
      update(renameBlock(flow, id, label));
    },
    [flow, update],
  );

  /** Auto-layout the whole canvas in one pass. */
  const tidyUp = useCallback(() => {
    update(tidyUpFlow(flow));
  }, [flow, update]);

  /**
   * Paste a previously-copied payload (`{ type:'sabflow-clipboard', blocks, edges }`)
   * at a canvas position, remapping IDs and preserving internal connections.
   */
  const pastePayload = useCallback(
    (
      payload: {
        blocks?: Array<Block & { position?: Coordinates }>;
        edges?: SabEdge[];
      },
      at: Coordinates,
    ) => {
      if (!payload.blocks?.length) return;
      // Remap IDs — new block id per old, new group per old.
      const idMap = new Map<string, string>();
      for (const b of payload.blocks) idMap.set(b.id, createId());

      // Bounding-box origin so paste lands relative to the cursor.
      const xs = payload.blocks.map((b) => (b.graphCoordinates ?? b.position ?? { x: 0, y: 0 }).x);
      const ys = payload.blocks.map((b) => (b.graphCoordinates ?? b.position ?? { x: 0, y: 0 }).y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);

      let next: SabFlowDoc = flow;
      for (const b of payload.blocks) {
        const newBlockId = idMap.get(b.id)!;
        const newGroupId = createId();
        const src = b.graphCoordinates ?? b.position ?? { x: 0, y: 0 };
        const position: Coordinates = {
          x: at.x + (src.x - minX),
          y: at.y + (src.y - minY),
        };
        const newBlock: Block = {
          ...b,
          id: newBlockId,
          groupId: newGroupId,
          graphCoordinates: position,
        };
        const newGroup: Group = {
          id: newGroupId,
          title: '',
          graphCoordinates: position,
          blocks: [newBlock],
        };
        next = { ...next, groups: [...(next.groups ?? []), newGroup] };
      }
      // Edges whose endpoints are both within the clipboard get remapped.
      for (const e of payload.edges ?? []) {
        const srcId = 'eventId' in e.from ? e.from.eventId : e.from.blockId;
        const tgtId = e.to.blockId;
        if (!srcId || !tgtId) continue;
        if (!idMap.has(srcId) || !idMap.has(tgtId)) continue;
        next = addEdge(next, {
          source: idMap.get(srcId)!,
          sourceHandle: e.sourceHandle ?? DEFAULT_SOURCE_HANDLE,
          target: idMap.get(tgtId)!,
          targetHandle: e.targetHandle ?? DEFAULT_TARGET_HANDLE,
        });
      }
      update(next);
    },
    [flow, update],
  );

  /** Collect selected block+edge data into a clipboard payload. */
  const buildClipboardPayload = useCallback(
    (selectedIds: string[]) => {
      const idSet = new Set(selectedIds);
      const blocks: Block[] = [];
      for (const g of flow.groups ?? []) {
        for (const b of g.blocks) {
          if (idSet.has(b.id)) {
            blocks.push({
              ...b,
              graphCoordinates: b.graphCoordinates ?? g.graphCoordinates,
            });
          }
        }
      }
      const edges = (flow.edges ?? []).filter((e) => {
        const s = 'eventId' in e.from ? e.from.eventId : e.from.blockId;
        const t = e.to.blockId;
        return s && t && idSet.has(s) && idSet.has(t);
      });
      return { type: 'sabflow-clipboard' as const, blocks, edges };
    },
    [flow],
  );

  /**
   * Ensure the flow has a start event. If one is missing, add it and commit.
   * Returns the id of the event that now serves as the start trigger.
   */
  const ensureStart = useCallback((): string | undefined => {
    const existing = findStartEvent(flow);
    if (existing) return existing.id;
    const next = ensureStartEvent(flow, createId);
    update(next);
    return findStartEvent(next)?.id;
  }, [flow, update]);

  /** Change a trigger event's type (start / webhook / schedule / manual). */
  const setEventType = useCallback(
    (
      eventId: string,
      type: 'start' | 'webhook' | 'schedule' | 'manual' | 'error',
    ) => {
      update(changeEventType(flow, eventId, type));
    },
    [flow, update],
  );

  /**
   * Append a new trigger event of the given type. Used by the n8n-style
   * "What triggers this workflow?" picker that opens on an empty canvas.
   * Returns the id of the created event.
   */
  const addTrigger = useCallback(
    (
      type: 'start' | 'webhook' | 'schedule' | 'manual' | 'error',
      position?: { x: number; y: number },
    ): string => {
      const id = createId();
      const next = addTriggerEvent(flow, type, () => id, position);
      update(next);
      return id;
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
    addSticky,
    patchSticky,
    rename,
    tidyUp,
    pastePayload,
    buildClipboardPayload,
    ensureStart,
    setEventType,
    addTrigger,
  };
}
