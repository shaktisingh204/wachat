
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
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CodeBlock } from '@/components/wabasimplify/code-block';

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
  Frame
} from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow-actions';
import { cn } from '@/lib/utils';


const initialState = { message: null, error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Flow
    </Button>
  );
}

const triggers = [
    { id: 'webhook', name: 'Webhook Received', icon: Zap },
    { id: 'app_event', name: 'App Event', icon: PlayCircle },
];

const NODE_WIDTH = 288; // 72 in tailwind scale
const NODE_HEIGHT = 88; // 22 in tailwind scale

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
        return { x, y: y + NODE_HEIGHT / 2 };
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
        <div className="flex h-[calc(100vh-theme(spacing.24))] bg-muted/30">
            <Skeleton className="w-64 bg-background border-r" />
            <div className="flex-1 flex flex-col">
                <Skeleton className="h-16 border-b bg-card" />
                <div className="flex-1 grid grid-cols-12">
                    <Skeleton className="col-span-9" />
                    <Skeleton className="col-span-3 bg-background border-l" />
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

    // Canvas state
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<{ sourceNodeId: string; sourceHandleId: string; startPos: { x: number; y: number } } | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isFullScreen, setIsFullScreen] = useState(false);

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
        } else {
            getSabFlowById(flowId).then(flow => {
                if(flow) {
                    setFlowName(flow.name);
                    setTrigger(flow.trigger);
                    setNodes(flow.nodes.length > 0 ? flow.nodes : [{ id: 'trigger', type: 'trigger', data: { name: 'Start Flow', triggerType: 'webhook' }, position: { x: 50, y: 150 } }]);
                    setEdges(flow.edges);
                } else {
                    // If flow doesn't exist, start a new one but keep the URL for saving
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

    const handleNodeChange = (nodeId: string, data: any) => {
        setNodes(nodes.map(n => n.id === nodeId ? {...n, data: {...n.data, ...data}} : n));
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => { e.preventDefault(); e.stopPropagation(); setDraggingNode(nodeId); };
    const handleCanvasMouseDown = (e: React.MouseEvent) => { if (e.target === e.currentTarget) { e.preventDefault(); setIsPanning(true); } };
    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        else if (draggingNode) setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, position: { x: n.position.x + e.movementX / zoom, y: n.position.y + e.movementY / zoom } } : n));
        if (connecting && viewportRef.current) { const rect = viewportRef.current.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; setMousePosition({ x: (mouseX - pan.x) / zoom, y: (mouseY - pan.y) / zoom }); }
    };
    const handleCanvasMouseUp = () => { setIsPanning(false); setDraggingNode(null); };
    const handleCanvasClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) { if (connecting) setConnecting(null); else setSelectedNodeId(null); }};

    const handleHandleClick = (e: React.MouseEvent, nodeId: string, handleId: string) => {
        e.preventDefault(); e.stopPropagation();
        if (!viewportRef.current) return;
        const isOutputHandle = handleId.includes('output');
        if (isOutputHandle) { const sourceNode = nodes.find(n => n.id === nodeId); if(sourceNode){ const handlePos = getNodeHandlePosition(sourceNode, handleId); if (handlePos) setConnecting({ sourceNodeId: nodeId, sourceHandleId: handleId, startPos: handlePos });}}
        else if (connecting && !isOutputHandle) {
            if (connecting.sourceNodeId === nodeId) { setConnecting(null); return; }
            const newEdge: SabFlowEdge = { id: `edge-${connecting.sourceNodeId}-${nodeId}-${connecting.sourceHandleId}-${handleId}`, source: connecting.sourceNodeId, target: nodeId, sourceHandle: connecting.sourceHandleId, targetHandle: handleId };
            const edgesWithoutExistingSource = edges.filter(e => e.sourceHandle !== connecting.sourceHandleId);
            setEdges([...edgesWithoutExistingSource, newEdge]);
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
        const newZoom = Math.max(0.2, Math.min(2, zoom + e.deltaY * zoomFactor));
        
        const worldX = (mouseX - pan.x) / zoom;
        const worldY = (mouseY - pan.y) / zoom;
        
        const newPanX = mouseX - worldX * newZoom;
        const newPanY = mouseY - worldY * newZoom;
    
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
    };

    const handleZoomControls = (direction: 'in' | 'out' | 'reset') => {
        if(direction === 'reset') { setZoom(1); setPan({ x: 0, y: 0 }); return; }
        setZoom(prevZoom => Math.max(0.2, Math.min(2, direction === 'in' ? prevZoom * 1.2 : prevZoom / 1.2)));
    };

    const handleToggleFullScreen = () => {
        if (!document.fullscreenElement) { viewportRef.current?.requestFullscreen().catch(err => { alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`); }); } 
        else { document.exitFullscreen?.(); }
    };

    useEffect(() => {
        const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);
    
    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    const selectedApp = user?.sabFlowConnections?.find((c: any) => c.connectionName === selectedNode?.data.connectionId);
    const selectedAppActions = sabnodeAppActions.find(app => app.appId === selectedApp?.appId)?.actions || [];
    const selectedAction = selectedAppActions.find(a => a.name === selectedNode?.data.actionName);

     if (isLoading) {
        return <BuilderPageSkeleton />;
    }
    
    return (
        <form action={formAction} ref={formRef}>
            <input type="hidden" name="flowId" value={isNew ? 'new' : flowId} />
            <input type="hidden" name="name" value={flowName} />
            <input type="hidden" name="trigger" value={JSON.stringify(trigger)} />
            <input type="hidden" name="nodes" value={JSON.stringify(nodes)} />
            <input type="hidden" name="edges" value={JSON.stringify(edges)} />
            
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetContent className="w-full max-w-sm p-0">
                    {/* Sidebar Content Here */}
                </SheetContent>
            </Sheet>

            <div className="flex flex-col h-[calc(100vh-theme(spacing.24))]">
                <header className="flex-shrink-0 flex items-center justify-between p-3 bg-card border-b">
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
                 <div className="flex-1 grid grid-cols-12 overflow-hidden">
                    <aside className="col-span-3 border-r bg-background p-4 space-y-4">
                        <h2 className="font-semibold text-lg">Blocks</h2>
                         <Button variant="outline" className="w-full justify-start" onClick={() => handleAddNode('action')}><Plus className="mr-2 h-4 w-4"/>Action</Button>
                         <Button variant="outline" className="w-full justify-start" disabled><GitFork className="mr-2 h-4 w-4"/>Condition (Coming Soon)</Button>
                    </aside>
                    <main 
                        ref={viewportRef}
                        className="col-span-6 relative overflow-hidden cursor-grab active:cursor-grabbing"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onWheel={handleWheel}
                        onClick={handleCanvasClick}
                    >
                         <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.4) 1px, transparent 0)', backgroundSize: '20px 20px', backgroundPosition: `${pan.x}px ${pan.y}px` }}/>
                          <div className="relative w-full h-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
                            {nodes.map(node => {
                                const Icon = triggers.find(t => t.id === node.data.triggerType)?.icon || sabnodeAppActions.find(app => app.appId === user?.sabFlowConnections?.find((c: any) => c.connectionName === node.data.connectionId)?.appId)?.icon || GitFork;
                                return (
                                    <div key={node.id} className="absolute" style={{left: node.position.x, top: node.position.y}} onMouseDown={e => handleNodeMouseDown(e, node.id)} onClick={e => {e.stopPropagation(); setSelectedNodeId(node.id)}}>
                                        <Card className={`w-72 hover:shadow-lg transition-shadow ${selectedNodeId === node.id ? 'ring-2 ring-primary' : ''}`}>
                                            <CardHeader className="flex flex-row items-center gap-3 p-3">
                                                <div className="p-2 bg-muted rounded-md"><Icon className="h-5 w-5 text-muted-foreground"/></div>
                                                <CardTitle className="text-sm font-medium">{node.data.name}</CardTitle>
                                            </CardHeader>
                                        </Card>
                                        <div id={`${node.id}-input`} data-handle-pos="left" className="absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 -left-2 top-1/2 -translate-y-1/2" onClick={e => handleHandleClick(e, node.id, `${node.id}-input`)} />
                                        <div id={`${node.id}-output-main`} data-handle-pos="right" className="absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 -right-2 top-1/2 -translate-y-1/2" onClick={e => handleHandleClick(e, node.id, `${node.id}-output-main`)} />
                                    </div>
                                )
                            })}
                             <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '5000px', height: '5000px', transformOrigin: 'top left' }}>
                                {edges.map(edge => {
                                    const sourceNode = nodes.find(n => n.id === edge.source);
                                    const targetNode = nodes.find(n => n.id === edge.target);
                                    if(!sourceNode || !targetNode) return null;
                                    const sourcePos = getNodeHandlePosition(sourceNode, edge.sourceHandle || `${edge.source}-output-main`);
                                    const targetPos = getNodeHandlePosition(targetNode, edge.targetHandle || `${edge.target}-input`);
                                    if (!sourcePos || !targetPos) return null;
                                    return <path key={edge.id} d={getEdgePath(sourcePos, targetPos)} stroke="hsl(var(--border))" strokeWidth="2" fill="none" />
                                })}
                                {connecting && (
                                    <path d={getEdgePath(connecting.startPos, mousePosition)} stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeDasharray="5,5" />
                                )}
                            </svg>
                        </div>
                          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('out')}><ZoomOut className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('in')}><ZoomIn className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('reset')}><Frame className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={handleToggleFullScreen}>{isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button>
                        </div>
                    </main>
                    <aside className="col-span-3 border-l bg-background p-4 overflow-y-auto">
                        {selectedNode ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center"><h3 className="text-lg font-semibold">Properties</h3> <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveNode(selectedNode.id)}><Trash2 className="h-4 w-4"/></Button></div>
                                <div className="space-y-2"><Label>Step Name</Label><Input value={selectedNode.data.name} onChange={e => handleNodeChange(selectedNode.id, { name: e.target.value })}/></div>
                                {selectedNode.type === 'trigger' && (<div className="space-y-2"><Label>Trigger Type</Label><Select value={selectedNode.data.triggerType} onValueChange={val => { handleNodeChange(selectedNode.id, {triggerType: val}); setTrigger(prev => ({...prev, type: val})); }}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{triggers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>)}
                                {selectedNode.type === 'trigger' && trigger.type === 'webhook' && (<div className="space-y-2"><Label>Webhook URL</Label><CodeBlock code={`${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${isNew ? '[Save Flow to Generate URL]' : flowId}`}/></div>)}
                                {selectedNode.type === 'action' && (<>
                                    <div className="space-y-2"><Label>App</Label><Select value={selectedNode.data.connectionId} onValueChange={val => handleNodeChange(selectedNode.id, { connectionId: val, actionName: '', inputs: {} })}><SelectTrigger><SelectValue placeholder="Select an app..."/></SelectTrigger><SelectContent>{(user?.sabFlowConnections || []).map((conn: any) => (<SelectItem key={conn.connectionName} value={conn.connectionName}>{conn.connectionName}</SelectItem>))}</SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Action</Label><Select value={selectedNode.data.actionName} onValueChange={val => handleNodeChange(selectedNode.id, { actionName: val, inputs: {} })}><SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger><SelectContent>{selectedAppActions.map((action: any) => (<SelectItem key={action.name} value={action.name}>{action.label}</SelectItem>))}</SelectContent></Select></div>
                                    {selectedAction && selectedAction.inputs.map((input: any) => (<div key={input.name} className="space-y-2"><Label>{input.label}</Label><NodeInput input={input} value={selectedNode.data.inputs[input.name]} onChange={val => handleNodeChange(selectedNode.id, { inputs: {...selectedNode.data.inputs, [input.name]: val} })}/></div>))}
                                </>)}
                            </div>
                        ) : (<div className="text-center text-muted-foreground p-8">Select a step to configure it.</div>)}
                    </aside>
                </div>
            </div>
        </form>
    );
}
