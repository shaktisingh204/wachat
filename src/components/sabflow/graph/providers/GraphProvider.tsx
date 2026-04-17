'use client';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { ConnectingIds, Edge, GraphPosition, NodePort } from '@/lib/sabflow/types';

/** Absolute screen position of the canvas origin.
 *  canvasPosition.x = canvasRect.left + transformX
 *  canvasPosition.y = canvasRect.top  + transformY
 *  Used in the endpoint Y formula:
 *    (ref.getBoundingClientRect().y + endpointH/2 - canvasPosition.y) / canvasPosition.scale
 */
export type CanvasPosition = { x: number; y: number; scale: number };

type PreviewingBlock = { id: string; groupId: string };

/** Info about the handle being dragged during a connection attempt. */
export type ConnectingHandle = {
  nodeId: string;
  handleId: string;
  port: NodePort;
};

interface GraphContextValue {
  /** Raw transform values applied to the canvas div's CSS transform. */
  graphPosition: GraphPosition;
  setGraphPosition: Dispatch<SetStateAction<GraphPosition>>;
  /** Absolute screen coords of the canvas origin (Typebot pattern). */
  canvasPosition: CanvasPosition;
  setCanvasPosition: Dispatch<SetStateAction<CanvasPosition>>;
  connectingIds: ConnectingIds | null;
  /** Ref always holding the latest connectingIds — safe to read in window-level
   *  event handlers and React callbacks without worrying about stale closures. */
  connectingIdsRef: React.MutableRefObject<ConnectingIds | null>;
  setConnectingIds: Dispatch<SetStateAction<ConnectingIds | null>>;
  previewingEdge?: Edge;
  setPreviewingEdge: Dispatch<SetStateAction<Edge | undefined>>;
  previewingBlock?: PreviewingBlock;
  setPreviewingBlock: Dispatch<SetStateAction<PreviewingBlock | undefined>>;
  openedNodeId?: string;
  setOpenedNodeId: Dispatch<SetStateAction<string | undefined>>;
  /** Handle currently being dragged for a new connection. */
  connectingHandle: ConnectingHandle | null;
  setConnectingHandle: Dispatch<SetStateAction<ConnectingHandle | null>>;
  isReadOnly: boolean;
}

const defaultPos: GraphPosition = { x: 0, y: 0, scale: 1 };

const noop = () => {};
const GraphContext = createContext<GraphContextValue>({
  graphPosition: defaultPos,
  setGraphPosition: noop,
  canvasPosition: defaultPos,
  setCanvasPosition: noop,
  connectingIds: null,
  connectingIdsRef: { current: null },
  setConnectingIds: noop,
  setPreviewingEdge: noop,
  setPreviewingBlock: noop,
  setOpenedNodeId: noop,
  connectingHandle: null,
  setConnectingHandle: noop,
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

  // connectingIdsRef is always in sync with connectingIds state.
  // It updates synchronously on every setConnectingIds call, so window-level
  // event handlers and useCallback closures always read the freshest value.
  const connectingIdsRef = useRef<ConnectingIds | null>(null);
  const [connectingIds, setConnectingIdsState] = useState<ConnectingIds | null>(null);
  const setConnectingIds = useCallback<Dispatch<SetStateAction<ConnectingIds | null>>>((val) => {
    setConnectingIdsState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      connectingIdsRef.current = next;
      return next;
    });
  }, []);

  const [previewingEdge, setPreviewingEdge] = useState<Edge | undefined>();
  const [previewingBlock, setPreviewingBlock] = useState<PreviewingBlock | undefined>();
  const [openedNodeId, setOpenedNodeId] = useState<string | undefined>();
  const [connectingHandle, setConnectingHandle] = useState<ConnectingHandle | null>(null);

  return (
    <GraphContext.Provider
      value={{
        graphPosition,
        setGraphPosition,
        canvasPosition,
        setCanvasPosition,
        connectingIds,
        connectingIdsRef,
        setConnectingIds,
        previewingEdge,
        setPreviewingEdge,
        previewingBlock,
        setPreviewingBlock,
        openedNodeId,
        setOpenedNodeId,
        connectingHandle,
        setConnectingHandle,
        isReadOnly,
      }}
    >
      {children}
    </GraphContext.Provider>
  );
};

export const useGraph = () => useContext(GraphContext);
