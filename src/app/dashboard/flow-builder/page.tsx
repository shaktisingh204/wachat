
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    MessageSquare, 
    ToggleRight, 
    GitFork, 
    Webhook, 
    Image as ImageIcon,
    Play,
    Trash2,
    Save,
    Plus,
    Clock,
    Type,
    ArrowRightLeft,
    ShoppingCart,
    View,
    Server,
    Variable,
    File,
    LoaderCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFlowsForProject, saveFlow, deleteFlow, getFlowById } from '@/app/actions';
import type { Flow, FlowNode, FlowEdge } from '@/app/actions';
import type { WithId } from 'mongodb';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type NodeType = 'start' | 'text' | 'buttons' | 'condition' | 'webhook' | 'image' | 'input' | 'delay' | 'api' | 'carousel' | 'addToCart';

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'carousel', label: 'Product Carousel', icon: View },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'webhook', label: 'Call Webhook', icon: Webhook },
    { type: 'api', label: 'Call API', icon: ArrowRightLeft },
    { type: 'addToCart', label: 'Add to Cart', icon: ShoppingCart },
];

const NodeComponent = ({ node, onSelectNode, isSelected }: { node: FlowNode; onSelectNode: (id: string) => void; isSelected: boolean }) => {
    const BlockIcon = [...blockTypes, {type: 'start', label: 'Start', icon: Play}].find(b => b.type === node.type)?.icon || MessageSquare;

    const Handle = ({ position, id }: { position: 'left' | 'right' | 'top' | 'bottom', id: string }) => (
        <div 
            id={id}
            data-handle-pos={position}
            className={cn(
            "absolute w-3 h-3 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors",
            position === 'left' && "-left-1.5 top-1/2 -translate-y-1/2",
            position === 'right' && "-right-1.5 top-1/2 -translate-y-1/2",
            position === 'top' && "-top-1.5 left-1/2 -translate-x-1/2",
            position === 'bottom' && "-bottom-1.5 left-1/2 -translate-x-1/2",
        )} />
    );

    return (
        <div 
            className="absolute cursor-pointer transition-all"
            style={{ top: node.position.y, left: node.position.x }}
            onClick={() => onSelectNode(node.id)}
        >
            <Card className={cn(
                "w-64 hover:shadow-xl hover:-translate-y-1 bg-card",
                isSelected && "ring-2 ring-primary shadow-2xl"
            )}>
                <CardHeader className="flex flex-row items-center gap-3 p-3">
                    <BlockIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{node.data.label}</CardTitle>
                </CardHeader>
            </Card>
            {node.type !== 'start' && <Handle position="left" id={`${node.id}-input`} />}
            <Handle position="right" id={`${node.id}-output-main`} />
            {node.type === 'condition' && (
                <>
                    <Handle position="right" id={`${node.id}-output-yes`} />
                    <Handle position="right" id={`${node.id}-output-no`} />
                </>
            )}
        </div>
    );
};

