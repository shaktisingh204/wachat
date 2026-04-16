'use client';
import {
  createContext, useContext, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from 'react';
import type { GraphPosition, ConnectingIds, Edge } from '@/lib/sabflow/types';

const defaultPos: GraphPosition = { x: 0, y: 0, scale: 1 };

type PreviewingBlock = { id: string; groupId: string };

/** Absolute screen position of the canvas origin (top-left of canvas + transform).
 *  Used by endpoints to compute canvas-space Y coordinates from screen-space Y. */
export type CanvasPosition = { x: number; y: number; scale: number };

interface GraphContextValue {
  /** Transform values used directly on the canvas div's `transform` CSS property. */
  graphPosition: GraphPosition;
  setGraphPosition: Dispatch<SetStateAction<GraphPosition>>;
  /** Absolute screen-space position of the canvas origin: canvasRect.{left|top} + transform.{x|y}. */
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
    <GraphContext.Provider value={{
      graphPosition, setGraphPosition,
      canvasPosition, setCanvasPosition,
      connectingIds, setConnectingIds,
      previewingEdge, setPreviewingEdge,
      previewingBlock, setPreviewingBlock,
      openedNodeId, setOpenedNodeId,
      isReadOnly,
    }}>
      {children}
    </GraphContext.Provider>
  );
};

export const useGraph = () => useContext(GraphContext);
