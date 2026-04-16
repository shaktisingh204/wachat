'use client';
import {
  createContext, useContext, useState, useCallback, useEffect, useRef,
  type Dispatch, type ReactNode, type SetStateAction, type RefObject,
} from 'react';
import type { BlockType, Block, BlockItem, Coordinates } from '@/lib/sabflow/types';

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
    <GraphDndContext.Provider value={{
      draggedBlockType, setDraggedBlockType,
      draggedBlock, setDraggedBlock,
      draggedItem, setDraggedItem,
      mouseOverGroup, setMouseOverGroup,
      mouseOverBlock, setMouseOverBlock,
    }}>
      {children}
    </GraphDndContext.Provider>
  );
};

export const useBlockDnd = () => useContext(GraphDndContext);

/* ── useDragDistance hook (Typebot's pattern) ─────────── */
export const useDragDistance = ({
  ref,
  onDrag,
  distanceTolerance = 20,
  isDisabled = false,
}: {
  ref: RefObject<HTMLElement | null>;
  onDrag: (pos: { absolute: Coordinates; relative: Coordinates }) => void;
  distanceTolerance?: number;
  isDisabled?: boolean;
}) => {
  const mouseDownPos = useRef<{ absolute: Coordinates; relative: Coordinates }>();

  const onGlobalMouseUp = useCallback(() => {
    mouseDownPos.current = undefined;
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => window.removeEventListener('mouseup', onGlobalMouseUp);
  }, [onGlobalMouseUp]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMouseDown = (e: MouseEvent) => {
      if (isDisabled) return;
      e.stopPropagation();
      const { top, left } = el.getBoundingClientRect();
      mouseDownPos.current = {
        absolute: { x: e.clientX, y: e.clientY },
        relative: { x: e.clientX - left, y: e.clientY - top },
      };
    };
    el.addEventListener('mousedown', onMouseDown);
    return () => el.removeEventListener('mousedown', onMouseDown);
  }, [ref, isDisabled]);

  useEffect(() => {
    let triggered = false;
    const onMove = (e: MouseEvent) => {
      if (!mouseDownPos.current || triggered) return;
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
