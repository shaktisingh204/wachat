'use client';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

/* ── Types ──────────────────────────────────────────────── */

export type ConnectingFrom = {
  nodeId: string;
  outputIndex: number;
};

/** Canvas-space coordinates of the mouse cursor. */
export type MousePosition = {
  x: number;
  y: number;
};

interface ConnectionsContextValue {
  /** Non-null while the user is dragging a new connection from an output port. */
  connectingFrom: ConnectingFrom | null;
  setConnectingFrom: Dispatch<SetStateAction<ConnectingFrom | null>>;
  /** Last-known mouse position in canvas space (set by DrawingEdge). */
  mousePosition: MousePosition;
  setMousePosition: Dispatch<SetStateAction<MousePosition>>;
  /** Whether a connection drag is currently in progress. */
  isConnecting: boolean;
  /** Cancel the active drag without creating a connection. */
  cancelConnection: () => void;
}

/* ── Context ─────────────────────────────────────────────── */

const ConnectionsContext = createContext<ConnectionsContextValue>({
  connectingFrom: null,
  setConnectingFrom: () => {},
  mousePosition: { x: 0, y: 0 },
  setMousePosition: () => {},
  isConnecting: false,
  cancelConnection: () => {},
});

/* ── Provider ────────────────────────────────────────────── */

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const [connectingFrom, setConnectingFrom] = useState<ConnectingFrom | null>(null);
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });

  const cancelConnection = useCallback(() => setConnectingFrom(null), []);

  return (
    <ConnectionsContext.Provider
      value={{
        connectingFrom,
        setConnectingFrom,
        mousePosition,
        setMousePosition,
        isConnecting: connectingFrom !== null,
        cancelConnection,
      }}
    >
      {children}
    </ConnectionsContext.Provider>
  );
}

/* ── Hook ────────────────────────────────────────────────── */

export function useConnections() {
  return useContext(ConnectionsContext);
}
