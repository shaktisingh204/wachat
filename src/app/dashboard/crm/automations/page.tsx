
'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
    MessageSquare, 
    GitFork, 
    Play,
    Trash2,
    Save,
    Plus,
    LoaderCircle,
    BookOpen,
    PanelLeft,
    Settings2,
    Copy,
    File,
    ZoomIn,
    ZoomOut,
    Frame,
    Maximize,
    Minimize,
    Clock,
    Tag,
    FolderKanban,
    Wand2,
    Webhook
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getCrmAutomations,
  getCrmAutomationById,
  saveCrmAutomation,
  deleteCrmAutomation,
  generateCrmAutomation,
} from '@/app/actions/crm-automations.actions';
import type { CrmAutomation, CrmAutomationNode, CrmAutomationEdge } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Sheet, SheetContent, SheetDescription, SheetTitle, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CrmAutomationBlockEditor } from '@/components/wabasimplify/crm-automation-block-editor';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

type NodeType = 'triggerTagAdded' | 'actionSendEmail' | 'actionCreateTask' | 'actionAddTag' | 'delay' | 'condition';

const blockTypes = [
    { type: 'triggerTagAdded', label: 'Trigger: Tag Added', icon: Tag },
    { type: 'actionCreateTask', label: 'Action: Create Task', icon: FolderKanban },
    { type: 'actionAddTag', label: 'Action: Add Tag', icon: Tag },
    { type: 'actionSendEmail', label: 'Action: Send Email', icon: MessageSquare },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
];

const NodeComponent = ({ 
    node, 
    onSelectNode, 
    isSelected,
    onNodeMouseDown,
    onHandleClick 
}: { 
    node: CrmAutomationNode; 
    onSelectNode: (id: string) => void; 
    isSelected: boolean;
    onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string, isOutput: boolean) => void;
}) => {
    const BlockIcon = blockTypes.find(b => b.type === node.type)?.icon || Play;

    const Handle = ({ position, id, style, children }: { position: 'left' | 'right', id: string, style?: React.CSSProperties, children?: React.ReactNode }) => (
        <div 
            id={id}
            data-handle-pos={position}
            style={style}
            className={cn(
                "absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 flex items-center justify-center",
                position === 'left' ? "-left-2 top-1/2 -translate-y-1/2" : "-right-2",
            )} 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onHandleClick(e, node.id, id, position === 'right'); }}
        >
          {children}
        </div>
    );

    return (
        <div 
            className="absolute cursor-grab active:cursor-grabbing transition-all"
            style={{ top: node.position.y, left: node.position.x }}
            onMouseDown={(e) => onNodeMouseDown(e, node.id)}
            onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }}
        >
            <Card className={cn("w-64 hover:shadow-xl hover:-translate-y-1 bg-card", isSelected && "ring-2 ring-primary shadow-2xl")}>
                <CardHeader className="flex flex-row items-center gap-3 p-3">
                    <BlockIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{node.data.label}</CardTitle>
                </CardHeader>
            </Card>

            {node.type !== 'triggerTagAdded' && <Handle position="left" id={`${node.id}-input`} style={{top: '50%', transform: 'translateY(-50%)'}} />}
            
            {node.type === 'condition' ? (
                <>
                    <Handle position="right" id={`${node.id}-output-yes`} style={{ top: '33.33%', transform: 'translateY(-50%)' }} ><p className="text-xs absolute -right-6">Yes</p></Handle>
                    <Handle position="right" id={`${node.id}-output-no`} style={{ top: '66.67%', transform: 'translateY(-50%)' }} ><p className="text-xs absolute -right-5">No</p></Handle>
                </>
            ) : (
                <Handle position="right" id={`${node.id}-output-main`} style={{top: '50%', transform: 'translateY(-50%)'}} />
            )}
        </div>
    );
};

