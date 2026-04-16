'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import { LuKeyboard } from 'react-icons/lu';
import { useGraph } from '../providers/GraphProvider';
import { useSelectionStore } from '../hooks/useSelectionStore';
import { useBlockDnd } from '../providers/GraphDndProvider';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { createId } from '@paralleldrive/cuid2';
import GraphElements from './GraphElements';
import { ElementsSelectionMenu } from './ElementsSelectionMenu';
import { SelectBox } from './SelectBox';
import { ZoomButtons } from './ZoomButtons';
import { CanvasMiniMap } from './CanvasMiniMap';
import { ShortcutsHelp } from './ShortcutsHelp';
import { AnalyticsProvider } from '../providers/AnalyticsProvider';
import { AnalyticsToggle } from './AnalyticsToggle';
import { computeSelectBoxDimensions } from '../helpers/computeSelectBoxDimensions';
import { isSelectBoxIntersectingWithElement } from '../helpers/isSelectBoxIntersectingWithElement';
import type { SabFlowDoc, SabFlowEvent, Group, Coordinates } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';

const maxScale = 2;
const minScale = 0.2;
const zoomStep = 0.2;

type SelectBoxCoordinates = {
  origin: Coordinates;
  dimension: { width: number; height: number };
};

type Props = {
  flow: SabFlowDoc;
  onFlowChange: (changes: Partial<Pick<SabFlowDoc, 'groups' | 'edges' | 'events'>>) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Optional undo callback — wired to Ctrl/Cmd+Z on the canvas. */
  onUndo?: () => void;
  /** Optional redo callback — wired to Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y. */
  onRedo?: () => void;
};

