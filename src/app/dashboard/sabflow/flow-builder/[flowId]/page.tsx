
'use client';

import React, { useState, useActionState, useEffect, useRef, useTransition, useCallback, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

import { saveSabFlow, getSabFlowById } from '@/app/actions/sabflow.actions';
import { getSession } from '@/app/actions';
import type { WithId, SabFlow, User, SabFlowNode, SabFlowEdge } from '@/lib/definitions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  ArrowLeft,
  Save,
  LoaderCircle,
  Plus,
  PlayCircle,
  Zap,
  Trash2,
  Settings,
  GitFork,
  BookOpen,
  PanelLeft,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  Frame,
  X,
  RefreshCw,
  Copy,
  MoreVertical,
} from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const initialState = { message: null, error: null, flowId: undefined };

function BuilderPageSkeleton() {
    return (
      <div className="flex h-screen w-screen bg-background p-2 gap-2">
        <div className="w-60 rounded-lg bg-card p-2">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-16 rounded-lg bg-card p-4">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="flex-1 rounded-lg bg-card p-4">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Flow
    </Button>
  );
}

function PropertiesPanel({ user, selectedNode, onNodeChange, onNodeRemove }: { user: any, selectedNode: SabFlowNode, onNodeChange: (id: string, data: any) => void, onNodeRemove: (id: string) => void }) {
    const handleDataChange = (data: any) => {
        onNodeChange(selectedNode.id, { ...selectedNode.data, ...data });
    };

    const renderEditorContent = () => {
        const isAction = selectedNode.type === 'action';
        const isCondition = selectedNode.type === 'condition';

        const selectedConnection = user?.sabFlowConnections?.find((c: any) => c.connectionName === selectedNode.data.connectionId);
        const selectedApp = sabnodeAppActions.find(app => app.appId === selectedConnection?.appId);
        const selectedAction = selectedApp?.actions.find(a => a.name === selectedNode.data.actionName);

        if (isAction) {
            if (!selectedNode.data.connectionId) {
                return (
                    <div className="space-y-4">
                        <h3 className="font-semibold">Choose an App</h3>
                        <div className="grid grid-cols-5 gap-2">
                            {(user?.sabFlowConnections || []).map((conn: any) => {
                                const appConfig = sabnodeAppActions.find(app => app.appId === conn.appId);
                                const AppIcon = appConfig?.icon || Zap;
                                return (
                                    <button type="button" key={conn.connectionName} className={cn("aspect-square p-2 text-center cursor-pointer hover:bg-accent rounded-lg flex flex-col items-center justify-center gap-2 transition-colors", appConfig?.bgColor)} onClick={() => onNodeChange(selectedNode.id, { connectionId: conn.connectionName, actionName: '', inputs: {} })}>
                                        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center")}>
                                            <AppIcon className={cn("h-6 w-6", appConfig?.iconColor)}/>
                                        </div>
                                        <p className="text-[10px] font-bold text-black break-words whitespace-normal leading-tight">{conn.connectionName}</p>
                                    </button>
                                );
                            })}
                            <Link href="/dashboard/sabflow/connections" className="aspect-square p-2 text-center cursor-pointer hover:bg-accent flex flex-col items-center justify-center border-dashed border-2 rounded-lg transition-colors">
                                <Plus className="h-6 w-6 text-muted-foreground"/>
                                <p className="text-xs mt-1">Add App</p>
                            </Link>
                        </div>
                    </div>
                );
            } else {
                const handleApiChange = (field: keyof any, value: any) => {
                    const currentApiRequest = selectedNode.data.apiRequest || {};
                    const newApiRequest = { ...currentApiRequest, [field]: value };
                    handleDataChange({ apiRequest: newApiRequest });
                };
            
                const handleMappingChange = (index: number, field: 'variable' | 'path', value: string) => {
                    const mappings = [...(selectedNode.data.apiRequest?.responseMappings || [])];
                    mappings[index] = { ...mappings[index], [field]: value };
                    handleApiChange('responseMappings', mappings);
                };
            
                const addMapping = () => {
                    const mappings = [...(selectedNode.data.apiRequest?.responseMappings || []), { variable: '', path: '' }];
                    handleApiChange('responseMappings', mappings);
                };
            
                const removeMapping = (index: number) => {
                    const mappings = (selectedNode.data.apiRequest?.responseMappings || []).filter((_: any, i: number) => i !== index);
                    handleApiChange('responseMappings', mappings);
                };

                return (
                    <>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => onNodeChange(selectedNode.id, { connectionId: '', actionName: '', inputs: {} })}>
                                <ArrowLeft className="mr-2 h-4 w-4"/> Change App
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label>Action</Label>
                            <Select value={selectedNode.data.actionName} onValueChange={val => onNodeChange(selectedNode.id, { actionName: val, inputs: {} })}>
                                <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                                <SelectContent>
                                    {selectedApp?.actions.map((action: any) => (<SelectItem key={action.name} value={action.name}>{action.label}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedAction && (
                             <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-semibold">{selectedAction.label}</h4>
                                <p className="text-sm text-muted-foreground">{selectedAction.description}</p>
                                {selectedAction.inputs.map((input: any) => (<div key={input.name} className="space-y-2"><Label>{input.label}</Label><NodeInput input={input} value={selectedNode.data.inputs[input.name]} onChange={val => onNodeChange(selectedNode.id, { inputs: {...selectedNode.data.inputs, [input.name]: val} })}/></div>))}
                            </div>
                        )}
                    </>
                );
            }
        }

        if (isCondition) {
            const rules = selectedNode.data.rules || [{ field: '', operator: 'equals', value: '' }];
            const handleRuleChange = (index: number, field: string, value: string) => {
                const newRules = [...rules];
                newRules[index] = { ...newRules[index], [field]: value };
                handleDataChange({ rules: newRules });
            };
            const addRule = () => handleDataChange({ rules: [...rules, { field: '', operator: 'equals', value: '' }]});
            const removeRule = (index: number) => handleDataChange({ rules: rules.filter((_: any, i: number) => i !== index) });

            return (
                <div className="space-y-4">
                    <RadioGroup value={selectedNode.data.logicType || 'AND'} onValueChange={(val) => handleDataChange({ logicType: val })} className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="AND" id="logic-and"/><Label htmlFor="logic-and">Match ALL conditions (AND)</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="OR" id="logic-or"/><Label htmlFor="logic-or">Match ANY condition (OR)</Label></div></RadioGroup>
                    <div className="space-y-3">
                        {rules.map((rule: any, index: number) => (<div key={index} className="p-2 border rounded space-y-2 relative"><Button variant="ghost" size="icon" className="absolute -top-3 -right-3 h-6 w-6" onClick={() => removeRule(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button><Input placeholder="Variable e.g. {{trigger.name}}" value={rule.field} onChange={e => handleRuleChange(index, 'field', e.target.value)} /><Select value={rule.operator} onValueChange={val => handleRuleChange(index, 'operator', val)}><SelectTrigger><SelectValue placeholder="Select operator..."/></SelectTrigger><SelectContent><SelectItem value="equals">Equals</SelectItem><SelectItem value="not_equals">Not Equals</SelectItem><SelectItem value="contains">Contains</SelectItem></SelectContent></Select><Input placeholder="Value" value={rule.value} onChange={e => handleRuleChange(index, 'value', e.target.value)} /></div>))}
                    </div>
                    <Button variant="outline" size="sm" onClick={addRule}><Plus className="mr-2 h-4 w-4"/>Add Condition</Button>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b flex-shrink-0">
                <h3 className="text-lg font-semibold">Properties</h3>
                <p className="text-sm text-muted-foreground">Configure the selected step.</p>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Step Name</Label>
                        <Input value={selectedNode.data.name} onChange={e => handleDataChange({ name: e.target.value })}/>
                    </div>
                    <Separator />
                    {renderEditorContent()}
                </div>
            </ScrollArea>
            {selectedNode?.type !== 'trigger' && (
                <div className="p-4 border-t flex-shrink-0">
                    <Button variant="destructive" className="w-full" onClick={() => onNodeRemove(selectedNode.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Step
                    </Button>
                </div>
            )}
        </div>
    );
}

function NodeComponent({ user, node, onSelectNode, isSelected, onNodeMouseDown, onHandleClick, onNodeContextMenu }: { user: any, node: SabFlowNode; onSelectNode: (id: string) => void; isSelected: boolean; onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void; onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string) => void; onNodeContextMenu: (e: React.MouseEvent, nodeId: string) => void;}) {
    const app = user?.sabFlowConnections?.find((c: any) => c.connectionName === node.data.connectionId);
    const appConfig = sabnodeAppActions.find(a => a.appId === app?.appId);
    const action = appConfig?.actions.find(a => a.name === node.data.actionName);
    const Icon = node.type === 'trigger'
        ? triggers.find(t => t.id === node.data.triggerType)?.icon || Zap
        : appConfig?.icon || (node.type === 'condition' ? GitFork : Zap);
    
    const hasIncomingEdge = node.data.hasIncomingEdge || false;
    
    const Handle = ({ position, id }: { position: 'left' | 'right'; id: string }) => (
        <div id={id} data-handle-pos={position} className={cn("absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 top-1/2 -translate-y-1/2", position === 'left' ? '-left-2' : '-right-2')} onClick={e => handleHandleClick(e, node.id, id)} />
    );

    return (
        <div
            key={node.id}
            data-node-id={node.id}
            className="absolute transition-all text-center"
            style={{ left: node.position.x, top: node.position.y, cursor: 'grab' }}
            onMouseDown={e => onNodeMouseDown(e, node.id)}
            onClick={e => { e.stopPropagation(); onSelectNode(node.id) }}
            onContextMenu={(e) => onNodeContextMenu(e, node.id)}
        >
            <div
                className={cn(
                    "w-32 h-32 rounded-[40px] cursor-pointer flex flex-col items-center justify-center p-4 bg-white",
                    isSelected && 'ring-2 ring-primary'
                )}
                style={{ filter: 'drop-shadow(rgba(0, 0, 0, 0.15) 0px 5px 6px)' }}
            >
                <div className={cn("w-16 h-16 rounded-full flex items-center justify-center")}>
                    <Icon className="h-8 w-8 text-primary" />
                </div>
            </div>
            <p className="font-bold text-xs mt-2 text-black">{action?.label || node.data.name}</p>
            {hasIncomingEdge && node.type !== 'trigger' && <Handle position="left" id={`${node.id}-input`} />}
            {node.type === 'condition' ? (
                <>
                    <div id={`${node.id}-output-yes`} data-handle-pos="right" className="absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 -right-2 top-1/3 -translate-y-1/2" onClick={e => handleHandleClick(e, node.id, `${node.id}-output-yes`)} />
                    <div id={`${node.id}-output-no`} data-handle-pos="right" className="absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 -right-2 top-2/3 -translate-y-1/2" onClick={e => handleHandleClick(e, node.id, `${node.id}-output-no`)} />
                </>
            ) : (
                <Handle position="right" id={`${node.id}-output-main`} />
            )}
        </div>
    );
};

export default function EditSabFlowPage() {
    const params = useParams();
    const flowId = params.flowId as string;
    
    const [state, formAction] = useActionState(saveSabFlow, initialState);
    const router = useRouter();
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [user, setUser] = useState<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [flowName, setFlowName] = useState('');
    const [trigger, setTrigger] = useState({ type: 'webhook', details: {} });
    const [nodes, setNodes] = useState<SabFlowNode[]>([]);
    const [edges, setEdges] = useState<SabFlowEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [pan, setPan] = useState({ x: 200, y: 150 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<{ sourceNodeId: string; sourceHandleId: string; startPos: { x: number; y: number } } | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);

    const isNew = flowId === 'new-flow';

    const handleCreateNewFlow = useCallback(() => {
        setFlowName('New Automation Flow');
        setTrigger({ type: 'webhook', details: {} });
        setNodes([]);
        setEdges([]);
        setSelectedNodeId(null);
    }, []);

    useEffect(() => {
        getSession().then(session => setUser(session?.user));
        if (isNew) {
            handleCreateNewFlow();
            setIsLoading(false);
        } else if (flowId) {
            getSabFlowById(flowId).then(flow => {
                if(flow) {
                    setFlowName(flow.name);
                    setTrigger(flow.trigger);
                    setNodes(flow.nodes || []);
                    setEdges(flow.edges || []);
                } else {
                    handleCreateNewFlow();
                }
                setIsLoading(false);
            });
        }
    }, [flowId, isNew, handleCreateNewFlow]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            if (isNew && state.flowId) {
                 router.push(`/dashboard/sabflow/flow-builder/${state.flowId}`);
            } else if (!isNew) {
                router.refresh();
            }
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, isNew]);
    
    useEffect(() => {
        if (selectedNodeId) {
            setIsSidebarOpen(true);
        }
    }, [selectedNodeId]);

    const handleAddNode = (type: 'action' | 'condition') => {
        const centerOfViewX = viewportRef.current ? (viewportRef.current.clientWidth / 2 - pan.x) / zoom : 400;
        const centerOfViewY = viewportRef.current ? (viewportRef.current.clientHeight / 2 - pan.y) / zoom : 150;
        const newNodeId = `${type}_${Date.now()}`;
        const newNode: SabFlowNode = {
            id: newNodeId,
            type: type,
            data: { name: `New ${type}`, connectionId: '', actionName: '', inputs: {} },
            position: { x: centerOfViewX, y: centerOfViewY }
        };
        setNodes([...nodes, newNode]);
        setSelectedNodeId(newNodeId);
        setIsSidebarOpen(true);
    };
    
    const handleRemoveNode = (nodeId: string) => {
        setNodes(nodes.filter(n => n.id !== nodeId));
        setEdges(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
        if(selectedNodeId === nodeId) setSelectedNodeId(null);
    };
    
    const handleCopyNode = (nodeId: string) => {
        const nodeToCopy = nodes.find(n => n.id === nodeId);
        if (!nodeToCopy) return;

        const newNode: SabFlowNode = {
            ...JSON.parse(JSON.stringify(nodeToCopy)),
            id: `${nodeToCopy.type}_${Date.now()}`,
            position: {
                x: nodeToCopy.position.x + 40,
                y: nodeToCopy.position.y + 40
            }
        };
        setNodes(prev => [...prev, newNode]);
    };

    const handleNodeChange = (nodeId: string, data: any) => {
        setNodes(nodes.map(n => n.id === nodeId ? {...n, data: {...n.data, ...data}} : n));
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => { 
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation(); setDraggingNode(nodeId); 
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => { 
        if (contextMenu) setContextMenu(null);
        if (e.button !== 0) return;
        if (e.target === e.currentTarget) { e.preventDefault(); setIsPanning(true); }
    };
    
    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        } else if (draggingNode) {
            setNodes(prev => prev.map(n => 
                n.id === draggingNode 
                    ? { ...n, position: { x: n.position.x + e.movementX / zoom, y: n.position.y + e.movementY / zoom } } 
                    : n
            ));
        }
        
        if (connecting && viewportRef.current) {
            const rect = viewportRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            setMousePosition({ x: (mouseX - pan.x) / zoom, y: (mouseY - pan.y) / zoom });
        }
    };
    
    const handleCanvasMouseUp = () => { setIsPanning(false); setDraggingNode(null); };
    const handleCanvasClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) { if (connecting) setConnecting(null); else setSelectedNodeId(null); }};

    const handleHandleClick = (e: React.MouseEvent, nodeId: string, handleId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!viewportRef.current) return;
        const isOutputHandle = handleId.includes('output');

        if (isOutputHandle) {
            const sourceNode = nodes.find(n => n.id === nodeId);
            if (sourceNode) {
                const handlePos = getNodeHandlePosition(sourceNode, handleId);
                if (handlePos) setConnecting({ sourceNodeId: nodeId, sourceHandleId: handleId, startPos: handlePos });
            }
        } else if (connecting && !isOutputHandle) {
            if (connecting.sourceNodeId === nodeId) {
                setConnecting(null);
                return;
            }
            
            const edgeExists = edges.some(
                edge => (edge.source === connecting.sourceNodeId && edge.target === nodeId) || (edge.source === nodeId && edge.target === connecting.sourceNodeId)
            );
            if (edgeExists) {
                setConnecting(null);
                return;
            }

            const newEdge: SabFlowEdge = {
                id: `edge-${connecting.sourceNodeId}-${nodeId}`,
                source: connecting.sourceNodeId,
                target: nodeId,
                sourceHandle: connecting.sourceHandleId,
                targetHandle: handleId,
            };
            
            setEdges(prevEdges => [...prevEdges, newEdge]);
            setConnecting(null);
        }
    };
    
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (!viewportRef.current) return;
    
        const rect = viewportRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
    
        const zoomFactor = -0.001;
        const newZoom = Math.max(0.25, Math.min(2.5, zoom + e.deltaY * zoomFactor));
        
        const worldX = (mouseX - pan.x) / zoom;
        const worldY = (mouseY - pan.y) / zoom;
        
        const newPanX = mouseX - worldX * newZoom;
        const newPanY = mouseY - worldY * newZoom;
    
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
    };

    const handleZoomControls = (direction: 'in' | 'out' | 'reset') => {
        if(direction === 'reset') { setZoom(1); setPan({ x: 200, y: 150 }); return; }
        const newZoom = direction === 'in' ? zoom * 1.2 : zoom / 1.2;
        setZoom(Math.max(0.25, Math.min(2.5, newZoom)));
    };

    const handleToggleFullScreen = () => {
        const elem = document.querySelector('.sabflow-builder-container');
        if (!elem) return;

        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen?.();
        }
    };

    useEffect(() => {
        const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);
    
    const handleNodeContextMenu = (e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    };

    const nodesWithEdgeInfo = useMemo(() => {
        const incomingEdges = new Set(edges.map(e => e.target));
        return nodes.map(n => ({...n, data: {...n.data, hasIncomingEdge: incomingEdges.has(n.id) }}));
    }, [nodes, edges]);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    
    if (isLoading) {
        return <BuilderPageSkeleton />;
    }

    return (
      <div className="h-full">
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="flowId" value={isNew ? 'new-flow' : flowId} />
            <input type="hidden" name="name" value={flowName} />
            <input type="hidden" name="trigger" value={JSON.stringify(trigger)} />
            <input type="hidden" name="nodes" value={JSON.stringify(nodes)} />
            <input type="hidden" name="edges" value={JSON.stringify(edges)} />
            
            <div className="flex flex-col h-full">
                <header className="relative flex-shrink-0 flex items-center justify-between p-3 border-b bg-card">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" asChild className="h-9 px-2">
                            <Link href="/dashboard/sabflow/flow-builder"><ArrowLeft className="h-4 w-4" />Back</Link>
                        </Button>
                        <Input value={flowName} onChange={(e) => setFlowName(e.target.value)} className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild><Link href="/dashboard/sabflow/docs"><BookOpen className="mr-2 h-4 w-4" />Docs</Link></Button>
                        <SaveButton />
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    <main 
                        ref={viewportRef}
                        className="flex-1 w-full h-full min-h-[85vh] overflow-hidden relative cursor-grab active:cursor-grabbing sabflow-builder-container bg-muted/30"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onWheel={handleWheel}
                        onClick={handleCanvasClick}
                        onContextMenu={(e) => {
                            const target = e.target as HTMLElement;
                            const nodeElement = target.closest('[data-node-id]');
                            if(nodeElement) {
                                const nodeId = nodeElement.getAttribute('data-node-id');
                                if (nodeId) handleNodeContextMenu(e, nodeId);
                            } else {
                                e.preventDefault();
                                // Logic for canvas context menu if needed
                            }
                        }}
                    >
                        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.4) 1px, transparent 0)', backgroundSize: '20px 20px', backgroundPosition: `${pan.x}px ${pan.y}px` }}/>
                        <div className="relative w-full h-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
                            <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '10000px', height: '10000px', transformOrigin: 'top left' }}>
                                <defs><marker id="arrowhead" viewBox="0 -5 10 10" refX="8" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L10,0L0,5" fill="hsla(215, 89%, 48%, 0.5)" /></marker></defs>
                                {edges.map(edge => {
                                    const sourceNode = nodes.find(n => n.id === edge.source);
                                    const targetNode = nodes.find(n => n.id === edge.target);
                                    if(!sourceNode || !targetNode) return null;
                                    const sourcePos = getNodeHandlePosition(sourceNode, edge.sourceHandle || `${edge.source}-output-main`);
                                    const targetPos = getNodeHandlePosition(targetNode, edge.targetHandle || `${edge.target}-input`);
                                    if (!sourcePos || !targetPos) return null;
                                    return <path key={edge.id} d={getEdgePath(sourcePos, targetPos)} stroke="hsla(215, 89%, 48%, 0.5)" strokeWidth="2" fill="none" className="sabflow-edge-path" markerEnd="url(#arrowhead)" />
                                })}
                                {connecting && (
                                    <path d={getEdgePath(connecting.startPos, mousePosition)} stroke="hsla(215, 89%, 48%, 0.5)" strokeWidth="2" fill="none" strokeDasharray="8 8" className="sabflow-edge-path" markerEnd="url(#arrowhead)" />
                                )}
                            </svg>
                            {nodesWithEdgeInfo.length === 0 ? (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                     <button type="button" onClick={() => setIsSidebarOpen(true)} className="flex flex-col items-center gap-4 text-muted-foreground hover:text-primary transition-colors">
                                        <div className="w-24 h-24 rounded-full border-4 border-dashed flex items-center justify-center">
                                            <Plus className="h-10 w-10"/>
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold">Add Trigger</p>
                                            <p className="text-sm">Choose Your First Application</p>
                                        </div>
                                    </button>
                                </div>
                            ) : nodesWithEdgeInfo.map(node => (
                                <NodeComponent key={node.id} user={user} node={node} onSelectNode={setSelectedNodeId} isSelected={selectedNodeId === node.id} onNodeMouseDown={handleNodeMouseDown} onHandleClick={handleHandleClick} onNodeContextMenu={handleNodeContextMenu}/>
                            ))}
                        </div>
                        {contextMenu && (
                            <Card className="absolute p-1 z-50" style={{ top: contextMenu.y, left: contextMenu.x }}>
                                <CardContent className="p-0">
                                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { handleCopyNode(contextMenu.nodeId); setContextMenu(null); }}>Copy</Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => { handleRemoveNode(contextMenu.nodeId); setContextMenu(null); }}>Delete</Button>
                                </CardContent>
                            </Card>
                        )}
                        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('out')}><ZoomOut className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('in')}><ZoomIn className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('reset')}><Frame className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={handleToggleFullScreen}>{isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button>
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button className="absolute bottom-4 left-4 z-10 h-14 w-14 rounded-full" size="icon">
                                    <Plus className="h-6 w-6"/>
                                </Button>
                            </PopoverTrigger>
                             <PopoverContent className="w-80 p-0" align="start">
                               <div className="p-4 space-y-2">
                                   <Button className="w-full justify-start" variant="ghost" onClick={() => handleAddNode('action')}>Action Step</Button>
                                   <Button className="w-full justify-start" variant="ghost" onClick={() => handleAddNode('condition')}>Condition</Button>
                               </div>
                            </PopoverContent>
                        </Popover>
                    </main>
                    <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                        <SheetContent className="w-full max-w-[35%] min-w-[500px] p-0 flex flex-col">
                           {selectedNodeId && nodes.find(n=>n.id === selectedNodeId) ? (
                                <PropertiesPanel 
                                    user={user} 
                                    selectedNode={nodes.find(n => n.id === selectedNodeId)!}
                                    onNodeChange={handleNodeChange}
                                    onNodeRemove={handleRemoveNode}
                                />
                           ) : (
                               <div className="flex flex-col h-full">
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold">Choose an App</h3>
                                        <p className="text-sm text-muted-foreground">Select an app to add your first step.</p>
                                    </div>
                                    <div className="flex-1 p-4 space-y-4">
                                       <h3 className="font-semibold">Your Connections</h3>
                                       <div className="grid grid-cols-5 gap-2">
                                           {(user?.sabFlowConnections || []).map((conn: any) => {
                                               const appConfig = sabnodeAppActions.find(app => app.appId === conn.appId);
                                               const AppIcon = appConfig?.icon || Zap;
                                               return (
                                                  <button type="button" key={conn.connectionName} className={cn("aspect-square p-2 text-center cursor-pointer hover:bg-accent rounded-lg flex flex-col items-center justify-center gap-2 transition-colors", appConfig?.bgColor)} onClick={() => handleAddNode('action')}>
                                                      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center")}>
                                                          <AppIcon className={cn("h-6 w-6", appConfig?.iconColor)}/>
                                                      </div>
                                                      <p className="text-[10px] font-bold text-black break-words whitespace-normal leading-tight">{conn.connectionName}</p>
                                                  </button>
                                               )
                                           })}
                                           <Link href="/dashboard/sabflow/connections" className="aspect-square p-2 text-center cursor-pointer hover:bg-accent flex flex-col items-center justify-center border-dashed border-2 rounded-lg transition-colors">
                                               <Plus className="h-6 w-6 text-muted-foreground"/>
                                               <p className="text-xs mt-1">Add App</p>
                                           </Link>
                                       </div>
                                    </div>
                                </div>
                           )}
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </form>
    </div>
    );
}