function WebhookTriggerDialog({ flow, triggerUrl }: { flow: WithId<CrmAutomation>, triggerUrl: string }) {
  const { toast } = useToast();
  const curlSnippet = `curl -X POST ${triggerUrl} \\
-H "Content-Type: application/json" \\
-d '{
  "email": "lead@example.com",
  "name": "New Lead",
  "phone": "1234567890",
  "company": "Acme Inc."
}'`;

  const jsSnippet = `fetch('${triggerUrl}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'lead@example.com',
    name: 'New Lead'
  })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);`;

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Webhook Trigger for "{flow.name}"</DialogTitle>
        <DialogDescription>
          Use this URL to start this automation from an external service, like a website form. The `email` field is required.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Webhook URL</Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={triggerUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(triggerUrl); toast({title: "Copied!"})}}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
        <div>
          <Label>cURL Example</Label>
           <div className="relative p-4 bg-muted rounded-md font-mono text-xs">
              <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => { navigator.clipboard.writeText(curlSnippet); toast({title: "Copied!"})}}><Copy className="h-4 w-4" /></Button>
              <pre><code>{curlSnippet}</code></pre>
          </div>
        </div>
        <div>
          <Label>JavaScript (Fetch) Example</Label>
           <div className="relative p-4 bg-muted rounded-md font-mono text-xs">
              <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => { navigator.clipboard.writeText(jsSnippet); toast({title: "Copied!"})}}><Copy className="h-4 w-4" /></Button>
              <pre><code>{jsSnippet}</code></pre>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}

