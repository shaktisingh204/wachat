'use client';
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type {
  N8NGraphPosition,
  N8NDraftConnection,
  N8NNode,
} from './types';

interface WorkflowContextValue {
  /** Canvas pan + zoom transform. */
  graphPosition: N8NGraphPosition;
  setGraphPosition: Dispatch<SetStateAction<N8NGraphPosition>>;
  /** The connection currently being drawn (null when idle). */
  draftConnection: N8NDraftConnection | null;
  setDraftConnection: Dispatch<SetStateAction<N8NDraftConnection | null>>;
  /** ID of the node whose properties panel is open. */
  selectedNodeId: string | null;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  /** Type being dragged from the palette (null when not dragging). */
  draggedNodeType: N8NNode['type'] | null;
  setDraggedNodeType: Dispatch<SetStateAction<N8NNode['type'] | null>>;
}

const defaultPos: N8NGraphPosition = { x: 0, y: 0, scale: 1 };

const WorkflowContext = createContext<WorkflowContextValue>({
  graphPosition: defaultPos,
  setGraphPosition: () => {},
  draftConnection: null,
  setDraftConnection: () => {},
  selectedNodeId: null,
  setSelectedNodeId: () => {},
  draggedNodeType: null,
  setDraggedNodeType: () => {},
});

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [graphPosition, setGraphPosition] = useState<N8NGraphPosition>(defaultPos);
  const [draftConnection, setDraftConnection] = useState<N8NDraftConnection | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedNodeType, setDraggedNodeType] = useState<N8NNode['type'] | null>(null);

  return (
    <WorkflowContext.Provider
      value={{
        graphPosition,
        setGraphPosition,
        draftConnection,
        setDraftConnection,
        selectedNodeId,
        setSelectedNodeId,
        draggedNodeType,
        setDraggedNodeType,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export const useWorkflow = () => useContext(WorkflowContext);
