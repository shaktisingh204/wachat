
'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getFlowsForProject, getFlowById, saveFlow, deleteFlow } from '@/app/actions/flow.actions';
import type { Project, Flow, FlowNode, FlowEdge } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, ToggleRight, GitFork, Play, Trash2, Save, Plus, Type, LoaderCircle, BookOpen, PanelLeft, Settings2, Copy, File as FileIcon, ZoomIn, ZoomOut, Frame, Maximize, Minimize, ImageIcon, Clock, Code, Send, Bot, Mail, Smartphone, UserPlus, QrCode, Link as LinkIcon
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useProject } from '@/context/project-context';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { TestFlowDialog } from '@/components/wabasimplify/test-flow-dialog';
import { generateFlowBuilderFlow } from '@/ai/flows/generate-flow-builder-flow';
import { PropertiesPanel } from '@/components/wabasimplify/properties-panel';

type NodeType = 'start' | 'text' | 'buttons' | 'input' | 'image' | 'delay' | 'condition' | 'api' | 'sendTemplate' | 'triggerMetaFlow' | 'triggerFlow' | 'sendSms' | 'sendEmail' | 'createCrmLead' | 'generateShortLink' | 'generateQrCode';
type ButtonConfig = { id: string; text: string; };

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'condition', label: 'Condition', icon: GitFork },
    { type: 'api', label: 'Call API', icon: Code },
    { type: 'sendTemplate', label: 'Send Template', icon: Send },
    { type: 'triggerMetaFlow', label: 'Trigger Meta Flow', icon: Bot },
    { type: 'sendSms', label: 'Send SMS', icon: Smartphone },
    { type: 'sendEmail', label: 'Send Email', icon: Mail },
    { type: 'createCrmLead', label: 'Create CRM Lead', icon: UserPlus },
    { type: 'generateShortLink', label: 'Create Short Link', icon: LinkIcon },
    { type: 'generateQrCode', label: 'Generate QR Code', icon: QrCode },
];

const NodePreview = ({ node }: { node: FlowNode }) => {
    // ... implementation for previewing node content ...
    return null;
};

const NodeComponent = ({ node, onSelectNode, isSelected, onNodeMouseDown, onHandleClick }: { node: FlowNode; onSelectNode: (id: string) => void; isSelected: boolean; onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void; onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string) => void;}) => {
    const BlockIcon = [...blockTypes, {type: 'start', label: 'Start', icon: Play}].find(b => b.type === node.type)?.icon || MessageSquare;

    const Handle = ({ position, id, style }: { position: 'left' | 'right' | 'top' | 'bottom', id: string, style?: React.CSSProperties }) => (
        <div id={id} data-handle-pos={position} style={style} className={cn("absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10", position === 'left' && "-left-2 top-1/2 -translate-y-1/2", position === 'right' && "-right-2")} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onHandleClick(e, node.id, id); }} />
    );

    return (
        <div className="absolute cursor-grab active:cursor-grabbing transition-all" style={{ top: node.position.y, left: node.position.x }} onMouseDown={(e) => onNodeMouseDown(e, node.id)} onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }}>
            <Card className={cn("w-64 hover:shadow-xl hover:-translate-y-1 bg-card", isSelected && "ring-2 ring-primary shadow-2xl")}>
                <CardHeader className="flex flex-row items-center gap-3 p-3"><BlockIcon className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-sm font-medium">{node.data.label}</CardTitle></CardHeader>
                <NodePreview node={node} />
                 {node.type === 'condition' && ( <CardContent className="p-3 pt-0 text-xs text-muted-foreground"><div className="flex justify-between items-center"><span>Yes</span></div><Separator className="my-1"/><div className="flex justify-between items-center"><span>No</span></div></CardContent>)}
            </Card>
            {node.type !== 'start' && <Handle position="left" id={`${node.id}-input`} style={{top: '50%', transform: 'translateY(-50%)'}} />}
            {node.type === 'condition' ? ( <> <Handle position="right" id={`${node.id}-output-yes`} style={{ top: '33.33%', transform: 'translateY(-50%)' }} /> <Handle position="right" id={`${node.id}-output-no`} style={{ top: '66.67%', transform: 'translateY(-50%)' }} /></>) : node.type === 'buttons' ? ((node.data.buttons || []).map((btn: ButtonConfig, index: number) => { const totalButtons = (node.data.buttons || []).length; const topPosition = totalButtons > 1 ? `${(100 / (totalButtons + 1)) * (index + 1)}%` : '50%'; return <Handle key={btn.id || index} position="right" id={`${node.id}-btn-${index}`} style={{ top: topPosition, transform: 'translateY(-50%)' }} />; })) : ( <Handle position="right" id={`${node.id}-output-main`} style={{top: '50%', transform: 'translateY(-50%)'}} />)}
        </div>
    );
};

