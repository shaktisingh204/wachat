
'use client';

import React, { useState, useActionState, useEffect, useRef, useTransition, useCallback } from 'react';
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
} from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow-actions';
import { cn } from '@/lib/utils';
import Image from 'next/image';


const initialState = { message: null, error: null, flowId: undefined };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Flow
    </Button>
  );
}

const triggers = [
    { id: 'webhook', name: 'Webhook Received', icon: Zap },
    { id: 'app_event', name: 'App Event', icon: PlayCircle },
];

const NODE_WIDTH = 128;
const NODE_HEIGHT = 128;

const getEdgePath = (sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
    if (!sourcePos || !targetPos) return '';
    const dx = Math.abs(sourcePos.x - targetPos.x) * 0.5;
    const path = `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + dx} ${sourcePos.y}, ${targetPos.x - dx} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
    return path;
};

const getNodeHandlePosition = (node: SabFlowNode, handleId: string) => {
    if (!node || !handleId) return null;
    const x = node.position.x;
    const y = node.position.y;

    if (handleId.endsWith('-input')) {
        return { x: x, y: y + NODE_HEIGHT / 2 };
    }
    if (handleId.endsWith('-output-main')) {
        return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT / 2 };
    }
    if (handleId.endsWith('-output-yes')) {
        return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT * (1/3) };
    }
    if (handleId.endsWith('-output-no')) {
        return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT * (2/3) };
    }
    return null;
}

function BuilderPageSkeleton() {
    return (
        <div className="flex h-full bg-muted/30">
            <div className="flex-1 flex flex-col">
                <Skeleton className="h-16 border-b bg-card" />
                <div className="flex-1">
                    <Skeleton className="h-full w-full" />
                </div>
            </div>
        </div>
    )
}

function NodeInput({ input, value, onChange }: { input: any, value: any, onChange: (val: any) => void }) {
    switch (input.type) {
        case 'textarea':
            return <Textarea placeholder={input.placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
        case 'select':
            return (
                <Select value={value || ''} onValueChange={onChange}>
                    <SelectTrigger><SelectValue placeholder={input.placeholder} /></SelectTrigger>
                    <SelectContent>
                        {input.options?.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                </Select>
            );
        default:
            return <Input type={input.type || 'text'} placeholder={input.placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    }
}

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

    const [pan, setPan] = useState({ x: 0, y: 0 });
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
        const triggerNode = { id: 'trigger', type: 'trigger' as const, data: { name: 'Start Flow', triggerType: 'webhook' }, position: { x: 50, y: 150 } };
        setFlowName('New Automation Flow');
        setTrigger({ type: 'webhook', details: {} });
        setNodes([triggerNode]);
        setEdges([]);
        setSelectedNodeId('trigger');
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
                    setNodes(flow.nodes.length > 0 ? flow.nodes : [{ id: 'trigger', type: 'trigger', data: { name: 'Start Flow', triggerType: 'webhook' }, position: { x: 50, y: 150 } }]);
                    setEdges(flow.edges);
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
    };
    
    const handleRemoveNode = (nodeId: string) => {
        setNodes(nodes.filter(n => n.id !== nodeId));
        setEdges(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
        if(selectedNodeId === nodeId) setSelectedNodeId(null);
    };
    
    const handleCopyNode = (nodeId: string) => {
        const nodeToCopy = nodes.find(n => n.id === nodeId);
        if (!nodeToCopy || nodeToCopy.type === 'trigger') return;

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

            const newEdge: SabFlowEdge = {
                id: `edge-${connecting.sourceNodeId}-${nodeId}-${connecting.sourceHandleId}-${handleId}`,
                source: connecting.sourceNodeId,
                target: nodeId,
                sourceHandle: connecting.sourceHandleId,
                targetHandle: handleId,
            };
            
            const edgeExists = edges.some(
                edge => (edge.source === newEdge.source && edge.target === newEdge.target) || (edge.source === newEdge.target && edge.target === newEdge.source)
            );

            if (edgeExists) {
                setConnecting(null);
                return;
            }
            
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
        if(direction === 'reset') { setZoom(1); setPan({ x: 0, y: 0 }); return; }
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

    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    
    const renderPropertiesPanel = () => {
        if (!selectedNode) {
            return (
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b">
                        <h3 className="text-lg font-semibold">Properties</h3>
                        <p className="text-sm text-muted-foreground">Select a step to configure it.</p>
                    </div>
                    <div className="flex-1 p-4 text-center text-muted-foreground">
                        No step selected.
                    </div>
                </div>
            );
        }
        
        const isTrigger = selectedNode.type === 'trigger';
        const isAction = selectedNode.type === 'action';
        const isCondition = selectedNode.type === 'condition';

        const selectedConnection = user?.sabFlowConnections?.find((c: any) => c.connectionName === selectedNode.data.connectionId);
        const selectedApp = sabnodeAppActions.find(app => app.appId === selectedConnection?.appId);
        const selectedAction = selectedApp?.actions.find(a => a.name === selectedNode.data.actionName);

        const handleSetApp = (appId: string, connectionName: string) => {
            handleNodeChange(selectedNode.id, { connectionId: connectionName, actionName: '', inputs: {} });
        };
        
        return (
            <div className="h-full flex flex-col">
                <div className="p-4 border-b flex-shrink-0">
                    <h3 className="text-lg font-semibold">Properties</h3>
                    <p className="text-sm text-muted-foreground">Configure the selected step.</p>
                </div>
                <Tabs defaultValue="setup" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                        <TabsTrigger value="setup">Setup</TabsTrigger>
                        <TabsTrigger value="connections">Connections</TabsTrigger>
                    </TabsList>
                    <div className="flex-1 relative">
                        <ScrollArea className="absolute inset-0">
                            <TabsContent value="setup" className="p-4 space-y-4">
                               <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Step Name</Label>
                                        <Input value={selectedNode.data.name} onChange={e => handleNodeChange(selectedNode.id, { name: e.target.value })}/>
                                    </div>
                                    {isTrigger && (
                                        <>
                                            <div className="space-y-2">
                                                <Label>App Event</Label>
                                                <Select value={selectedNode.data.triggerType} onValueChange={val => { handleNodeChange(selectedNode.id, {triggerType: val}); setTrigger(prev => ({...prev, type: val})); }}>
                                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                                    <SelectContent>{triggers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            {trigger.type === 'webhook' && (
                                                <div className="space-y-2">
                                                    <Label>Webhook URL</Label>
                                                    <CodeBlock code={`${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${isNew ? '[Save Flow to Generate URL]' : flowId}`}/>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {isAction && (
                                        <>
                                            {!selectedNode.data.connectionId ? (
                                                <div className="space-y-4">
                                                    <h3 className="font-semibold">Choose an App</h3>
                                                     <div className="grid grid-cols-3 gap-2">
                                                         {(user?.sabFlowConnections || []).map((conn: any) => {
                                                             const appConfig = sabnodeAppActions.find(app => app.appId === conn.appId);
                                                             const AppIcon = appConfig?.icon || Zap;
                                                             return (
                                                                <button type="button" key={conn.connectionName} className={cn("aspect-square p-2 text-center cursor-pointer hover:bg-accent rounded-lg flex flex-col items-center justify-center gap-2 transition-colors bg-white")} onClick={() => handleSetApp(conn.appId, conn.connectionName)}>
                                                                    <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center")}>
                                                                        <AppIcon className={cn("h-8 w-8", appConfig?.iconColor)}/>
                                                                    </div>
                                                                    <p className="text-xs font-bold text-black break-words whitespace-normal">{conn.connectionName}</p>
                                                                </button>
                                                             )
                                                         })}
                                                         <Link href="/dashboard/sabflow/connections" className="aspect-square p-2 text-center cursor-pointer hover:bg-accent flex flex-col items-center justify-center border-dashed border-2 rounded-lg transition-colors">
                                                             <Plus className="h-6 w-6 text-muted-foreground"/>
                                                             <p className="text-xs mt-1">Add App</p>
                                                         </Link>
                                                     </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => handleNodeChange(selectedNode.id, {connectionId: '', actionName: '', inputs: {}})}>
                                                            <ArrowLeft className="mr-2 h-4 w-4"/> Change App
                                                        </Button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Action</Label>
                                                        <Select value={selectedNode.data.actionName} onValueChange={val => handleNodeChange(selectedNode.id, { actionName: val, inputs: {} })}>
                                                            <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                                                            <SelectContent>
                                                                {selectedApp?.actions.map((action: any) => (<SelectItem key={action.name} value={action.name}>{action.label}</SelectItem>))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>

                                {selectedAction && (
                                     <div className="space-y-4 pt-4 border-t">
                                        <h4 className="font-semibold">{selectedAction.label}</h4>
                                        <p className="text-sm text-muted-foreground">{selectedAction.description}</p>
                                        {selectedAction.inputs.map((input: any) => (<div key={input.name} className="space-y-2"><Label>{input.label}</Label><NodeInput input={input} value={selectedNode.data.inputs[input.name]} onChange={val => handleNodeChange(selectedNode.id, { inputs: {...selectedNode.data.inputs, [input.name]: val} })}/></div>))}
                                    </div>
                                )}

                                {isCondition && (
                                    <>
                                        <div className="space-y-2"><Label>Logic</Label><RadioGroup value={selectedNode.data.logicType || 'AND'} onValueChange={(val) => handleNodeChange(selectedNode.id, { logicType: val })} className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="AND" id="logic-and"/><Label htmlFor="logic-and">AND</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="OR" id="logic-or"/><Label htmlFor="logic-or">OR</Label></div></RadioGroup></div>
                                        {(selectedNode.data.rules || []).map((rule: any, index: number) => (<div key={index} className="p-2 border rounded space-y-2"><Input placeholder="Variable e.g. {{trigger.name}}" value={rule.field} onChange={e => { const r = [...selectedNode.data.rules]; r[index].field=e.target.value; handleNodeChange(selectedNode.id, {rules: r})}} /><Select value={rule.operator} onValueChange={val => { const r = [...selectedNode.data.rules]; r[index].operator=val; handleNodeChange(selectedNode.id, {rules: r})}}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="equals">Equals</SelectItem><SelectItem value="not_equals">Not Equals</SelectItem><SelectItem value="contains">Contains</SelectItem></SelectContent></Select><Input placeholder="Value" value={rule.value} onChange={e => { const r = [...selectedNode.data.rules]; r[index].value=e.target.value; handleNodeChange(selectedNode.id, {rules: r})}}/></div>))}
                                        <Button variant="outline" size="sm" onClick={() => handleNodeChange(selectedNode.id, { rules: [...(selectedNode.data.rules || []), {field: '', operator: 'equals', value: ''}]})}><Plus className="mr-2 h-4 w-4"/>Add Rule</Button>
                                    </>
                                )}
                            </TabsContent>
                             <TabsContent value="connections" className="p-4">
                                 <Link href="/dashboard/sabflow/connections">
                                    <Button variant="outline" className="w-full">Manage App Connections</Button>
                                 </Link>
                            </TabsContent>
                        </ScrollArea>
                    </div>
                </Tabs>
                 {selectedNode?.type !== 'trigger' && (
                    <div className="p-4 border-t flex-shrink-0">
                        <Button variant="destructive" className="w-full" onClick={() => handleRemoveNode(selectedNode.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Step
                        </Button>
                    </div>
                )}
            </div>
        );
    };
    
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
                        className="flex-1 w-full h-full overflow-hidden relative cursor-grab active:cursor-grabbing sabflow-builder-container"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onWheel={handleWheel}
                        onClick={handleCanvasClick}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.4) 1px, transparent 0)', backgroundSize: '20px 20px', backgroundPosition: `${pan.x}px ${pan.y}px` }}/>
                        <div className="relative w-full h-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
                            <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '10000px', height: '10000px' }}>
                                <defs>
                                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                                        <polygon points="0 0, 10 3.5, 0 7" fill="hsla(215, 89%, 48%, 0.5)" />
                                    </marker>
                                </defs>
                                {edges.map(edge => {
                                    const sourceNode = nodes.find(n => n.id === edge.source);
                                    const targetNode = nodes.find(n => n.id === edge.target);
                                    if(!sourceNode || !targetNode) return null;
                                    const sourcePos = getNodeHandlePosition(sourceNode, edge.sourceHandle || `${edge.source}-output-main`);
                                    const targetPos = getNodeHandlePosition(targetNode, edge.targetHandle || `${edge.target}-input`);
                                    if (!sourcePos || !targetPos) return null;
                                    return <path key={edge.id} d={getEdgePath(sourcePos, targetPos)} stroke="hsla(215, 89%, 48%, 0.5)" strokeWidth="2" fill="none" strokeDasharray="8 8" className="sabflow-edge-path" markerEnd="url(#arrowhead)" />
                                })}
                                {connecting && (
                                    <path d={getEdgePath(connecting.startPos, mousePosition)} stroke="hsla(215, 89%, 48%, 0.5)" strokeWidth="2" fill="none" strokeDasharray="8 8" className="sabflow-edge-path" markerEnd="url(#arrowhead)" />
                                )}
                            </svg>
                            {nodes.map(node => {
                                const app = user?.sabFlowConnections?.find((c: any) => c.connectionName === node.data.connectionId);
                                const appConfig = sabnodeAppActions.find(a => a.appId === app?.appId);
                                const Icon = node.type === 'trigger'
                                    ? triggers.find(t => t.id === node.data.triggerType)?.icon || Zap
                                    : appConfig?.icon || (node.type === 'condition' ? GitFork : Zap);
                                
                                return (
                                    <div key={node.id} className="absolute transition-all text-center" style={{left: node.position.x, top: node.position.y}} onMouseDown={e => handleNodeMouseDown(e, node.id)} onClick={e => {e.stopPropagation(); setSelectedNodeId(node.id)}} onContextMenu={(e) => handleNodeContextMenu(e, node.id)}>
                                        <div className={cn("w-32 h-32 rounded-[40px] cursor-pointer flex flex-col items-center justify-center p-4 bg-white", selectedNodeId === node.id && 'ring-2 ring-primary')} style={{filter: 'drop-shadow(rgba(0, 0, 0, 0.25) 0px 5px 6px)'}}>
                                            <div className={cn("w-16 h-16 rounded-full flex items-center justify-center", appConfig?.bgColor)}>
                                                <Icon className={cn("h-8 w-8", appConfig?.iconColor || 'text-gray-400')}/>
                                            </div>
                                        </div>
                                        <p className="font-bold text-xs mt-2 text-black">{node.data.name}</p>

                                        {node.type !== 'trigger' && <div id={`${node.id}-input`} data-handle-pos="left" className="absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 -left-2 top-1/2 -translate-y-1/2" onClick={e => handleHandleClick(e, node.id, `${node.id}-input`)} />}
                                        {node.type === 'condition' ? (
                                            <>
                                                <div id={`${node.id}-output-yes`} data-handle-pos="right" className="absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 -right-2 top-1/3 -translate-y-1/2" onClick={e => handleHandleClick(e, node.id, `${node.id}-output-yes`)} />
                                                <div id={`${node.id}-output-no`} data-handle-pos="right" className="absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 -right-2 top-2/3 -translate-y-1/2" onClick={e => handleHandleClick(e, node.id, `${node.id}-output-no`)} />
                                            </>
                                        ) : (
                                            <div id={`${node.id}-output-main`} data-handle-pos="right" className="absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 -right-2 top-1/2 -translate-y-1/2" onClick={e => handleHandleClick(e, node.id, `${node.id}-output-main`)} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        {contextMenu && (
                            <Card className="absolute p-1" style={{ top: contextMenu.y, left: contextMenu.x }}>
                                <CardContent className="p-0">
                                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { handleCopyNode(contextMenu.nodeId); setContextMenu(null); }}><Copy className="mr-2 h-4 w-4"/>Copy</Button>
                                <Button variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => { handleRemoveNode(contextMenu.nodeId); setContextMenu(null); }}><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
                                </CardContent>
                            </Card>
                        )}
                        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('out')}><ZoomOut className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('in')}><ZoomIn className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('reset')}><Frame className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={handleToggleFullScreen}>{isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button>
                        </div>
                         <div className="fixed bottom-[17px] left-4 z-10">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button size="icon" className="rounded-full h-12 w-12 shadow-lg">
                                        <Plus className="h-6 w-6" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-2 data-[side=top]:-translate-y-2" side="top" align="start">
                                    <div className="space-y-1">
                                        <Button variant="ghost" className="w-full justify-start" onClick={() => handleAddNode('action')}><Zap className="mr-2 h-4 w-4" />Action</Button>
                                        <Button variant="ghost" className="w-full justify-start" onClick={() => handleAddNode('condition')}><GitFork className="mr-2 h-4 w-4" />Condition</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </main>
                    <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                        <SheetContent className="w-full max-w-sm p-0 flex flex-col">
                            {renderPropertiesPanel()}
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </form>
    </div>
    );
}
