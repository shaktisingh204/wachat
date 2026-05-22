import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import {
  applyNodeChanges,
  applyEdgeChanges,
  Node as XYNode,
  Edge as XYEdge,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';

/**
 * A basic Yjs integration hook that syncs React Flow `nodes` and `edges`
 * for collaborative editing.
 * 
 * Uses Y.Map for nodes and edges to efficiently apply updates and broadcast
 * them to other clients.
 */
export function useYjsCanvasSync(yDoc: Y.Doc | null) {
  const [nodes, setNodes] = useState<XYNode[]>([]);
  const [edges, setEdges] = useState<XYEdge[]>([]);

  useEffect(() => {
    if (!yDoc) return;

    const yNodes = yDoc.getMap<XYNode>('canvas-nodes');
    const yEdges = yDoc.getMap<XYEdge>('canvas-edges');

    // Initial load
    setNodes(Array.from(yNodes.values()));
    setEdges(Array.from(yEdges.values()));

    // Observer for Nodes
    const observerNodes = () => {
      setNodes(Array.from(yNodes.values()));
    };
    yNodes.observe(observerNodes);

    // Observer for Edges
    const observerEdges = () => {
      setEdges(Array.from(yEdges.values()));
    };
    yEdges.observe(observerEdges);

    return () => {
      yNodes.unobserve(observerNodes);
      yEdges.unobserve(observerEdges);
    };
  }, [yDoc]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!yDoc) return;
      const yNodes = yDoc.getMap<XYNode>('canvas-nodes');
      const currentNodes = Array.from(yNodes.values());
      const nextNodes = applyNodeChanges(changes, currentNodes);
      
      yDoc.transact(() => {
        nextNodes.forEach((node) => {
          yNodes.set(node.id, node);
        });
        const nextIds = new Set(nextNodes.map((n) => n.id));
        currentNodes.forEach((n) => {
          if (!nextIds.has(n.id)) {
            yNodes.delete(n.id);
          }
        });
      });
    },
    [yDoc]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!yDoc) return;
      const yEdges = yDoc.getMap<XYEdge>('canvas-edges');
      const currentEdges = Array.from(yEdges.values());
      const nextEdges = applyEdgeChanges(changes, currentEdges);

      yDoc.transact(() => {
        nextEdges.forEach((edge) => {
          yEdges.set(edge.id, edge);
        });
        const nextIds = new Set(nextEdges.map((e) => e.id));
        currentEdges.forEach((e) => {
          if (!nextIds.has(e.id)) {
            yEdges.delete(e.id);
          }
        });
      });
    },
    [yDoc]
  );

  return { nodes, edges, onNodesChange, onEdgesChange };
}
