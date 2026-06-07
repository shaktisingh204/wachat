"use client";

import React, { useState, useCallback, DragEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  Connection,
  Edge,
  Node,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Button,
  IconButton,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

import {
  Mail,
  MessageSquare,
  Clock,
  Zap,
  GitBranch,
  Settings2,
  Users,
  Play,
  Save,
  ChevronLeft,
  Trash2,
  X,
} from 'lucide-react';

const TriggerNode = ({ data, isConnectable, selected }: any) => (
  <div className={`rounded-[var(--st-radius)] border ${selected ? 'border-[var(--st-accent)] ring-2 ring-[var(--st-accent)]/20' : 'border-[var(--st-border)]'} bg-[var(--st-bg-secondary)] shadow-xl min-w-[250px] transition-all`}>
    <div className="bg-[var(--st-bg-muted)] p-3 border-b border-[var(--st-border)] flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
        <Zap className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--st-text)]">{data.title}</h3>
        {data.subtitle && <p className="text-xs text-[var(--st-text-secondary)]">{data.subtitle}</p>}
      </div>
    </div>
    {data.description && (
      <div className="p-3">
        <div className="text-xs text-[var(--st-text-secondary)]">{data.description}</div>
      </div>
    )}
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!w-3 !h-3 !bg-[var(--st-bg-secondary)] !border-2 !border-[var(--st-accent)]" />
  </div>
);

const ActionNode = ({ data, isConnectable, selected }: any) => (
  <div className={`rounded-[var(--st-radius)] border ${selected ? 'border-[var(--st-accent)] ring-2 ring-[var(--st-accent)]/20' : 'border-[var(--st-border)]'} bg-[var(--st-bg-secondary)] shadow-xl min-w-[250px] transition-all`}>
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!w-3 !h-3 !bg-[var(--st-bg-secondary)] !border-2 !border-[var(--st-accent)]" />
    <div className="bg-[var(--st-bg-muted)] p-3 border-b border-[var(--st-border)] flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-status-ok)]">
        {data.icon === 'sms' ? <MessageSquare className="h-4 w-4" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--st-text)]">{data.title}</h3>
        {data.subtitle && <p className="text-xs text-[var(--st-text-secondary)]">{data.subtitle}</p>}
      </div>
    </div>
    {data.description && (
      <div className="p-3">
        <div className="text-xs text-[var(--st-text-secondary)]">{data.description}</div>
      </div>
    )}
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!w-3 !h-3 !bg-[var(--st-bg-secondary)] !border-2 !border-[var(--st-accent)]" />
  </div>
);

const LogicNode = ({ data, isConnectable, selected }: any) => (
  <div className={`rounded-[var(--st-radius)] border ${selected ? 'border-[var(--st-accent)] ring-2 ring-[var(--st-accent)]/20' : 'border-[var(--st-border)]'} bg-[var(--st-bg-secondary)] shadow-xl min-w-[200px] transition-all`}>
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!w-3 !h-3 !bg-[var(--st-bg-secondary)] !border-2 !border-[var(--st-accent)]" />
    <div className="bg-[var(--st-bg-muted)] p-3 border-b border-[var(--st-border)] flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
        <Clock className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--st-text)]">{data.title}</h3>
        {data.subtitle && <p className="text-xs text-[var(--st-text-secondary)]">{data.subtitle}</p>}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!w-3 !h-3 !bg-[var(--st-bg-secondary)] !border-2 !border-[var(--st-accent)]" />
  </div>
);

