'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Block, BlockItem, BlockType, Coordinates } from '@/lib/sabflow/types';

type NodeElement = { id: string; ref: RefObject<HTMLElement | null> };
type DraggedBlock = Block & { groupId: string };
type DraggedItem = BlockItem & { type: BlockType; blockId: string };

interface GraphDndContextValue {
  draggedBlockType?: BlockType;
  setDraggedBlockType: Dispatch<SetStateAction<BlockType | undefined>>;
  draggedBlock?: DraggedBlock;
  setDraggedBlock: Dispatch<SetStateAction<DraggedBlock | undefined>>;
  draggedItem?: DraggedItem;
  setDraggedItem: Dispatch<SetStateAction<DraggedItem | undefined>>;
  mouseOverGroup?: NodeElement;
  setMouseOverGroup: (node: NodeElement | undefined) => void;
  mouseOverBlock?: NodeElement;
  setMouseOverBlock: (node: NodeElement | undefined) => void;
}

const GraphDndContext = createContext<GraphDndContextValue>({
  setDraggedBlockType: () => {},
  setDraggedBlock: () => {},
  setDraggedItem: () => {},
  setMouseOverGroup: () => {},
  setMouseOverBlock: () => {},
});

export const GraphDndProvider = ({ children }: { children: ReactNode }) => {
  const [draggedBlockType, setDraggedBlockType] = useState<BlockType | undefined>();
  const [draggedBlock, setDraggedBlock] = useState<DraggedBlock | undefined>();
  const [draggedItem, setDraggedItem] = useState<DraggedItem | undefined>();
  const [mouseOverGroup, setMouseOverGroup] = useState<NodeElement | undefined>();
  const [mouseOverBlock, setMouseOverBlock] = useState<NodeElement | undefined>();

  return (
    <GraphDndContext.Provider
      value={{
        draggedBlockType,
        setDraggedBlockType,
        draggedBlock,
        setDraggedBlock,
        draggedItem,
        setDraggedItem,
        mouseOverGroup,
        setMouseOverGroup,
        mouseOverBlock,
        setMouseOverBlock,
      }}
    >
      {children}
    </GraphDndContext.Provider>
  );
};

export const useBlockDnd = () => useContext(GraphDndContext);

/* ── useDragDistance ──────────────────────────────────────
 * Attaches a native mousedown listener to `ref`. When the
 * pointer moves more than `distanceTolerance` pixels after
 * mousedown, `onDrag` fires once with absolute + relative
 * coords. Matches Typebot's implementation exactly.
 * ─────────────────────────────────────────────────────── */
export const useDragDistance = ({
  ref,
  onDrag,
  distanceTolerance = 20,
  isDisabled = false,
  deps = [],
}: {
  ref: RefObject<HTMLElement | null>;
  onDrag: (pos: { absolute: Coordinates; relative: Coordinates }) => void;
  distanceTolerance?: number;
  isDisabled?: boolean;
  /** Extra deps that should re-register the mousedown listener. */
  deps?: unknown[];
}) => {
  const mouseDownPos = useRef<{ absolute: Coordinates; relative: Coordinates }>(
    undefined,
  );

  const onGlobalMouseUp = useCallback(() => {
    mouseDownPos.current = undefined;
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => window.removeEventListener('mouseup', onGlobalMouseUp);
  }, [onGlobalMouseUp]);

  // Re-registers whenever isDisabled or any caller-supplied dep changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (isDisabled || !ref.current) return;
      e.stopPropagation();
      const { top, left } = ref.current.getBoundingClientRect();
      mouseDownPos.current = {
        absolute: { x: e.clientX, y: e.clientY },
        relative: { x: e.clientX - left, y: e.clientY - top },
      };
    };
    ref.current?.addEventListener('mousedown', onMouseDown);
    return () => {
      ref.current?.removeEventListener('mousedown', onMouseDown);
    };
    // deps spread is intentional — matches Typebot: [isDisabled, ...deps]
  }, [isDisabled, ...deps]);

  useEffect(() => {
    let triggered = false;
    const onMove = (e: MouseEvent) => {
      if (!mouseDownPos.current || triggered) return;

      // Ignore drag events originating from interactive form elements.
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable=true]')
      )
        return;

      const { clientX, clientY } = e;
      if (
        Math.abs(mouseDownPos.current.absolute.x - clientX) > distanceTolerance ||
        Math.abs(mouseDownPos.current.absolute.y - clientY) > distanceTolerance
      ) {
        triggered = true;
        onDrag(mouseDownPos.current);
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [distanceTolerance, onDrag]);
};

/* ── computeNearestPlaceholderIndex ───────────────────────
 * Given a mouse Y position (screen space) and an array of
 * placeholder divs, returns the index of the closest one.
 * ─────────────────────────────────────────────────────── */
export const computeNearestPlaceholderIndex = (
  offsetY: number,
  placeholderRefs: React.MutableRefObject<HTMLDivElement[]>,
) => {
  const { closestIndex } = placeholderRefs.current.reduce(
    (prev, elem, index) => {
      const elementTop = elem.getBoundingClientRect().top;
      const dist = Math.abs(offsetY - elementTop);
      return dist < prev.value ? { closestIndex: index, value: dist } : prev;
    },
    { closestIndex: 0, value: 999_999_999 },
  );
  return closestIndex;
};
