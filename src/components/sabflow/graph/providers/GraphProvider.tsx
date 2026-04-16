'use client';
import {
  createContext, useContext, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from 'react';
import type { GraphPosition, ConnectingIds, Edge } from '@/lib/sabflow/types';

const defaultPos: GraphPosition = { x: 0, y: 0, scale: 1 };

type PreviewingBlock = { id: string; groupId: string };

interface GraphContextValue {
  graphPosition: GraphPosition;
  setGraphPosition: Dispatch<SetStateAction<GraphPosition>>;
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
  const [connectingIds, setConnectingIds] = useState<ConnectingIds | null>(null);
  const [previewingEdge, setPreviewingEdge] = useState<Edge | undefined>();
  const [previewingBlock, setPreviewingBlock] = useState<PreviewingBlock | undefined>();
  const [openedNodeId, setOpenedNodeId] = useState<string | undefined>();

  return (
    <GraphContext.Provider value={{
      graphPosition, setGraphPosition,
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
