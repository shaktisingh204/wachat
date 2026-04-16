'use client';
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { ConnectingIds, Edge, GraphPosition } from '@/lib/sabflow/types';

/** Absolute screen position of the canvas origin.
 *  canvasPosition.x = canvasRect.left + transformX
 *  canvasPosition.y = canvasRect.top  + transformY
 *  Used in the endpoint Y formula:
 *    (ref.getBoundingClientRect().y + endpointH/2 - canvasPosition.y) / canvasPosition.scale
 */
export type CanvasPosition = { x: number; y: number; scale: number };

type PreviewingBlock = { id: string; groupId: string };

interface GraphContextValue {
  /** Raw transform values applied to the canvas div's CSS transform. */
  graphPosition: GraphPosition;
  setGraphPosition: Dispatch<SetStateAction<GraphPosition>>;
  /** Absolute screen coords of the canvas origin (Typebot pattern). */
  canvasPosition: CanvasPosition;
  setCanvasPosition: Dispatch<SetStateAction<CanvasPosition>>;
  connectingIds: ConnectingIds | null;
  setConnectingIds: Dispatch<SetStateAction<ConnectingIds | null>>;
  previewingEdge?: Edge;
  setPreviewingEdge: Dispatch<SetStateAction<Edge | undefined>>;
  previewingBlock?: PreviewingBlock;
  setPreviewingBlock: Dispatch<SetStateAction<PreviewingBlock | undefined>>;
  openedNodeId?: string;
  setOpenedNodeId: Dispatch<SetStateAction<string | undefined>>;
  isReadOnly: boolean;
}

const defaultPos: GraphPosition = { x: 0, y: 0, scale: 1 };

const GraphContext = createContext<GraphContextValue>({
  graphPosition: defaultPos,
  setGraphPosition: () => {},
  canvasPosition: defaultPos,
  setCanvasPosition: () => {},
  connectingIds: null,
  setConnectingIds: () => {},
  setPreviewingEdge: () => {},
  setPreviewingBlock: () => {},
  setOpenedNodeId: () => {},
  isReadOnly: false,
});

export const GraphProvider = ({
  children,
  isReadOnly = false,
}: {
  children: ReactNode;
  isReadOnly?: boolean;
}) => {
  const [graphPosition, setGraphPosition] = useState<GraphPosition>(defaultPos);
  const [canvasPosition, setCanvasPosition] = useState<CanvasPosition>(defaultPos);
  const [connectingIds, setConnectingIds] = useState<ConnectingIds | null>(null);
  const [previewingEdge, setPreviewingEdge] = useState<Edge | undefined>();
  const [previewingBlock, setPreviewingBlock] = useState<PreviewingBlock | undefined>();
  const [openedNodeId, setOpenedNodeId] = useState<string | undefined>();

  return (
    <GraphContext.Provider
      value={{
        graphPosition,
        setGraphPosition,
        canvasPosition,
        setCanvasPosition,
        connectingIds,
        setConnectingIds,
        previewingEdge,
        setPreviewingEdge,
        previewingBlock,
        setPreviewingBlock,
        openedNodeId,
        setOpenedNodeId,
        isReadOnly,
      }}
    >
      {children}
    </GraphContext.Provider>
  );
};

export const useGraph = () => useContext(GraphContext);
