'use client';
import { useEffect, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { LuCopy, LuTrash2 } from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import type { SabFlowDoc, Group, Edge, GraphPosition, Coordinates } from '@/lib/sabflow/types';
import { useSelectionStore } from '../hooks/useSelectionStore';
import { useToast } from '@/hooks/use-toast';

type Props = {
  graphPosition: GraphPosition;
  focusedElementIds: string[];
  blurElements: () => void;
  flow: Pick<SabFlowDoc, 'groups' | 'edges'>;
  onFlowChange: (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>>) => void;
};

/** Project client (screen) mouse coords into canvas coords. */
function projectMouse(
  clientCoords: Coordinates,
  canvasPosition: GraphPosition,
): Coordinates {
  return {
    x: (clientCoords.x - canvasPosition.x) / canvasPosition.scale,
    y: (clientCoords.y - canvasPosition.y) / canvasPosition.scale,
  };
}

export function ElementsSelectionMenu({
  graphPosition,
  focusedElementIds,
  blurElements,
  flow,
  onFlowChange,
}: Props) {
  const { toast } = useToast();
  const [mousePosition, setMousePosition] = useState<Coordinates | undefined>(undefined);

  const elementsInClipboard = useSelectionStore(
    useShallow((s) => s.elementsInClipboard),
  );
  const { copyElements, setFocusedElements, updateElementCoordinates } = useSelectionStore(
    useShallow((s) => ({
      copyElements: s.copyElements,
      setFocusedElements: s.setFocusedElements,
      updateElementCoordinates: s.updateElementCoordinates,
    })),
  );

  // Track mouse position in screen coords
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  // ── Copy ──────────────────────────────────────────────────────────────────
  const handleCopy = (): { groups: Group[]; edges: Edge[] } | undefined => {
    const groups = flow.groups.filter((g) => focusedElementIds.includes(g.id));
    if (groups.length === 0) return undefined;
    const groupIds = new Set(groups.map((g) => g.id));
    const edges = flow.edges.filter((e) => groupIds.has(e.to.groupId));
    const clipboard = { groups, edges };
    copyElements(clipboard);
    return clipboard;
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (targetIds?: string[]) => {
    const ids = new Set(targetIds ?? focusedElementIds);
    onFlowChange({
      groups: flow.groups.filter((g) => !ids.has(g.id)),
      edges: flow.edges.filter(
        (e) => !ids.has(e.to.groupId) && !(e.from.groupId && ids.has(e.from.groupId as string)),
      ),
    });
    blurElements();
  };

  // ── Paste ─────────────────────────────────────────────────────────────────
  const handlePaste = (overrideClipboard?: { groups: Group[]; edges: Edge[] }) => {
    const clipboard = overrideClipboard ?? elementsInClipboard;
    if (!clipboard || clipboard.groups.length === 0 || !mousePosition) return;

    const canvasMousePos = projectMouse(mousePosition, graphPosition);

    // Find the far-left group to use as reference anchor
    const farLeftGroup = [...clipboard.groups].sort(
      (a, b) => a.graphCoordinates.x - b.graphCoordinates.x,
    )[0];

    const offsetX = canvasMousePos.x - farLeftGroup.graphCoordinates.x;
    const offsetY = canvasMousePos.y - farLeftGroup.graphCoordinates.y;

    // Build old→new ID map for groups
    const groupIdMap = new Map<string, string>(
      clipboard.groups.map((g) => [g.id, createId()]),
    );

    const newGroups: Group[] = clipboard.groups.map((g) => {
      const newGroupId = groupIdMap.get(g.id)!;
      return {
        ...g,
        id: newGroupId,
        graphCoordinates: {
          x: g.graphCoordinates.x + offsetX,
          y: g.graphCoordinates.y + offsetY,
        },
        blocks: g.blocks.map((b) => ({
          ...b,
          id: createId(),
          groupId: newGroupId,
          // Clear outgoing edge references — edges are remapped below
          outgoingEdgeId: undefined,
        })),
      };
    });

    const newEdges: Edge[] = clipboard.edges.flatMap((e) => {
      // Skip event-sourced edges (no groupId to remap)
      if (!e.from.groupId) return [];
      const newFromGroupId = groupIdMap.get(e.from.groupId as string);
      const newToGroupId = groupIdMap.get(e.to.groupId);
      if (!newFromGroupId || !newToGroupId) return [];
      // Reconstruct EdgeFrom as discriminated union (spread breaks the union)
      const from: Edge['from'] = e.from.blockId
        ? e.from.itemId
          ? { groupId: newFromGroupId, blockId: e.from.blockId, itemId: e.from.itemId }
          : { groupId: newFromGroupId, blockId: e.from.blockId }
        : { groupId: newFromGroupId };
      return [
        {
          id: createId(),
          from,
          to: { groupId: newToGroupId, blockId: e.to.blockId },
        },
      ];
    });

    // Register new coordinates in selection store
    newGroups.forEach((g) => updateElementCoordinates(g.id, g.graphCoordinates));

    onFlowChange({
      groups: [...flow.groups, ...newGroups],
      edges: [...flow.edges, ...newEdges],
    });

    setFocusedElements(newGroups.map((g) => g.id));
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (isInput) return;

      // Cmd/Ctrl+A — select all groups
      if (isMeta && e.key === 'a') {
        e.preventDefault();
        setFocusedElements(flow.groups.map((g) => g.id));
        return;
      }

      // Shortcuts below require at least one element focused
      if (focusedElementIds.length === 0) return;

      if (isMeta && e.key === 'c') {
        e.preventDefault();
        handleCopy();
        toast({ title: 'Copied', description: 'Elements copied to clipboard' });
        return;
      }

      if (isMeta && e.key === 'x') {
        e.preventDefault();
        handleCopy();
        handleDelete();
        return;
      }

      if (isMeta && e.key === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      if (isMeta && e.key === 'd') {
        e.preventDefault();
        const clipboard = handleCopy();
        if (clipboard) handlePaste(clipboard);
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedElementIds, flow.groups, flow.edges, elementsInClipboard, mousePosition, graphPosition]);

  if (focusedElementIds.length === 0) return null;

  return (
    <div
      className="flex items-stretch gap-1"
      onPointerDownCapture={(e) => e.stopPropagation()}
      onPointerUpCapture={(e) => e.stopPropagation()}
    >
      <span className="text-sm font-medium px-2 inline-flex items-center select-none text-[var(--gray-11)]">
        {focusedElementIds.length} selected
      </span>
      <button
        aria-label="Copy"
        title="Copy (Cmd+C)"
        onClick={() => {
          handleCopy();
          toast({ title: 'Copied', description: 'Elements copied to clipboard' });
        }}
        className="flex h-7 w-7 items-center justify-center rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors"
      >
        <LuCopy size={14} />
      </button>
      <button
        aria-label="Delete"
        title="Delete (Backspace)"
        onClick={() => handleDelete()}
        className="flex h-7 w-7 items-center justify-center rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors"
      >
        <LuTrash2 size={14} />
      </button>
    </div>
  );
}