const PropertiesPanel = ({ selectedNode, updateNodeData, deleteNode }: { selectedNode: FlowNode | null; updateNodeData: (id: string, data: Partial<any>) => void, deleteNode: (id: string) => void }) => {
    
    if (!selectedNode) {
        return (
            <Card className="h-full">
                <CardContent className="flex h-full items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground text-center">Select a block to see its properties.</p>
                </CardContent>
            </Card>
        );
    }
    
    const handleDataChange = (field: keyof any, value: any) => {
        updateNodeData(selectedNode.id, { [field]: value });
    };

    const renderProperties = () => {
        switch (selectedNode.type) {
            case 'start':
                return <p className="text-sm text-muted-foreground">This is the starting point of your flow. Configure keywords or other triggers here.</p>;
            case 'text':
                return <Textarea id="text-content" placeholder="Enter your message here..." value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} className="h-32" />;
            case 'image':
                return <Input id="image-url" placeholder="https://example.com/image.png" value={selectedNode.data.imageUrl || ''} onChange={(e) => handleDataChange('imageUrl', e.target.value)} />;
            case 'delay':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                             <Label htmlFor="delay-seconds">Delay (seconds)</Label>
                             <Input id="delay-seconds" type="number" value={selectedNode.data.delaySeconds || 1} onChange={(e) => handleDataChange('delaySeconds', parseFloat(e.target.value))} />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="typing-indicator" checked={selectedNode.data.showTyping} onCheckedChange={(checked) => handleDataChange('showTyping', checked)} />
                            <Label htmlFor="typing-indicator">Show typing indicator</Label>
                        </div>
                    </div>
                );
            case 'input':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="input-text">Question to Ask</Label>
                            <Textarea id="input-text" placeholder="e.g., What is your name?" value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                             <Label htmlFor="input-variable">Save Answer to Variable</Label>
                             <Input id="input-variable" placeholder="e.g., user_name" value={selectedNode.data.variableToSave || ''} onChange={(e) => handleDataChange('variableToSave', e.target.value)} />
                        </div>
                    </div>
                 );
             case 'api':
                return (
                    <Tabs defaultValue="request">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="request">Request</TabsTrigger>
                            <TabsTrigger value="response">Response</TabsTrigger>
                        </TabsList>
                        <TabsContent value="request" className="space-y-4 pt-2">
                             <Input placeholder="https://api.example.com" value={selectedNode.data.apiRequest?.url || ''} />
                             <Textarea placeholder="Request Body (JSON)" className="font-mono text-xs h-32" value={selectedNode.data.apiRequest?.body || ''} />
                        </TabsContent>
                        <TabsContent value="response" className="space-y-4 pt-2">
                            <Label htmlFor="api-variable">Save Response to Variable</Label>
                            <Input id="api-variable" placeholder="e.g., api_response" value={selectedNode.data.apiRequest?.responseVariable || ''} />
                        </TabsContent>
                    </Tabs>
                )
            default:
                return <p className="text-sm text-muted-foreground italic">No properties to configure for this block type yet.</p>;
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Properties</CardTitle>
                <CardDescription>Configure the '{selectedNode.data.label}' block.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 overflow-y-auto">
                <div className="space-y-2">
                    <Label htmlFor="node-label">Block Label</Label>
                    <Input id="node-label" value={selectedNode.data.label || ''} onChange={(e) => handleDataChange('label', e.target.value)} />
                </div>
                <Separator />
                {renderProperties()}
            </CardContent>
            {selectedNode.type !== 'start' && (
                <CardFooter className="border-t pt-4">
                     <Button variant="destructive" className="w-full" onClick={() => deleteNode(selectedNode.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Block
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
};

export default function FlowBuilderPage() {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [flows, setFlows] = useState<WithId<Flow>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<Flow> | null>(null);
    const [nodes, setNodes] = useState<FlowNode[]>([]);
    const [edges, setEdges] = useState<FlowEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoadingFlows, startFlowsLoadingTransition] = useTransition();

    useEffect(() => {
        setIsClient(true);
        document.title = 'Flow Builder | Wachat';
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    const loadFlows = useCallback(async () => {
        if (projectId) {
            startFlowsLoadingTransition(async () => {
                const fetchedFlows = await getFlowsForProject(projectId);
                setFlows(fetchedFlows);
                if (fetchedFlows.length > 0 && !currentFlow) {
                    handleSelectFlow(fetchedFlows[0]._id.toString());
                } else if (fetchedFlows.length === 0) {
                    handleCreateNewFlow();
                }
            });
        }
    }, [projectId, currentFlow]);

    useEffect(() => {
        loadFlows();
    }, [projectId]);

    const handleSelectFlow = useCallback(async (flowId: string) => {
        const fullFlow = await getFlowById(flowId);
        if (fullFlow) {
            setCurrentFlow(fullFlow);
            setNodes(fullFlow.nodes || []);
            setEdges(fullFlow.edges || []);
            setSelectedNodeId(null);
        }
    }, []);
    
    const handleCreateNewFlow = () => {
        const startNode = { id: 'node-start', type: 'start' as NodeType, data: { label: 'Start Flow' }, position: { x: 50, y: 150 } };
        setCurrentFlow(null); // No ID, so it's a new flow
        setNodes([startNode]);
        setEdges([]);
        setSelectedNodeId(startNode.id);
    };
    
    const handleDeleteFlow = async (flowId: string) => {
        const result = await deleteFlow(flowId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.message });
            loadFlows();
        }
    };

    const addNode = (type: NodeType) => {
        const newNode: FlowNode = {
            id: `node-${type}-${Date.now()}`,
            type,
            data: { 
                label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                apiRequest: { method: 'GET', url: '', headers: [], body: '', responseVariable: '' }
            },
            position: { x: Math.random() * 400 + 200, y: Math.random() * 200 + 50 },
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
    };
    
    const updateNodeData = (id: string, data: Partial<any>) => {
        setNodes(prev => prev.map(node => 
            node.id === id ? { ...node, data: { ...node.data, ...data } } : node
        ));
    };
    
    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(node => node.id !== id));
        setSelectedNodeId(null);
    };

    const handleSaveFlow = () => {
        if (!projectId || !currentFlow?.name) {
            toast({ title: "Cannot Save", description: "Flow name and project are required.", variant: 'destructive' });
            return;
        }
        startSaveTransition(async () => {
            const result = await saveFlow({
                flowId: currentFlow?._id.toString(),
                projectId,
                name: currentFlow.name,
                nodes,
                edges
            });
            if (result.error) {
                toast({ title: "Error Saving Flow", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "Flow Saved!", description: result.message });
                if (result.flowId && !currentFlow?._id) {
                    const newFlow = await getFlowById(result.flowId);
                    if(newFlow) setCurrentFlow(newFlow);
                }
                loadFlows();
            }
        });
    };

    const selectedNode = nodes.find(node => node.id === selectedNodeId) || null;

    if (!isClient) return <div className="h-full w-full"><Skeleton className="h-full w-full"/></div>
    if (!projectId) {
        return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No Project Selected</AlertTitle><AlertDescription>Please select a project from the main dashboard before using the Flow Builder.</AlertDescription></Alert>
    }

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
            <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4">
                <div>
                     <Input 
                        value={currentFlow?.name || 'New Flow'} 
                        onChange={e => setCurrentFlow(prev => prev ? {...prev, name: e.target.value} : { name: e.target.value } as any)} 
                        className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-3xl font-bold font-headline"
                        disabled={!currentFlow}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Play className="mr-2 h-4 w-4" />
                        Test Flow
                    </Button>
                    <Button onClick={handleSaveFlow} disabled={isSaving || !currentFlow}>
                        {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Save & Publish
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
                <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-4">
                    <Card>
                        <CardHeader className="flex-row items-center justify-between p-3">
                            <CardTitle className="text-base">Flows</CardTitle>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateNewFlow}><Plus/></Button>
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                            <ScrollArea className="h-32">
                                {isLoadingFlows ? <Skeleton className="h-full w-full"/> : 
                                    flows.map(flow => (
                                        <div key={flow._id.toString()} className="flex items-center group">
                                            <Button 
                                                variant="ghost" 
                                                className={cn("w-full justify-start font-normal", currentFlow?._id.toString() === flow._id.toString() && "bg-muted font-semibold")}
                                                onClick={() => handleSelectFlow(flow._id.toString())}
                                            >
                                                <File className="mr-2 h-4 w-4"/>
                                                {flow.name}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteFlow(flow._id.toString())}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))
                                }
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-3"><CardTitle className="text-base">Blocks</CardTitle></CardHeader>
                        <CardContent className="space-y-2 p-2 pt-0">
                            {blockTypes.map(({ type, label, icon: Icon }) => (
                                <Button key={type} variant="outline" className="w-full justify-start" onClick={() => addNode(type as NodeType)}>
                                    <Icon className="mr-2 h-4 w-4" />
                                    {label}
                                </Button>
                            ))}
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-6 lg:col-span-7">
                    <Card className="h-full">
                        <ScrollArea className="h-full">
                            <div className="relative h-[80vh]">
                                {nodes.map(node => (
                                    <NodeComponent 
                                        key={node.id} 
                                        node={node}
                                        onSelectNode={setSelectedNodeId}
                                        isSelected={selectedNodeId === node.id}
                                    />
                                ))}
                                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                                    {edges.map(edge => {
                                        const sourceNode = nodes.find(n => n.id === edge.source);
                                        const targetNode = nodes.find(n => n.id === edge.target);
                                        if(!sourceNode || !targetNode) return null;
                                        return <line key={edge.id} x1={sourceNode.position.x + 256} y1={sourceNode.position.y + 35} x2={targetNode.position.x} y2={targetNode.position.y + 35} stroke="hsl(var(--border))" strokeWidth="2" />
                                    })}
                                </svg>
                            </div>
                        </ScrollArea>
                    </Card>
                </div>
                <div className="md:col-span-3 lg:col-span-3">
                    <PropertiesPanel 
                        selectedNode={selectedNode}
                        updateNodeData={updateNodeData}
                        deleteNode={deleteNode}
                    />
                </div>
            </div>
        </div>
    );
}