const getEdgePath = (sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
    if (!sourcePos || !targetPos) return '';
    const dx = Math.abs(sourcePos.x - targetPos.x) * 0.5;
    const path = `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + dx} ${sourcePos.y}, ${targetPos.x - dx} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
    return path;
};

const getNodeHandlePosition = (node: CrmAutomationNode, handleId: string) => {
    if (!node || !handleId) return null;
    const NODE_WIDTH = 256;
    const NODE_HEIGHT = 56;
    const x = node.position.x;
    const y = node.position.y;
    
    if (handleId.endsWith('-input')) return { x: x, y: y + NODE_HEIGHT / 2 };
    if (handleId.endsWith('-output-main')) return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT / 2 };
    if (handleId.endsWith('-output-yes')) return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT * (1/3) };
    if (handleId.endsWith('-output-no')) return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT * (2/3) };
    
    return null;
}

export default function CrmAutomationsPage() {
    const { toast } = useToast();
    const [flows, setFlows] = useState<WithId<CrmAutomation>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<CrmAutomation> | null>(null);
    const [nodes, setNodes] = useState<CrmAutomationNode[]>([]);
    const [edges, setEdges] = useState<CrmAutomationEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const [isGenerating, startGenerateTransition] = useTransition();
    const viewportRef = useRef<HTMLDivElement>(null);
    
    const [isPropsPanelOpen, setIsPropsPanelOpen] = useState(false);
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [webhookFlow, setWebhookFlow] = useState<WithId<CrmAutomation> | null>(null);
    
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<{ sourceNodeId: string; sourceHandleId: string; startPos: { x: number; y: number } } | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isFullScreen, setIsFullScreen] = useState(false);
    

    const handleCreateNewFlow = () => {
        const startNode = { id: 'start', type: 'triggerTagAdded' as NodeType, data: { label: 'When Tag is Added' }, position: { x: 50, y: 150 } };
        setCurrentFlow(null); setNodes([startNode]); setEdges([]); setSelectedNodeId(startNode.id);
    };

    const fetchFlows = useCallback(() => {
        startLoadingTransition(async () => {
            const flowsData = await getCrmAutomations();
            setFlows(flowsData);
            if (flowsData.length > 0 && !currentFlow) {
                handleSelectFlow(flowsData[0]._id.toString());
            } else if (flowsData.length === 0) {
                handleCreateNewFlow();
            }
        });
    }, []);

    useEffect(() => {
        fetchFlows();
    }, [fetchFlows]);

    const handleSelectFlow = async (flowId: string) => {
        const flow = await getCrmAutomationById(flowId);
        setCurrentFlow(flow);
        setNodes(flow?.nodes || []);
        setEdges(flow?.edges || []);
        setSelectedNodeId(null);
    };
    
    const handleSaveFlow = () => {
        const flowName = (document.getElementById('flow-name-input') as HTMLInputElement)?.value;
        if (!flowName) return;
        startSaveTransition(async () => {
            const result = await saveCrmAutomation({ flowId: currentFlow?._id.toString(), name: flowName, nodes, edges });
            if(result.error) toast({title: "Error", description: result.error, variant: 'destructive'});
            else {
                toast({title: "Success", description: result.message});
                if(result.flowId) await handleSelectFlow(result.flowId);
                fetchFlows();
            }
        });
    };
    
    const addNode = (type: NodeType) => {
        const centerOfViewX = viewportRef.current ? (viewportRef.current.clientWidth / 2 - pan.x) / zoom : 300;
        const centerOfViewY = viewportRef.current ? (viewportRef.current.clientHeight / 2 - pan.y) / zoom : 150;

        const newNode: CrmAutomationNode = {
            id: `${type}-${Date.now()}`, type, data: { label: `New ${type}` }, position: { x: centerOfViewX, y: centerOfViewY },
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
    };
    
    const updateNodeData = (id: string, data: Partial<any>) => {
        setNodes(prev => prev.map(node => node.id === id ? { ...node, data: { ...node.data, ...data } } : node));
    };

    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(node => node.id !== id));
        setEdges(prev => prev.filter(edge => edge.source !== id && edge.target !== id));
        if (selectedNodeId === id) setSelectedNodeId(null);
        setIsPropsPanelOpen(false);
    };
    
    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => { e.preventDefault(); e.stopPropagation(); setDraggingNode(nodeId); };
    const handleCanvasMouseDown = (e: React.MouseEvent) => { if (e.target === e.currentTarget) { e.preventDefault(); setIsPanning(true); } };
    const handleCanvasMouseUp = () => { setIsPanning(false); setDraggingNode(null); };
    
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

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            if (connecting) setConnecting(null);
            else setSelectedNodeId(null);
        }
    }

     const handleHandleClick = (e: React.MouseEvent, nodeId: string, handleId: string, isOutput: boolean) => {
        e.preventDefault(); e.stopPropagation();
        if (!viewportRef.current) return;

        if (isOutput) {
            const sourceNode = nodes.find(n => n.id === nodeId);
            if(sourceNode){
                const handlePos = getNodeHandlePosition(sourceNode, handleId);
                if (handlePos) setConnecting({ sourceNodeId: nodeId, sourceHandleId: handleId, startPos: handlePos });
            }
        } else if (connecting && !isOutput) {
            if (connecting.sourceNodeId === nodeId) { setConnecting(null); return; }

            const newEdge: CrmAutomationEdge = { id: `edge-${connecting.sourceNodeId}-${nodeId}`, source: connecting.sourceNodeId, target: nodeId, sourceHandle: connecting.sourceHandleId, };
            setEdges(prev => [...prev.filter(edge => !(edge.source === nodeId && edge.sourceHandle === connecting.sourceHandleId)), newEdge]);
            setConnecting(null);
        }
    };
    
    const handleZoomControls = (direction: 'in' | 'out' | 'reset') => {
        if(direction === 'reset') { setZoom(1); setPan({ x: 0, y: 0 }); return; }
        setZoom(prevZoom => Math.max(0.2, Math.min(2, direction === 'in' ? prevZoom * 1.2 : prevZoom / 1.2)));
    };
    
    useEffect(() => {
        if (selectedNodeId) setIsPropsPanelOpen(true);
    }, [selectedNodeId]);

    const handleGenerateFlow = async () => {
        startGenerateTransition(async () => {
            const result = await generateCrmAutomation({ prompt: aiPrompt });
            if(result.nodes && result.edges) {
                setCurrentFlow(null); setNodes(result.nodes); setEdges(result.edges);
                toast({title: 'Flow Generated!', description: 'Review the generated flow and save it.'});
                setIsAiDialogOpen(false); setAiPrompt('');
            } else {
                toast({title: 'Error', description: 'Failed to generate flow from prompt.', variant: 'destructive'});
            }
        });
    };
    
    const webhookTriggerUrl = webhookFlow ? `${window.location.origin}/api/crm/automations/trigger/${webhookFlow._id.toString()}` : '';

    return (
        <div className="flex flex-col h-[calc(100vh-theme(space.4))] gap-4">
            <header className="flex-shrink-0 flex items-center justify-between">
                <Input id="flow-name-input" defaultValue={currentFlow?.name || 'New Automation'} className="text-3xl font-bold font-headline h-auto p-0 border-0 shadow-none focus-visible:ring-0" />
                <div className="flex items-center gap-2">
                     <Button variant="outline" onClick={() => setIsAiDialogOpen(true)}><Wand2 className="mr-2 h-4 w-4" /> Generate with AI</Button>
                     <Button asChild variant="outline"><Link href="/dashboard/crm/automations/docs"><BookOpen className="mr-2 h-4 w-4"/>Docs</Link></Button>
                    <Button onClick={handleSaveFlow} disabled={isSaving}>{isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save</Button>
                </div>
            </header>
            <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
                <aside className="col-span-2 flex flex-col gap-4">
                     <Card>
                        <CardHeader className="flex-row items-center justify-between p-3">
                            <CardTitle className="text-base">Flows</CardTitle>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateNewFlow}><Plus/></Button>
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                            <ScrollArea className="h-40">
                                {isLoading && flows.length === 0 ? <p>Loading...</p> : 
                                    flows.map(flow => (
                                        <div key={flow._id.toString()} className="flex items-center group">
                                            <Button 
                                                variant="ghost" 
                                                className={cn("w-full justify-start font-normal", currentFlow?._id.toString() === flow._id.toString() && "bg-muted font-semibold")}
                                                onClick={() => handleSelectFlow(flow._id.toString())}
                                            >
                                                {flow.name}
                                            </Button>
                                             <Dialog onOpenChange={(open) => !open && setWebhookFlow(null)}>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setWebhookFlow(flow)}><Webhook className="h-4 w-4"/></Button>
                                                </DialogTrigger>
                                                {webhookFlow && <WebhookTriggerDialog flow={webhookFlow} triggerUrl={webhookTriggerUrl} />}
                                            </Dialog>
                                        </div>
                                    ))
                                }
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    <Card className="flex-1 flex flex-col">
                        <CardHeader className="p-3"><CardTitle className="text-base">Blocks</CardTitle></CardHeader>
                        <CardContent className="space-y-2 p-2 pt-0 flex-1 min-h-0">
                            <ScrollArea className="h-full pr-2">
                                {blockTypes.map(({ type, label, icon: Icon }) => (
                                    <Button key={type} variant="outline" className="w-full justify-start mb-2" onClick={() => addNode(type as NodeType)}><Icon className="mr-2 h-4 w-4" />{label}</Button>
                                ))}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </aside>
                <main className="col-span-7">
                    <Card ref={viewportRef} className="h-full w-full overflow-hidden relative" onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp} onClick={handleCanvasClick}>
                        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.4) 1px, transparent 0)', backgroundSize: '20px 20px', backgroundPosition: `${pan.x}px ${pan.y}px`, }} />
                        <div className="relative w-full h-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
                             {nodes.map(node => (<NodeComponent key={node.id} node={node} onSelectNode={setSelectedNodeId} isSelected={selectedNodeId === node.id} onNodeMouseDown={handleNodeMouseDown} onHandleClick={handleHandleClick} />))}
                             <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '5000px', height: '5000px', transformOrigin: 'top left' }}>
                                 {edges.map(edge => {
                                    const sourceNode = nodes.find(n => n.id === edge.source); const targetNode = nodes.find(n => n.id === edge.target); if(!sourceNode || !targetNode) return null;
                                    const sourcePos = getNodeHandlePosition(sourceNode, edge.sourceHandle || `${edge.source}-output-main`); const targetPos = getNodeHandlePosition(targetNode, edge.targetHandle || `${edge.target}-input`); if (!sourcePos || !targetPos) return null;
                                    return <path key={edge.id} d={getEdgePath(sourcePos, targetPos)} stroke="hsl(var(--border))" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
                                })}
                                {connecting && <path d={getEdgePath(connecting.startPos, mousePosition)} stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeDasharray="5,5" />}
                                <defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--border))" /></marker></defs>
                             </svg>
                        </div>
                        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                             <Button variant="outline" size="icon" onClick={() => handleZoomControls('out')}><ZoomOut className="h-4 w-4" /></Button>
                             <Button variant="outline" size="icon" onClick={() => handleZoomControls('in')}><ZoomIn className="h-4 w-4" /></Button>
                             <Button variant="outline" size="icon" onClick={() => handleZoomControls('reset')}><Frame className="h-4 w-4" /></Button>
                             <Button variant="outline" size="icon" onClick={() => {}}><Maximize className="h-4 w-4" /></Button>
                        </div>
                    </Card>
                </main>
                <aside className="col-span-3">
                    {selectedNodeId && nodes.find(n => n.id === selectedNodeId) && (
                        <CrmAutomationBlockEditor 
                            node={nodes.find(n => n.id === selectedNodeId)} 
                            onUpdate={(newData) => updateNodeData(selectedNodeId, newData)} 
                        />
                    )}
                </aside>
            </div>
             <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Automation with AI</DialogTitle>
                        <DialogDescription>Describe the workflow you want to create.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder="e.g., When a contact gets the 'new_lead' tag, wait 1 day, then send them the welcome email."
                        className="min-h-[120px]"
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                    />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAiDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleGenerateFlow} disabled={isGenerating || !aiPrompt.trim()}>
                            {isGenerating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                            Generate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

    