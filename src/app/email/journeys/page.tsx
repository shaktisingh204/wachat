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
  Badge,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Separator,
  Label,
  Textarea
} from '@/components/zoruui';

import { 
  Mail, 
  MessageSquare, 
  Clock, 
  Zap, 
  GitBranch, 
  Settings2,
  MousePointer2,
  Users,
  Play,
  Save,
  ChevronLeft,
  GripVertical,
  Plus,
  Trash2,
  X
} from 'lucide-react';

const TriggerNode = ({ data, isConnectable, selected }: any) => (
  <div className={`rounded-xl border ${selected ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-blue-500/50'} bg-slate-900 shadow-xl min-w-[250px] transition-all`}>
    <div className="bg-blue-500/10 p-3 border-b border-white/5 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
        <Zap className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-200">{data.title}</h3>
        {data.subtitle && <p className="text-xs text-slate-400">{data.subtitle}</p>}
      </div>
    </div>
    {data.description && (
      <div className="p-3">
        <div className="text-xs text-slate-300">{data.description}</div>
      </div>
    )}
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-slate-900" />
  </div>
);

const ActionNode = ({ data, isConnectable, selected }: any) => (
  <div className={`rounded-xl border ${selected ? 'border-emerald-400 ring-2 ring-emerald-500/20' : 'border-emerald-500/50'} bg-slate-900 shadow-xl min-w-[250px] transition-all`}>
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-slate-900" />
    <div className="bg-emerald-500/10 p-3 border-b border-white/5 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
        {data.icon === 'sms' ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-200">{data.title}</h3>
        {data.subtitle && <p className="text-xs text-slate-400">{data.subtitle}</p>}
      </div>
    </div>
    {data.description && (
      <div className="p-3">
        <div className="text-xs text-slate-300">{data.description}</div>
      </div>
    )}
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-slate-900" />
  </div>
);

const LogicNode = ({ data, isConnectable, selected }: any) => (
  <div className={`rounded-xl border ${selected ? 'border-purple-400 ring-2 ring-purple-500/20' : 'border-purple-500/50'} bg-slate-900 shadow-xl min-w-[200px] transition-all`}>
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-slate-900" />
    <div className="bg-purple-500/10 p-3 border-b border-white/5 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
        <Clock className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-200">{data.title}</h3>
        {data.subtitle && <p className="text-xs text-slate-400">{data.subtitle}</p>}
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-slate-900" />
  </div>
);

const ConditionNode = ({ data, isConnectable, selected }: any) => (
  <div className={`rounded-xl border ${selected ? 'border-amber-400 ring-2 ring-amber-500/20' : 'border-amber-500/50'} bg-slate-900 shadow-xl min-w-[200px] transition-all relative mb-6`}>
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!w-3 !h-3 !bg-amber-500 !border-2 !border-slate-900" />
    <div className="bg-amber-500/10 p-3 border-b border-white/5 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
        <GitBranch className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-200">{data.title}</h3>
      </div>
    </div>
    {data.description && (
      <div className="p-3 text-xs text-slate-300">
        {data.description}
      </div>
    )}
    <Handle type="source" position={Position.Bottom} id="true" style={{ left: '25%' }} isConnectable={isConnectable} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-slate-900" />
    <div className="absolute -bottom-6 left-[25%] -translate-x-1/2 text-[10px] font-medium text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded border border-emerald-500/30">Yes</div>
    
    <Handle type="source" position={Position.Bottom} id="false" style={{ left: '75%' }} isConnectable={isConnectable} className="!w-3 !h-3 !bg-rose-500 !border-2 !border-slate-900" />
    <div className="absolute -bottom-6 left-[75%] -translate-x-1/2 text-[10px] font-medium text-rose-400 bg-slate-900 px-1.5 py-0.5 rounded border border-rose-500/30">No</div>
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
      description: 'Triggered when a user joins the "New Subscribers" segment.' 
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
      description: 'Send the standard welcome email sequence.' 
    },
  },
  {
    id: 'delay-1',
    type: 'logic',
    position: { x: 275, y: 350 },
    data: { 
      icon: 'clock',
      title: 'Wait 2 Days', 
      subtitle: 'Delay before check'
    },
  },
  {
    id: 'condition-1',
    type: 'condition',
    position: { x: 250, y: 450 },
    data: { 
      title: 'Opened Email?', 
      description: 'Check if the user opened the welcome email.'
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
      description: 'Send follow up email with special offer.' 
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
      description: 'Send SMS reminder to open the email.' 
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'trigger-1', target: 'action-1', animated: true },
  { id: 'e2-3', source: 'action-1', target: 'delay-1' },
  { id: 'e3-4', source: 'delay-1', target: 'condition-1' },
  { id: 'e4-5', source: 'condition-1', sourceHandle: 'true', target: 'action-2', animated: true, style: { stroke: '#10b981' } },
  { id: 'e4-6', source: 'condition-1', sourceHandle: 'false', target: 'action-3', animated: true, style: { stroke: '#f43f5e' } },
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
          description: 'Configure this action' 
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

  const onNodeClick = useCallback((_, node: Node) => {
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
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[#0c0c0e]">
       {/* Left Palette - Draggable Components */}
       <aside className="w-64 border-r border-white/10 bg-[#131316] p-4 overflow-y-auto flex flex-col gap-6 z-10 shrink-0">
         <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Triggers</h3>
            <div className="space-y-2">
              <div 
                className="p-3 border border-white/10 bg-slate-800/50 rounded-lg cursor-grab hover:bg-slate-800 hover:border-blue-500/50 transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'trigger')}
                draggable
              >
                <Zap className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-slate-200">Segment Join</span>
              </div>
              <div 
                className="p-3 border border-white/10 bg-slate-800/50 rounded-lg cursor-grab hover:bg-slate-800 hover:border-blue-500/50 transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'trigger')}
                draggable
              >
                <Users className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-slate-200">Form Submit</span>
              </div>
            </div>
         </div>

         <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Actions</h3>
            <div className="space-y-2">
              <div 
                className="p-3 border border-white/10 bg-slate-800/50 rounded-lg cursor-grab hover:bg-slate-800 hover:border-emerald-500/50 transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'action', 'email')}
                draggable
              >
                <Mail className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-slate-200">Send Email</span>
              </div>
              <div 
                className="p-3 border border-white/10 bg-slate-800/50 rounded-lg cursor-grab hover:bg-slate-800 hover:border-emerald-500/50 transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'action', 'sms')}
                draggable
              >
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-slate-200">Send SMS</span>
              </div>
            </div>
         </div>

         <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Logic</h3>
            <div className="space-y-2">
              <div 
                className="p-3 border border-white/10 bg-slate-800/50 rounded-lg cursor-grab hover:bg-slate-800 hover:border-purple-500/50 transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'logic')}
                draggable
              >
                <Clock className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-slate-200">Time Delay</span>
              </div>
              <div 
                className="p-3 border border-white/10 bg-slate-800/50 rounded-lg cursor-grab hover:bg-slate-800 hover:border-amber-500/50 transition-colors flex items-center gap-3"
                onDragStart={(event) => onDragStart(event, 'condition')}
                draggable
              >
                <GitBranch className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-slate-200">If / Else</span>
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
          className="bg-[#0c0c0e]"
        >
          <Background color="#334155" gap={24} size={1} />
          <Controls className="bg-slate-900 border-white/10 fill-slate-300 [&>button]:border-b-white/10" />
          <MiniMap 
            nodeColor={(n) => {
              if (n.type === 'trigger') return '#3b82f6';
              if (n.type === 'action') return '#10b981';
              if (n.type === 'logic') return '#a855f7';
              if (n.type === 'condition') return '#f59e0b';
              return '#64748b';
            }}
            maskColor="rgba(12, 12, 14, 0.7)"
            style={{ backgroundColor: '#131316', border: '1px solid rgba(255,255,255,0.1)' }}
            className="rounded-lg overflow-hidden"
          />
          <Panel position="top-left" className="m-4">
            <div className="flex flex-col gap-4">
              <Button variant="outline" size="sm" className="w-fit">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Journeys
              </Button>
              <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md p-2 px-4 rounded-full border border-white/10 shadow-lg">
                <span className="text-sm font-medium text-slate-200">Welcome Series Journey</span>
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">Active</Badge>
              </div>
            </div>
          </Panel>
          <Panel position="top-right" className="m-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <Play className="h-4 w-4 mr-2" />
                Publish
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right Sidebar - Properties Panel */}
      {selectedNode && (
        <aside className="w-80 border-l border-white/10 bg-[#131316] flex flex-col z-10 shrink-0">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-400" />
              Node Settings
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input 
                value={selectedNode.data.title || ''} 
                onChange={(e) => updateNodeData('title', e.target.value)} 
                placeholder="Node Title"
              />
            </div>
            
            {selectedNode.type !== 'condition' && (
              <div className="space-y-2">
                <Label>Subtitle</Label>
                <Input 
                  value={selectedNode.data.subtitle || ''} 
                  onChange={(e) => updateNodeData('subtitle', e.target.value)} 
                  placeholder="Optional Subtitle"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                value={selectedNode.data.description || ''} 
                onChange={(e) => updateNodeData('description', e.target.value)} 
                placeholder="Description of this step"
                className="min-h-[80px]"
              />
            </div>

            {selectedNode.type === 'action' && selectedNode.data.icon === 'email' && (
              <div className="space-y-2 pt-4 border-t border-white/10 mt-4">
                <Label>Select Email Template</Label>
                <Select defaultValue="template-1">
                  <SelectTrigger>
                    <SelectValue placeholder="Choose template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="template-1">Welcome Email v1</SelectItem>
                    <SelectItem value="template-2">Special Offer</SelectItem>
                    <SelectItem value="template-3">Newsletter #4</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="w-full mt-2">Edit Template</Button>
              </div>
            )}

            {selectedNode.type === 'logic' && (
              <div className="space-y-2 pt-4 border-t border-white/10 mt-4">
                <Label>Delay Duration</Label>
                <div className="flex gap-2">
                  <Input type="number" defaultValue="2" className="w-20" />
                  <Select defaultValue="days">
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

          </div>
          <div className="mt-auto p-4 border-t border-white/10">
            <Button variant="destructive" className="w-full" onClick={deleteSelectedNode}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Node
            </Button>
          </div>
        </aside>
      )}
    </div>
  );
}

export default function MarketingJourneyPage() {
  return (
    <div className="h-screen w-full flex flex-col bg-[#0c0c0e]">
      {/* Top Header can go here if needed, or layout wraps it. But we assumed a full-screen take over for canvas */}
      <div className="h-16 border-b border-white/10 flex items-center px-6 shrink-0 bg-[#0c0c0e]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <GitBranch className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-slate-100">Journey Builder</h1>
        </div>
      </div>
      
      {/* ReactFlow needs to be wrapped in ReactFlowProvider */}
      <ReactFlowProvider>
        <JourneyCanvasContent />
      </ReactFlowProvider>
    </div>
  );
}