export function Graph({ flow, onFlowChange, containerRef, onUndo, onRedo }: Props) {
  const { graphPosition, setGraphPosition, setCanvasPosition, connectingIds, connectingIdsRef, setConnectingIds, isReadOnly } =
    useGraph();
  const { draggedBlockType, setDraggedBlockType } = useBlockDnd();

  const isDraggingGraph = useSelectionStore((s) => s.isDraggingGraph);
  const setIsDraggingGraph = useSelectionStore((s) => s.setIsDraggingGraph);
  const blurElements = useSelectionStore((s) => s.blurElements);
  const focusedElementsId = useSelectionStore((s) => s.focusedElementsId);
  const { setElementsCoordinates, updateElementCoordinates, setFocusedElements } = useSelectionStore(
    useShallow((s) => ({
      setElementsCoordinates: s.setElementsCoordinates,
      updateElementCoordinates: s.updateElementCoordinates,
      setFocusedElements: s.setFocusedElements,
    })),
  );

  const canvasRef = useRef<HTMLDivElement>(null);

  // Space-bar pan mode
  const [isSpacePanMode, setIsSpacePanMode] = useState(false);
  const [isSpaceDragging, setIsSpaceDragging] = useState(false);

  // Minimap visibility
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);

  // Shortcuts help panel
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  // Analytics heatmap sub-toggle — lives here so HeatmapOverlay can read it.
  const [isHeatmapEnabled, setIsHeatmapEnabled] = useState(false);

  // Rubber-band selection
  const [selectBoxCoordinates, setSelectBoxCoordinates] = useState<SelectBoxCoordinates | undefined>(undefined);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useKeyboardShortcuts({
    flow,
    onFlowChange,
    graphPosition,
    setGraphPosition,
    canvasRef,
    undo: onUndo,
    redo: onRedo,
    onEscape: () => setIsShortcutsHelpOpen(false),
  });

  // Seed all group and event coordinates once on mount (Typebot pattern)
  useEffect(() => {
    const coords: Record<string, Coordinates> = {};
    flow.groups.forEach((g) => {
      coords[g.id] = g.graphCoordinates;
    });
    flow.events.forEach((ev) => {
      coords[ev.id] = ev.graphCoordinates;
    });
    setElementsCoordinates(coords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update absolute canvas position for endpoint Y calculations
  useEffect(() => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCanvasPosition({
      x: rect.left + graphPosition.x,
      y: rect.top + graphPosition.y,
      scale: graphPosition.scale,
    });
  }, [graphPosition, setCanvasPosition]);

  // Space-bar pan mode — keydown/keyup + '?' shortcut to open shortcuts help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isEditable =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      // '?' → open shortcuts help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !isEditable) {
        e.preventDefault();
        setIsShortcutsHelpOpen((v) => !v);
        return;
      }

      if (
        e.key === ' ' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !isEditable
      ) {
        e.preventDefault();
        setIsSpacePanMode(true);
        setIsDraggingGraph(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpacePanMode(false);
        setIsSpaceDragging(false);
        setIsDraggingGraph(false);
      }
    };
    const handleWindowBlur = () => {
      setIsSpacePanMode(false);
      setIsSpaceDragging(false);
      setIsDraggingGraph(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [setIsDraggingGraph]);

  // Rubber-band selection — native mouse events on the canvas element
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let selectOrigin: Coordinates | null = null;
    let cachedRects: { elementId: string; rect: DOMRect }[] = [];
    let isSelectDragging = false;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Only fire when clicking directly on the canvas background
      if (e.target !== canvas) return;
      selectOrigin = { x: e.clientX, y: e.clientY };
      isSelectDragging = false;
      cachedRects = Array.from(document.querySelectorAll('[data-selectable]')).map((el) => ({
        elementId: (el as HTMLDivElement).dataset.selectable!,
        rect: el.getBoundingClientRect(),
      }));
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!selectOrigin) return;
      const dx = e.clientX - selectOrigin.x;
      const dy = e.clientY - selectOrigin.y;
      // Only show selectbox after 5px to avoid accidental selection on click
      if (!isSelectDragging && Math.abs(dx) + Math.abs(dy) < 5) return;
      isSelectDragging = true;

      const coords = computeSelectBoxDimensions({
        initial: [selectOrigin.x, selectOrigin.y],
        movement: [dx, dy],
      });
      setSelectBoxCoordinates(coords);

      // Update selection live as the user drags
      const selectedIds = cachedRects.reduce<string[]>((acc, el) => {
        if (isSelectBoxIntersectingWithElement(coords, el.rect)) acc.push(el.elementId);
        return acc;
      }, []);
      if (selectedIds.length > 0) setFocusedElements(selectedIds);
    };

    const onMouseUp = () => {
      selectOrigin = null;
      isSelectDragging = false;
      setSelectBoxCoordinates(undefined);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setFocusedElements]);

  // Project screen coords → canvas coords
  const projectMouse = useCallback(
    (clientX: number, clientY: number): Coordinates => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: (clientX - rect.left - graphPosition.x) / graphPosition.scale,
        y: (clientY - rect.top - graphPosition.y) / graphPosition.scale,
      };
    },
    [graphPosition],
  );

  // Handle group position/title updates
  const handleGroupUpdate = useCallback(
    (id: string, changes: Partial<Group>) => {
      onFlowChange({
        groups: flow.groups.map((g) => (g.id === id ? { ...g, ...changes } : g)),
      });
    },
    [flow.groups, onFlowChange],
  );

  // Handle block reordering within a group
  const handleGroupBlocksChange = useCallback(
    (groupId: string, blocks: Group['blocks']) => {
      onFlowChange({
        groups: flow.groups.map((g) => (g.id === groupId ? { ...g, blocks } : g)),
      });
    },
    [flow.groups, onFlowChange],
  );

  // Handle event position updates
  const handleEventUpdate = useCallback(
    (id: string, changes: Partial<SabFlowEvent>) => {
      onFlowChange({
        events: flow.events.map((ev) => (ev.id === id ? { ...ev, ...changes } : ev)),
      });
    },
    [flow.events, onFlowChange],
  );

  // Handle edge deletion
  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      onFlowChange({ edges: flow.edges.filter((e) => e.id !== edgeId) });
    },
    [flow.edges, onFlowChange],
  );

  // Handle edge creation from DrawingEdge mouseup, or drop new block from sidebar.
  // Uses connectingIdsRef.current (always fresh) instead of the closure value to
  // avoid the stale-state race condition when onMouseEnter fires just before mouseup.
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const current = connectingIdsRef.current;
      if (current?.target?.groupId) {
        // Build the "from" side — could be event-sourced or block/group-sourced
        const fromSource = current.source.eventId
          ? { eventId: current.source.eventId }
          : current.source.blockId
            ? { groupId: current.source.groupId!, blockId: current.source.blockId }
            : { groupId: current.source.groupId! };

        const newEdge = {
          id: createId(),
          from: fromSource,
          to: current.target.blockId
            ? { groupId: current.target.groupId, blockId: current.target.blockId }
            : { groupId: current.target.groupId },
        };

        // Replace existing edge from the same source (only for block sources)
        const existingIdx = current.source.eventId
          ? flow.edges.findIndex(
              (ed) => 'eventId' in ed.from && ed.from.eventId === current.source.eventId,
            )
          : current.source.blockId
            ? flow.edges.findIndex((ed) => ed.from.blockId === current.source.blockId)
            : -1;

        const newEdges =
          existingIdx >= 0
            ? flow.edges.map((ed, i) => (i === existingIdx ? newEdge : ed))
            : [...flow.edges, newEdge];
        onFlowChange({ edges: newEdges });
        setConnectingIds(null);
        return;
      }

      if (draggedBlockType) {
        const pos = projectMouse(e.clientX, e.clientY);
        const newGroupId = createId();
        const newBlockId = createId();
        const coords = { x: pos.x - 150, y: pos.y - 30 };
        const newGroup: Group = {
          id: newGroupId,
          title: 'Group',
          graphCoordinates: coords,
          blocks: [
            {
              id: newBlockId,
              type: draggedBlockType,
              groupId: newGroupId,
              options: {},
            },
          ],
        };
        updateElementCoordinates(newGroupId, coords);
        onFlowChange({ groups: [...flow.groups, newGroup] });
        setDraggedBlockType(undefined);
      }
    },
    [
      // connectingIds intentionally omitted — we use connectingIdsRef.current for fresh reads
      draggedBlockType,
      projectMouse,
      flow.groups,
      flow.edges,
      onFlowChange,
      setDraggedBlockType,
      updateElementCoordinates,
      setConnectingIds,
    ],
  );


  // Canvas pan + zoom gestures
  useGesture(
    {
      onDrag: ({ delta: [dx, dy], first, last }) => {
        // Space-bar pan mode: track drag state for grab/grabbing cursor
        if (isSpacePanMode) {
          if (first) setIsSpaceDragging(true);
          if (last) setIsSpaceDragging(false);
          setGraphPosition((pos) => ({ ...pos, x: pos.x + dx, y: pos.y + dy }));
          return;
        }
        // Regular pan (isDraggingGraph set externally, e.g. middle-button or future gesture)
        if (isDraggingGraph) {
          if (last) {
            setIsDraggingGraph(false);
            return;
          }
          setGraphPosition((pos) => ({ ...pos, x: pos.x + dx, y: pos.y + dy }));
        }
        // Rubber-band selection is handled via native mouse events in the useEffect above.
      },
      onWheel: ({ delta: [, dy], event }) => {
        event.preventDefault();
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = (event as WheelEvent).clientX - rect.left;
        const mouseY = (event as WheelEvent).clientY - rect.top;
        setGraphPosition((pos) => {
          const zoomFactor = dy > 0 ? 0.9 : 1.1;
          const newScale = Math.min(maxScale, Math.max(minScale, pos.scale * zoomFactor));
          const ratio = newScale / pos.scale;
          return {
            scale: newScale,
            x: pos.x - mouseX * (ratio - 1),
            y: pos.y - mouseY * (ratio - 1),
          };
        });
      },
      onPinch: ({ offset: [scale] }) => {
        setGraphPosition((pos) => ({
          ...pos,
          scale: Math.min(maxScale, Math.max(minScale, scale)),
        }));
      },
    },
    {
      target: canvasRef,
      drag: { pointer: { keys: false } },
      wheel: { eventOptions: { passive: false } },
      pinch: { scaleBounds: { min: minScale, max: maxScale } },
    },
  );

  const cursorClass = draggedBlockType
    ? 'cursor-crosshair'
    : isSpacePanMode
      ? isSpaceDragging
        ? 'cursor-grabbing'
        : 'cursor-grab'
      : isDraggingGraph
        ? 'cursor-grabbing'
        : 'cursor-default';

  const flowIdStr = flow._id ? String(flow._id) : undefined;

  return (
    <AnalyticsProvider flowId={flowIdStr}>
    <div
      ref={canvasRef}
      className={cn('relative flex-1 overflow-hidden', cursorClass)}
      style={{
        touchAction: 'none',
        backgroundColor: 'var(--gray-3)',
        backgroundImage: 'radial-gradient(var(--gray-7) 1px, transparent 0)',
        backgroundSize: '40px 40px',
        backgroundPosition: '-19px -19px',
      }}
      onMouseUp={handleMouseUp}
      onClick={(e) => {
        if (e.target === canvasRef.current) blurElements();
      }}
    >
      {/* Rubber-band selection box (fixed position = screen coords) */}
      {!isReadOnly && selectBoxCoordinates && (
        <SelectBox origin={selectBoxCoordinates.origin} dimension={selectBoxCoordinates.dimension} />
      )}

      {/* Transformed canvas layer */}
      <div
        className="flex flex-1 w-full h-full absolute will-change-transform"
        style={{
          transform: `translate(${graphPosition.x}px, ${graphPosition.y}px) scale(${graphPosition.scale})`,
          transformOrigin: '0 0',
          perspective: 1000,
        }}
      >
        <GraphElements
          flow={flow}
          onGroupUpdate={handleGroupUpdate}
          onGroupBlocksChange={handleGroupBlocksChange}
          onEdgeDelete={handleEdgeDelete}
          onEventUpdate={handleEventUpdate}
          onFlowChange={onFlowChange}
          isHeatmapEnabled={isHeatmapEnabled}
        />
      </div>

      {/* Zoom controls + selection menu */}
      <div className="absolute top-4 right-4 flex items-stretch gap-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] p-1.5 shadow-sm z-10">
        <ElementsSelectionMenu
          graphPosition={graphPosition}
          focusedElementIds={focusedElementsId}
          blurElements={blurElements}
          flow={flow}
          onFlowChange={onFlowChange}
        />
        {focusedElementsId.length > 0 && (
          <div className="w-px bg-[var(--gray-5)] self-stretch" />
        )}
        <ZoomButtons
          graphPosition={graphPosition}
          setGraphPosition={setGraphPosition}
          groups={flow.groups}
          events={flow.events}
          onToggleMiniMap={() => setIsMiniMapOpen((v) => !v)}
          isMiniMapOpen={isMiniMapOpen}
          canvasRef={canvasRef}
        />

        <div className="w-px bg-[var(--gray-5)] self-stretch" />

        {/* Analytics overlay toggle + popover */}
        <AnalyticsToggle
          isHeatmapEnabled={isHeatmapEnabled}
          onHeatmapToggle={setIsHeatmapEnabled}
        />

        <div className="w-px bg-[var(--gray-5)] self-stretch" />

        {/* Keyboard shortcuts reference */}
        <button
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          onClick={() => setIsShortcutsHelpOpen((v) => !v)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded text-[var(--gray-11)] hover:bg-[var(--gray-3)] transition-colors',
            isShortcutsHelpOpen && 'bg-[var(--gray-4)]',
          )}
        >
          <LuKeyboard size={14} />
        </button>
      </div>

      {/* Canvas minimap */}
      {isMiniMapOpen && (
        <CanvasMiniMap
          graphPosition={graphPosition}
          setGraphPosition={setGraphPosition}
          groups={flow.groups}
          events={flow.events}
          canvasRef={canvasRef}
          onClose={() => setIsMiniMapOpen(false)}
        />
      )}

      {/* Keyboard shortcuts help modal */}
      <ShortcutsHelp
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
    </div>
    </AnalyticsProvider>
  );
}