const ConditionNode = ({ data, isConnectable, selected }: any) => (
  <div className={`rounded-[var(--st-radius)] border ${selected ? 'border-[var(--st-accent)] ring-2 ring-[var(--st-accent)]/20' : 'border-[var(--st-border)]'} bg-[var(--st-bg-secondary)] shadow-xl min-w-[200px] transition-all relative mb-6`}>
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!w-3 !h-3 !bg-[var(--st-bg-secondary)] !border-2 !border-[var(--st-accent)]" />
    <div className="bg-[var(--st-bg-muted)] p-3 border-b border-[var(--st-border)] flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-warn)]">
        <GitBranch className="h-4 w-4" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--st-text)]">{data.title}</h3>
      </div>
    </div>
    {data.description && (
      <div className="p-3 text-xs text-[var(--st-text-secondary)]">
        {data.description}
      </div>
    )}
    <Handle type="source" position={Position.Bottom} id="true" style={{ left: '25%' }} isConnectable={isConnectable} className="!w-3 !h-3 !bg-[var(--st-status-ok)] !border-2 !border-[var(--st-bg-secondary)]" />
    <div className="absolute -bottom-6 left-[25%] -translate-x-1/2 text-[10px] font-medium text-[var(--st-status-ok)] bg-[var(--st-bg-secondary)] px-1.5 py-0.5 rounded-[var(--st-radius)] border border-[var(--st-border)]">Yes</div>

    <Handle type="source" position={Position.Bottom} id="false" style={{ left: '75%' }} isConnectable={isConnectable} className="!w-3 !h-3 !bg-[var(--st-danger)] !border-2 !border-[var(--st-bg-secondary)]" />
    <div className="absolute -bottom-6 left-[75%] -translate-x-1/2 text-[10px] font-medium text-[var(--st-danger)] bg-[var(--st-bg-secondary)] px-1.5 py-0.5 rounded-[var(--st-radius)] border border-[var(--st-border)]">No</div>
  </div>
);

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  logic: LogicNode,
  condition: ConditionNode,
};

const initialNodes: Node[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 250, y: 50 },
    data: {
      title: 'Joined Segment',
      subtitle: 'New Subscribers',
      description: 'Triggered when a user joins the "New Subscribers" segment.',
    },
  },
  {
    id: 'action-1',
    type: 'action',
    position: { x: 250, y: 200 },
    data: {
      icon: 'email',
      title: 'Send Welcome Email',
      subtitle: 'Email #1',
      description: 'Send the standard welcome email sequence.',
    },
  },
  {
    id: 'delay-1',
    type: 'logic',
    position: { x: 275, y: 350 },
    data: {
      icon: 'clock',
      title: 'Wait 2 Days',
      subtitle: 'Delay before check',
    },
  },
  {
    id: 'condition-1',
    type: 'condition',
    position: { x: 250, y: 450 },
    data: {
      title: 'Opened Email?',
      description: 'Check if the user opened the welcome email.',
    },
  },
  {
    id: 'action-2',
    type: 'action',
    position: { x: 100, y: 600 },
    data: {
      icon: 'email',
      title: 'Send Follow-up',
      subtitle: 'Email #2',
      description: 'Send follow up email with special offer.',
    },
  },
  {
    id: 'action-3',
    type: 'action',
    position: { x: 400, y: 600 },
    data: {
      icon: 'sms',
      title: 'Send SMS',
      subtitle: 'Reminder',
      description: 'Send SMS reminder to open the email.',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'trigger-1', target: 'action-1', animated: true },
  { id: 'e2-3', source: 'action-1', target: 'delay-1' },
  { id: 'e3-4', source: 'delay-1', target: 'condition-1' },
  { id: 'e4-5', source: 'condition-1', sourceHandle: 'true', target: 'action-2', animated: true, style: { stroke: 'var(--st-status-ok)' } },
  { id: 'e4-6', source: 'condition-1', sourceHandle: 'false', target: 'action-3', animated: true, style: { stroke: 'var(--st-danger)' } },
];

let id = 0;
const getId = () => `dndnode_${id++}`;

function JourneyCanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragStart = (event: DragEvent, nodeType: string, subtype?: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    if (subtype) {
      event.dataTransfer.setData('application/reactflow/subtype', subtype);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow/type');
      const subtype = event.dataTransfer.getData('application/reactflow/subtype');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let nodeData = {};
      if (type === 'trigger') {
        nodeData = { title: 'New Trigger', subtitle: 'Event', description: 'Configure this trigger' };
      } else if (type === 'action') {
        nodeData = {
          icon: subtype || 'email',
          title: subtype === 'sms' ? 'Send SMS' : 'Send Email',
          subtitle: 'New Message',
          description: 'Configure this action',
        };
      } else if (type === 'logic') {
        nodeData = { title: 'Time Delay', subtitle: 'Wait 1 day' };
      } else if (type === 'condition') {
        nodeData = { title: 'Condition', description: 'True / False branch' };
      }

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: nodeData,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const updateNodeData = (key: string, value: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          node.data = {
            ...node.data,
            [key]: value,
          };
        }
        return node;
      })
    );
    // also update local state
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, [key]: value } } : null);
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter(n => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[var(--st-bg)]">
       {/* Left Palette - Draggable Components */}
       <aside className="w-64 border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 overflow-y-auto flex flex-col gap-6 z-10 shrink-0">
         <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)] mb-3">Triggers</h3>
            <div className="space-y-2">
              <div
                className="p-3 border border-[var(--st-border)] bg-[var(--st-bg)] rounded-[var(--st-radius)] cursor-grab hover:bg-[var(--st-bg-muted)] hover:border-[var(--st-accent)] transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'trigger')}
                draggable
              >
                <Zap className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--st-text)]">Segment Join</span>
              </div>
              <div
                className="p-3 border border-[var(--st-border)] bg-[var(--st-bg)] rounded-[var(--st-radius)] cursor-grab hover:bg-[var(--st-bg-muted)] hover:border-[var(--st-accent)] transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'trigger')}
                draggable
              >
                <Users className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--st-text)]">Form Submit</span>
              </div>
            </div>
         </div>

         <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)] mb-3">Actions</h3>
            <div className="space-y-2">
              <div
                className="p-3 border border-[var(--st-border)] bg-[var(--st-bg)] rounded-[var(--st-radius)] cursor-grab hover:bg-[var(--st-bg-muted)] hover:border-[var(--st-accent)] transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'action', 'email')}
                draggable
              >
                <Mail className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--st-text)]">Send Email</span>
              </div>
              <div
                className="p-3 border border-[var(--st-border)] bg-[var(--st-bg)] rounded-[var(--st-radius)] cursor-grab hover:bg-[var(--st-bg-muted)] hover:border-[var(--st-accent)] transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'action', 'sms')}
                draggable
              >
                <MessageSquare className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--st-text)]">Send SMS</span>
              </div>
            </div>
         </div>

         <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--st-text-tertiary)] mb-3">Logic</h3>
            <div className="space-y-2">
              <div
                className="p-3 border border-[var(--st-border)] bg-[var(--st-bg)] rounded-[var(--st-radius)] cursor-grab hover:bg-[var(--st-bg-muted)] hover:border-[var(--st-accent)] transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'logic')}
                draggable
              >
                <Clock className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--st-text)]">Time Delay</span>
              </div>
              <div
                className="p-3 border border-[var(--st-border)] bg-[var(--st-bg)] rounded-[var(--st-radius)] cursor-grab hover:bg-[var(--st-bg-muted)] hover:border-[var(--st-accent)] transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'condition')}
                draggable
              >
                <GitBranch className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--st-text)]">If / Else</span>
              </div>
            </div>
         </div>
       </aside>

       {/* ReactFlow Canvas */}
       <div className="flex-1 h-full relative" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          className="bg-[var(--st-bg)]"
        >
          <Background color="var(--st-border)" gap={24} size={1} />
          <Controls className="bg-[var(--st-bg-secondary)] border-[var(--st-border)] fill-[var(--st-text-secondary)] [&>button]:border-b-[var(--st-border)]" />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'trigger') return 'var(--st-accent)';
              if (n.type === 'action') return 'var(--st-status-ok)';
              if (n.type === 'logic') return 'var(--st-text-tertiary)';
              if (n.type === 'condition') return 'var(--st-warn)';
              return 'var(--st-text-tertiary)';
            }}
            maskColor="rgba(12, 12, 14, 0.7)"
            style={{ backgroundColor: 'var(--st-bg-secondary)', border: '1px solid var(--st-border)' }}
            className="rounded-[var(--st-radius)] overflow-hidden"
          />
          <Panel position="top-left" className="m-4">
            <div className="flex flex-col gap-4">
              <Button variant="outline" size="sm" iconLeft={ChevronLeft} className="w-fit">
                Back to Journeys
              </Button>
              <div className="flex items-center gap-4 bg-[var(--st-bg-secondary)] backdrop-blur-md p-2 px-4 rounded-full border border-[var(--st-border)] shadow-lg">
                <span className="text-sm font-medium text-[var(--st-text)]">Welcome Series Journey</span>
                <Badge tone="success" dot>Active</Badge>
              </div>
            </div>
          </Panel>
          <Panel position="top-right" className="m-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" iconLeft={Save}>
                Save Draft
              </Button>
              <Button variant="primary" size="sm" iconLeft={Play}>
                Publish
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right Sidebar - Properties Panel */}
      {selectedNode && (
        <aside className="w-80 border-l border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex flex-col z-10 shrink-0">
          <div className="flex items-center justify-between p-4 border-b border-[var(--st-border)]">
            <h2 className="text-sm font-semibold text-[var(--st-text)] flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Node Settings
            </h2>
            <IconButton label="Close node settings" icon={X} variant="ghost" size="sm" onClick={() => setSelectedNode(null)} />
          </div>
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            <Field label="Title">
              <Input
                value={selectedNode.data.title || ''}
                onChange={(e) => updateNodeData('title', e.target.value)}
                placeholder="Node title"
              />
            </Field>

            {selectedNode.type !== 'condition' && (
              <Field label="Subtitle">
                <Input
                  value={selectedNode.data.subtitle || ''}
                  onChange={(e) => updateNodeData('subtitle', e.target.value)}
                  placeholder="Optional subtitle"
                />
              </Field>
            )}

            <Field label="Description">
              <Textarea
                value={selectedNode.data.description || ''}
                onChange={(e) => updateNodeData('description', e.target.value)}
                placeholder="Description of this step"
                className="min-h-[80px]"
              />
            </Field>

            {selectedNode.type === 'action' && selectedNode.data.icon === 'email' && (
              <div className="space-y-2 pt-4 border-t border-[var(--st-border)] mt-4">
                <Field label="Select email template">
                  <Select defaultValue="template-1">
                    <SelectTrigger aria-label="Select email template">
                      <SelectValue placeholder="Choose template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="template-1">Welcome Email v1</SelectItem>
                      <SelectItem value="template-2">Special Offer</SelectItem>
                      <SelectItem value="template-3">Newsletter #4</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Button variant="outline" block className="mt-2">Edit template</Button>
              </div>
            )}

            {selectedNode.type === 'logic' && (
              <div className="pt-4 border-t border-[var(--st-border)] mt-4">
                <Field label="Delay duration">
                  <div className="flex gap-2">
                    <Input type="number" defaultValue="2" className="w-20" aria-label="Delay amount" />
                    <Select defaultValue="days">
                      <SelectTrigger className="flex-1" aria-label="Delay unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Field>
              </div>
            )}

          </div>
          <div className="mt-auto p-4 border-t border-[var(--st-border)]">
            <Button variant="danger" block iconLeft={Trash2} onClick={deleteSelectedNode}>
              Delete node
            </Button>
          </div>
        </aside>
      )}
    </div>
  );
}

export default function MarketingJourneyPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-[var(--st-bg)]">
      {/* Fixed canvas chrome header */}
      <div className="h-16 border-b border-[var(--st-border)] flex items-center px-6 shrink-0 bg-[var(--st-bg-secondary)]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)] flex items-center justify-center">
            <GitBranch className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-[var(--st-text)]">Journey Builder</h1>
        </div>
      </div>

      {/* ReactFlow needs to be wrapped in ReactFlowProvider */}
      <ReactFlowProvider>
        <JourneyCanvasContent />
      </ReactFlowProvider>
    </div>
  );
}
