'use client';
import { useRef, useState, useEffect } from 'react';
import { useDrag } from '@use-gesture/react';
import { useShallow } from 'zustand/react/shallow';
import type { Group, Edge, SabFlowDoc } from '@/lib/sabflow/types';
import { useGraph } from '../../../providers/GraphProvider';
import { useBlockDnd } from '../../../providers/GraphDndProvider';
import { useSelectionStore } from '../../../hooks/useSelectionStore';
import { BlockNodesList } from '../block/BlockNodesList';
import { cn } from '@/lib/utils';
import { GroupFocusToolbar } from './GroupFocusToolbar';
import { GroupNodeContextMenu } from './GroupNodeContextMenu';

const GROUP_WIDTH = 300;

type Props = {
  group: Group;
  groupIndex: number;
  edges: Edge[];
  onGroupUpdate?: (id: string, changes: Partial<Group>) => void;
  onGroupBlocksChange?: (groupId: string, blocks: Group['blocks']) => void;
  onPlayClick?: () => void;
  /** Optional: full groups+edges slice — forwarded to the context menu for
   *  delete/select-connected operations that need the whole graph. */
  flow?: Pick<SabFlowDoc, 'groups' | 'edges'>;
  onFlowChange?: (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges'>>) => void;
};

export function GroupNode({
  group,
  groupIndex,
  edges,
  onGroupUpdate,
  onGroupBlocksChange,
  onPlayClick = () => {},
  flow,
  onFlowChange,
}: Props) {
  const { connectingIds, setConnectingIds, isReadOnly, graphPosition } = useGraph();
  const { setMouseOverGroup, mouseOverGroup } = useBlockDnd();

  const [title, setTitle] = useState(group.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const groupRef = useRef<HTMLDivElement | null>(null);

  const isDraggingGraph = useSelectionStore((s) => s.isDraggingGraph);
  const focusedGroups = useSelectionStore(useShallow((s) => s.focusedElementsId));
  const isFocused = focusedGroups.includes(group.id);

  // Live position from store — falls back to prop coordinates if not yet seeded
  const groupCoords = useSelectionStore(
    useShallow((s) => s.elementsCoordinates?.[group.id] ?? group.graphCoordinates),
  );

  const { moveFocusedElements, focusElement, getElementsCoordinates, updateElementCoordinates } =
    useSelectionStore(
      useShallow((s) => ({
        moveFocusedElements: s.moveFocusedElements,
        focusElement: s.focusElement,
        getElementsCoordinates: s.getElementsCoordinates,
        updateElementCoordinates: s.updateElementCoordinates,
      })),
    );

  // Seed this group's coordinates into the store on mount so the store is
  // always the authoritative source for position (Typebot pattern).
  useEffect(() => {
    updateElementCoordinates(group.id, group.graphCoordinates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  // Keep local title in sync when the prop changes externally (e.g. undo/redo)
  useEffect(() => {
    if (group.title !== title) setTitle(group.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.title]);

  // Derived — no useState/useEffect lag. isConnecting is true when an edge drag
  // is targeting this group (but not a specific block inside it).
  const isConnecting =
    connectingIds?.target?.groupId === group.id && !connectingIds.target?.blockId;

  // ── Drag handler ─────────────────────────────────────────────────────────
  // NOTE: filterTaps is intentionally NOT set here.
  // Without filterTaps, `first` fires on pointerdown, so event.stopPropagation()
  // prevents the canvas gesture from starting (it never receives pointerdown).
  // With filterTaps, `first` fires on pointermove — by then the canvas has already
  // registered its window listeners and both pan + group-drag run simultaneously.
  useDrag(
    ({ first, last, delta: [dx, dy], event, target }) => {
      // Prevent the canvas useGesture from also starting a drag/pan on every
      // event (first call is the critical one — it stops canvas pointerdown).
      event.stopPropagation();

      // Don't initiate drag when the pointer is over title input, connection
      // dots, or any other element that opts out via this sentinel class.
      if ((target as HTMLElement).closest('.prevent-group-drag')) return;

      if (first) {
        setIsMouseDown(true);
        // Already focused with no shift key → don't change selection
        if (focusedGroups.includes(group.id) && !(event as PointerEvent).shiftKey) return;
        focusElement(group.id, (event as PointerEvent).shiftKey);
      }

      // Translate delta from screen pixels to canvas-coordinate units
      moveFocusedElements({
        x: dx / graphPosition.scale,
        y: dy / graphPosition.scale,
      });

      if (last) {
        setIsMouseDown(false);
        const coords = getElementsCoordinates();
        if (coords?.[group.id]) {
          onGroupUpdate?.(group.id, { graphCoordinates: coords[group.id] });
        }
      }
    },
    {
      target: groupRef,
      pointer: { keys: false },
      // 'from' keeps use-gesture's internal origin aligned with the element's
      // actual canvas position so delta calculations remain correct after panning.
      from: () => [
        groupCoords.x * graphPosition.scale,
        groupCoords.y * graphPosition.scale,
      ],
    },
  );

  const isSingleFocus = isFocused && focusedGroups.length === 1;

  return (
    <>
    <div
      ref={groupRef}
      id={`group-${group.id}`}
      data-selectable={group.id}
      style={{
        transform: `translate(${groupCoords.x}px, ${groupCoords.y}px)`,
        touchAction: 'none',
        width: GROUP_WIDTH,
        position: 'absolute',
        top: 0,
        left: 0,
      }}
      className={cn(
        'flex flex-col rounded-xl border select-none',
        'bg-[var(--gray-1)] pt-3 pb-2',
        'transition-[border-color,box-shadow]',
        'hover:shadow-md',
        isFocused || isConnecting
          ? 'border-2 border-[#f76808]'
          : 'border border-[var(--gray-5)]',
        isMouseDown ? 'cursor-grabbing shadow-lg z-10' : 'cursor-grab',
        isDraggingGraph ? 'pointer-events-none' : 'pointer-events-auto',
      )}
      onMouseEnter={() => {
        if (isReadOnly || !groupRef.current) return;
        if (mouseOverGroup?.id !== group.id)
          setMouseOverGroup({ id: group.id, ref: groupRef });
        if (connectingIds)
          setConnectingIds({ ...connectingIds, target: { groupId: group.id } });
      }}
      onMouseLeave={() => {
        if (isReadOnly) return;
        setMouseOverGroup(undefined);
        if (connectingIds) setConnectingIds({ ...connectingIds, target: undefined });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        focusElement(group.id);
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* ── Title bar ───────────────────────────────────────── */}
      <div className="px-4 pb-2 flex items-center gap-2 min-h-[28px]">
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              onGroupUpdate?.(group.id, { title });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                setEditingTitle(false);
                onGroupUpdate?.(group.id, { title });
              }
            }}
            className="prevent-group-drag flex-1 text-[13px] font-semibold bg-transparent border-b border-[#f76808] outline-none text-[var(--gray-12)]"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-[13px] font-semibold truncate text-[var(--gray-12)]"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTitle(true);
            }}
          >
            {title || (
              <span className="text-[var(--gray-8)] italic text-[12px]">Untitled</span>
            )}
          </span>
        )}
      </div>

      {/* ── Block list ──────────────────────────────────────── */}
      <BlockNodesList
        blocks={group.blocks}
        group={group}
        groupIndex={groupIndex}
        groupRef={groupRef}
        edges={edges}
        onBlocksChange={(blocks) => onGroupBlocksChange?.(group.id, blocks)}
      />

      {/* ── Target endpoint (incoming connection dot, left side) ──
           Do NOT stopPropagation here — the event must bubble to Graph.tsx's
           handleMouseUp so the edge is created. We just ensure the target is
           set in case onMouseEnter hasn't fired yet. */}
      <div
        className="prevent-group-drag absolute left-[-13px] top-5 flex h-[22px] w-[22px] items-center justify-center cursor-crosshair"
        onMouseEnter={() => {
          if (connectingIds && !connectingIds.target?.groupId)
            setConnectingIds({ ...connectingIds, target: { groupId: group.id } });
        }}
        onMouseUp={() => {
          // Ensure target is set synchronously right before mouseup bubbles to canvas
          if (connectingIds)
            setConnectingIds({ ...connectingIds, target: { groupId: group.id } });
        }}
      >
        <div
          className={cn(
            'h-3 w-3 rounded-full border-2 bg-[var(--gray-1)] transition-colors',
            isConnecting
              ? 'border-[#f76808] bg-[#f76808]'
              : 'border-[var(--gray-7)] hover:border-[#f76808]',
          )}
        />
      </div>

      {/* ── Focus toolbar (shows above group when single focused) ── */}
      {isSingleFocus && (
        <GroupFocusToolbar
          groupId={group.id}
          isSingleFocus={isSingleFocus}
          onPlayClick={onPlayClick}
          className="absolute top-[-44px] right-0"
        />
      )}
    </div>

    {/* ── Right-click context menu (screen-coord positioned) ── */}
    {contextMenuPos && (
      <GroupNodeContextMenu
        groupId={group.id}
        position={contextMenuPos}
        onClose={() => setContextMenuPos(null)}
        flow={flow}
        onFlowChange={onFlowChange}
        onEditTitle={() => setEditingTitle(true)}
      />
    )}
    </>
  );
}