export function FlowBuilder() {
    const { activeProjectId } = useProject();
    const { toast } = useToast();
    const [flows, setFlows] = useState<WithId<Flow>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<Flow> | null>(null);
    const [nodes, setNodes] = useState<FlowNode[]>([]);
    const [edges, setEdges] = useState<FlowEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
    
    // AI Generation
    const [prompt, setPrompt] = useState('');
    const [isGenerating, startGeneration] = useTransition();

    const [isBlocksSheetOpen, setIsBlocksSheetOpen] = useState(false);
    const [isPropsSheetOpen, setIsPropsSheetOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Canvas state
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<{ sourceNodeId: string; sourceHandleId: string; startPos: { x: number; y: number } } | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isFullScreen, setIsFullScreen] = useState(false);

    const fetchFlows = useCallback(() => {
        if(activeProjectId) {
            startLoadingTransition(async () => {
                const flowsData = await getFlowsForProject(activeProjectId);
                setFlows(flowsData);
                if (flowsData.length > 0 && !currentFlow) {
                    handleSelectFlow(flowsData[0]._id.toString());
                } else if (flowsData.length === 0) {
                    handleCreateNewFlow();
                }
            });
        }
    }, [activeProjectId, currentFlow]);

    useEffect(() => {
        fetchFlows();
    }, [fetchFlows]);

    const handleSelectFlow = async (flowId: string) => {
        const flow = await getFlowById(flowId);
        setCurrentFlow(flow);
        setNodes(flow?.nodes || []);
        setEdges(flow?.edges || []);
        setSelectedNodeId(null);
        setIsBlocksSheetOpen(false);
    }
    
    const handleCreateNewFlow = () => {
        setCurrentFlow(null);
        setNodes([{ id: 'start', type: 'start', data: { label: 'Start Flow' }, position: { x: 50, y: 150 } }]);
        setEdges([]);
        setSelectedNodeId('start');
    }

    const addNode = (type: NodeType) => {
        const centerOfViewX = viewportRef.current ? (viewportRef.current.clientWidth / 2 - pan.x) / zoom : 300;
        const centerOfViewY = viewportRef.current ? (viewportRef.current.clientHeight / 2 - pan.y) / zoom : 150;
        const newNode: FlowNode = {
            id: `${type}-${Date.now()}`, type, data: { label: `New ${type}`, apiRequest: { method: 'GET', url: '', headers: '', body: '', responseMappings: [] } }, position: { x: centerOfViewX, y: centerOfViewY },
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
        setIsBlocksSheetOpen(false);
    };

    const updateNodeData = (id: string, data: Partial<any>) => {
        setNodes(prev => prev.map(node => 
            node.id === id ? { ...node, data: { ...node.data, ...data } } : node
        ));
    };

    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(node => node.id !== id));
        setEdges(prev => prev.filter(edge => edge.source !== id && edge.target !== id));
        if (selectedNodeId === id) setSelectedNodeId(null);
        setIsPropsSheetOpen(false);
    };

    const handleSaveFlow = async () => {
        if (!activeProjectId) return;
        const flowName = (document.getElementById('flow-name-input') as HTMLInputElement)?.value;
        if (!flowName) return;
        const startNode = nodes.find(n => n.type === 'start');
        const triggerKeywords = startNode?.data.triggerKeywords?.split(',').map((k:string) => k.trim()).filter(Boolean) || [];

        startSaveTransition(async () => {
             const result = await saveFlow({
                flowId: currentFlow?._id.toString(),
                projectId: activeProjectId,
                name: flowName,
                nodes,
                edges,
                triggerKeywords,
            });
            if(result.error) toast({title: "Error", description: result.error, variant: 'destructive'});
            else {
                toast({title: "Success", description: result.message});
                if(result.flowId) {
                    await handleSelectFlow(result.flowId);
                }
                fetchFlows();
            }
        });
    }

    const handleDeleteFlow = async (flowId: string) => {
        const result = await deleteFlow(flowId);
        if(result.error) toast({title: "Error", description: result.error, variant: 'destructive'});
        else {
            toast({title: "Success", description: result.message});
            fetchFlows();
            if(currentFlow?._id.toString() === flowId) {
                handleCreateNewFlow();
            }
        }
    }
    
    const handleFlowGenerated = (newNodes: FlowNode[], newEdges: FlowEdge[]) => {
        setCurrentFlow(null);
        setNodes(newNodes);
        setEdges(newEdges);
        setSelectedNodeId(null);
        toast({title: "Flow Generated!", description: "Your new workflow is ready to be configured."});
    };

    const handleGenerateClick = () => {
        if (!prompt.trim()) return;
        startGeneration(async () => {
            const result = await generateFlowBuilderFlow({ prompt });
            handleFlowGenerated(result.nodes, result.edges);
            setPrompt('');
        });
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
        const isOutputHandle = handleId.includes('output') || handleId.includes('-btn-');
        if (isOutputHandle) { const sourceNode = nodes.find(n => n.id === nodeId); if(sourceNode){ const handlePos = getNodeHandlePosition(sourceNode, handleId); if (handlePos) setConnecting({ sourceNodeId: nodeId, sourceHandleId: handleId, startPos: handlePos });}}
        else if (connecting && !isOutputHandle) {
            if (connecting.sourceNodeId === nodeId) { setConnecting(null); return; }
            const newEdge: FlowEdge = { id: `edge-${connecting.sourceNodeId}-${nodeId}-${connecting.sourceHandleId}-${handleId}`, source: connecting.sourceNodeId, target: nodeId, sourceHandle: connecting.sourceHandleId, targetHandle: handleId };
            const edgesWithoutExistingTarget = edges.filter(edge => !(edge.target === nodeId && edge.targetHandle === handleId));
            const sourceHasSingleOutput = !connecting.sourceHandleId.includes('btn-') && !connecting.sourceHandleId.includes('output-yes') && !connecting.sourceHandleId.includes('output-no');
            if (sourceHasSingleOutput) { const edgesWithoutExistingSource = edgesWithoutExistingTarget.filter(e => e.source !== connecting.sourceNodeId); setEdges([...edgesWithoutExistingSource, newEdge]); } else { setEdges([...edgesWithoutExistingTarget, newEdge]); }
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

    useEffect(() => {
        if (selectedNodeId) {
            setIsPropsSheetOpen(true);
        }
    }, [selectedNodeId]);

    const handleZoomControls = (direction: 'in' | 'out' | 'reset') => {
        if(direction === 'reset') {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            return;
        }
        setZoom(prevZoom => {
            const newZoom = direction === 'in' ? prevZoom * 1.2 : prevZoom / 1.2;
            return Math.max(0.2, Math.min(2, newZoom));
        });
    };

    const handleToggleFullScreen = () => {
        if (!document.fullscreenElement) {
            viewportRef.current?.requestFullscreen().catch(err => {
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
    
    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    
    const FlowsAndBlocksPanel = ({ 
        isLoading, flows, currentFlow, handleSelectFlow, handleDeleteFlow, handleCreateNewFlow, addNode 
    } : {
        isLoading: boolean; flows: WithId<Flow>[]; currentFlow: WithId<Flow> | null; handleSelectFlow: (id: string) => void; handleDeleteFlow: (id: string) => void; handleCreateNewFlow: () => void; addNode: (type: NodeType) => void;
    }) => (
        <>
            <Card>
                <CardHeader className="flex-row items-center justify-between p-3">
                    <CardTitle className="text-base">Flows</CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateNewFlow}><Plus/></Button>
                </CardHeader>
                <CardContent className="p-2 pt-0">
                    <ScrollArea className="h-40">
                        {isLoading && flows.length === 0 ? <Skeleton className="h-full w-full"/> : 
                            flows.map(flow => (
                                <div key={flow._id.toString()} className="flex items-center group">
                                    <Button variant="ghost" className={cn("w-full justify-start font-normal", currentFlow?._id.toString() === flow._id.toString() && 'bg-muted font-semibold')} onClick={() => handleSelectFlow(flow._id.toString())}>
                                        <FileIcon className="mr-2 h-4 w-4"/>
                                        {flow.name}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteFlow(flow._id.toString())}>
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            ))
                        }
                    </ScrollArea>
                </CardContent>
            </Card>
            <Card className="flex-1 flex flex-col">
                <CardHeader className="p-3"><CardTitle className="text-base">Blocks</CardTitle></CardHeader>
                <CardContent className="space-y-2 p-2 pt-0 flex-1 min-h-0">
                    <ScrollArea className="h-full">
                        {blockTypes.map(({ type, label, icon: Icon }) => (
                            <Button key={type} variant="outline" className="w-full justify-start mb-2" onClick={() => addNode(type as NodeType)}>
                                <Icon className="mr-2 h-4 w-4" />
                                {label}
                            </Button>
                        ))}
                    </ScrollArea>
                </CardContent>
            </Card>
        </>
    );

    const NODE_WIDTH = 256;
    const NODE_HEIGHT = 100;
    
    const getEdgePath = (sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
        if (!sourcePos || !targetPos) return '';
        const dx = Math.abs(sourcePos.x - targetPos.x) * 0.5;
        const path = `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + dx} ${sourcePos.y}, ${targetPos.x - dx} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
        return path;
    };
    
    const getNodeHandlePosition = (node: FlowNode, handleId: string) => {
        if (!node || !handleId) return null;
    
        const x = node.position.x;
        const y = node.position.y;
        
        let nodeHeight = 60;
        
        if (node.type === 'condition') nodeHeight = 80;
        if (node.type === 'buttons') {
            const buttonCount = (node.data.buttons || []).length;
            nodeHeight = 60 + (buttonCount * 20);
        }
    
        if (handleId.endsWith('-input')) {
            return { x: x, y: y + 30 };
        }
        if (handleId.endsWith('-output-main')) {
            return { x: x + NODE_WIDTH, y: y + 30 };
        }
        if (handleId.endsWith('-output-yes')) {
            return { x: x + NODE_WIDTH, y: y + nodeHeight * (1/3) };
        }
        if (handleId.endsWith('-output-no')) {
            return { x: x + NODE_WIDTH, y: y + nodeHeight * (2/3) };
        }
        if (handleId.includes('-btn-')) {
            const buttonIndex = parseInt(handleId.split('-btn-')[1], 10);
            const totalButtons = (node.data.buttons || []).length;
            const topPosition = totalButtons > 1 ? (60 + (nodeHeight - 60) / (totalButtons + 1) * (buttonIndex + 1)) : 60 + (nodeHeight - 60) / 2;
            return { x: x + NODE_WIDTH, y: y + topPosition };
        }
        if (handleId.includes('output')) {
            return { x: x + NODE_WIDTH, y: y + 30 };
        }
        
        return null;
    }


    if (!activeProjectId) {
         return (
             <div className="h-full flex items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to use the Flow Builder.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    return (
        <div className="flex h-[calc(100vh-theme(spacing.20))] bg-muted/30">
             <div className={cn("flex-col gap-4 p-2 bg-background border-r transition-all duration-300", isSidebarCollapsed ? 'hidden' : 'hidden md:flex md:w-64')}>
                <FlowsAndBlocksPanel {...{ isLoading, flows, currentFlow, handleSelectFlow, handleDeleteFlow, handleCreateNewFlow, addNode }} />
            </div>
            <div className="flex-1 flex flex-col relative">
                 <header className="flex-shrink-0 flex items-center justify-between p-3 bg-card border-b">
                     <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsBlocksSheetOpen(true)}>
                            <PanelLeft className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                            <PanelLeft className="h-5 w-5" />
                        </Button>
                        <Input id="flow-name-input" key={currentFlow?._id.toString()} defaultValue={currentFlow?.name || 'New Flow'} className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsTestDialogOpen(true)} disabled={isLoading}><Play className="mr-2 h-4 w-4"/>Test</Button>
                        <Button variant="outline" size="sm" asChild><Link href="/dashboard/flow-builder/docs"><BookOpen className="mr-2 h-4 w-4"/>Docs</Link></Button>
                        <Button onClick={handleSaveFlow} disabled={isSaving}>
                            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                            Save
                        </Button>
                        <Sheet open={isPropsSheetOpen} onOpenChange={setIsPropsSheetOpen}>
                             <SheetTrigger asChild>
                                <Button variant="outline" size="icon" className="md:hidden" disabled={!selectedNode}><Settings2 className="h-5 w-5" /></Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="p-0 flex flex-col"><SheetTitle className="sr-only">Properties</SheetTitle><SheetDescription className="sr-only">Configure the selected block.</SheetDescription>{selectedNode && <PropertiesPanel selectedNode={selectedNode} updateNodeData={updateNodeData} deleteNode={deleteNode} />}</SheetContent>
                        </Sheet>
                    </div>
                 </header>
                 <main className="flex-1 grid grid-cols-12 overflow-hidden">
                    <Card
                        ref={viewportRef}
                        className="col-span-12 md:col-span-9 h-full w-full overflow-hidden relative cursor-grab active:cursor-grabbing rounded-none border-0 border-r"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onWheel={handleWheel}
                        onClick={handleCanvasClick}
                    >
                        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.4) 1px, transparent 0)', backgroundSize: '20px 20px', backgroundPosition: `${pan.x}px ${pan.y}px` }}/>
                        <div className="relative w-full h-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
                            {isLoading && !currentFlow ? (<div className="absolute inset-0 flex items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>) : (
                                <>
                                    {nodes.map(node => (<NodeComponent key={node.id} node={node} onSelectNode={setSelectedNodeId} isSelected={selectedNodeId === node.id} onNodeMouseDown={handleNodeMouseDown} onHandleClick={handleHandleClick}/>))}
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
                                </>
                            )}
                        </div>
                        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('out')}><ZoomOut className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('in')}><ZoomIn className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('reset')}><Frame className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={handleToggleFullScreen}>{isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button>
                        </div>
                    </Card>
                    <aside className="hidden md:block col-span-3 bg-background p-4 overflow-y-auto">
                        {selectedNode && <PropertiesPanel selectedNode={selectedNode} updateNodeData={updateNodeData} deleteNode={deleteNode} />}
                    </aside>
                 </main>
                  <Card className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-lg shadow-2xl">
                    <CardContent className="p-2">
                        <div className="flex items-center gap-2">
                            <Input placeholder="Describe your workflow and let AI build it..." className="border-none shadow-none focus-visible:ring-0" value={prompt} onChange={e => setPrompt(e.target.value)} />
                            <Button onClick={handleGenerateClick} disabled={isGenerating || !prompt.trim()}>
                                {isGenerating && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>} Generate
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <Sheet open={isBlocksSheetOpen} onOpenChange={setIsBlocksSheetOpen}>
                <SheetContent side="left" className="p-2 flex flex-col gap-4 w-full max-w-xs">
                    <SheetTitle className="sr-only">Flows and Blocks</SheetTitle>
                    <SheetDescription className="sr-only">A list of flows and draggable blocks.</SheetDescription>
                    <FlowsAndBlocksPanel {...{ isLoading, flows, currentFlow, handleSelectFlow, handleDeleteFlow, handleCreateNewFlow, addNode }} />
                </SheetContent>
            </Sheet>
            <TestFlowDialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen} nodes={nodes} edges={edges} />
        </div>
    );
}

export default function FlowBuilderPageWrapper() {
  return (
    <FlowBuilder />
  )
}
