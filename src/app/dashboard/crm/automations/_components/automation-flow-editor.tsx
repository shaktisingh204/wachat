'use client';
import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge, Button } from '@/components/sabcrm/20ui/compat';
import { Loader2 } from 'lucide-react';

const CustomNode = ({ data, id }: NodeProps) => {
  return (
    <div className={`p-3 rounded-md border bg-white shadow-sm min-w-[150px] ${data.error ? 'border-[var(--st-border)]' : data.success ? 'border-[var(--st-border)]' : 'border-[var(--st-border)]'}`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-[var(--st-text)]">{data.typeLabel || 'Node'}</span>
        <span className="text-sm font-semibold">{data.label}</span>
        {data.error && <span className="text-xs text-[var(--st-text)] mt-1">{data.error}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export function AutomationFlowEditor({ nodes, edges, setNodes, setEdges, testingWebhook, onTestWebhook }: any) {
  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds: any) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds: any) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect = useCallback(
    (params: any) => setEdges((eds: any) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="h-[500px] w-full border rounded-md bg-[var(--st-bg-muted)] relative overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
      
      <div className="absolute top-2 right-2 flex gap-2">
         {onTestWebhook && (
           <Button size="sm" variant="secondary" onClick={onTestWebhook} disabled={testingWebhook}>
             {testingWebhook ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
             Test Webhook
           </Button>
         )}
      </div>
    </div>
  );
}
