
'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    MessageSquare, 
    ToggleRight, 
    GitFork, 
    Play,
    Trash2,
    Save,
    Plus,
    Type,
    BrainCircuit,
    LoaderCircle,
    BookOpen,
    PanelLeft,
    Settings2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  getFacebookFlows,
  getFacebookFlowById,
  saveFacebookFlow,
  deleteFacebookFlow,
} from '@/app/actions/facebook-flow.actions';
import type { FacebookFlow, FacebookFlowNode, FacebookFlowEdge } from '@/lib/definitions';
import type { WithId } from 'mongodb';


type NodeType = 'start' | 'text' | 'buttons' | 'input';

type ButtonConfig = {
    id: string;
    text: string;
};

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'buttons', label: 'Add Quick Replies', icon: ToggleRight },
    { type: 'input', label: 'Get User Input', icon: Type },
];

const NodeComponent = ({ node, isSelected }: { node: FacebookFlowNode; isSelected: boolean; }) => {
    const BlockIcon = [...blockTypes, {type: 'start', label: 'Start', icon: Play}].find(b => b.type === node.type)?.icon || MessageSquare;

    const renderTextWithVariables = (text?: string) => {
        if (!text) return <span className="italic opacity-50">Enter message...</span>;
        const parts = text.split(/({{\s*[\w\d._]+\s*}})/g);
        return parts.map((part, i) =>
            part.match(/^{{.*}}$/) ? (
                <span key={i} className="font-semibold text-primary/90 bg-primary/10 rounded-sm px-1">
                    {part}
                </span>
            ) : (
                part
            )
        );
    };

    return (
        <Card className={cn("w-64 hover:shadow-xl hover:-translate-y-1 bg-card", isSelected && "ring-2 ring-primary shadow-2xl")}>
            <CardHeader className="flex flex-row items-center gap-3 p-3">
                <BlockIcon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">{node.data.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
                <div className="text-sm text-muted-foreground space-y-2">
                    {node.type === 'text' && <div>{renderTextWithVariables(node.data.text)}</div>}
                    {node.type === 'input' && <div>{renderTextWithVariables(node.data.text)}</div>}
                    {node.type === 'buttons' && (
                        <>
                            <div>{renderTextWithVariables(node.data.text)}</div>
                            <div className="border-t pt-2 space-y-1">
                                {(node.data.buttons || []).map((btn: any, index: number) => (
                                    <div key={btn.id || index} className="text-center text-primary font-medium bg-background/50 py-1.5 rounded-md text-xs">
                                        {btn.text || `Button ${index + 1}`}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};


const PropertiesPanel = ({ selectedNode, updateNodeData, deleteNode }: { selectedNode: FacebookFlowNode | null; updateNodeData: (id: string, data: Partial<any>) => void, deleteNode: (id: string) => void }) => {
    if (!selectedNode) return null;
    
    const { toast } = useToast();

    const handleDataChange = (field: keyof any, value: any) => {
        updateNodeData(selectedNode.id, { [field]: value });
    };

    const handleButtonChange = (index: number, field: 'text', value: string) => {
        const newButtons: ButtonConfig[] = [...(selectedNode.data.buttons || [])];
        newButtons[index] = { ...newButtons[index], [field]: value };
        handleDataChange('buttons', newButtons);
    };

    const addFlowButton = () => {
        const currentButtons = selectedNode.data.buttons || [];
        if (currentButtons.length >= 13) {
            toast({ title: "Limit Reached", description: "You can add a maximum of 13 Quick Replies.", variant: "destructive" });
            return;
        }
        const newButtons: ButtonConfig[] = [...currentButtons, { id: `btn-${Date.now()}`, text: '' }];
        handleDataChange('buttons', newButtons);
    };

    const removeFlowButton = (index: number) => {
        const newButtons = (selectedNode.data.buttons || []).filter((_: any, i: number) => i !== index);
        handleDataChange('buttons', newButtons);
    };

    const renderProperties = () => {
        switch (selectedNode.type) {
            case 'start':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="triggerKeywords">Trigger Keywords</Label>
                        <Input 
                            id="triggerKeywords"
                            placeholder="e.g., help, menu" 
                            value={selectedNode.data.triggerKeywords || ''} 
                            onChange={(e) => handleDataChange('triggerKeywords', e.target.value)}
                        />
                         <p className="text-xs text-muted-foreground">Comma-separated keywords to start this flow.</p>
                    </div>
                );
            case 'text':
                return <Textarea id="text-content" placeholder="Enter your message here..." value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} className="h-32" />;
            case 'buttons':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="buttons-text">Message Text</Label>
                            <Textarea id="buttons-text" placeholder="Choose an option:" value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Quick Replies</Label>
                            <div className="space-y-3">
                                {(selectedNode.data.buttons || []).map((btn: ButtonConfig, index: number) => (
                                    <div key={btn.id || index} className="flex items-center gap-2">
                                        <Input 
                                            placeholder="Button Text" 
                                            value={btn.text} 
                                            onChange={(e) => handleButtonChange(index, 'text', e.target.value)} 
                                            maxLength={20}
                                        />
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFlowButton(index)}><Trash2 className="h-3 w-3"/></Button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addFlowButton}><Plus className="mr-2 h-4 w-4"/>Add Quick Reply</Button>
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
                             <p className="text-xs text-muted-foreground">Use {'{{user_name}}'} in later steps.</p>
                        </div>
                    </div>
                 );
            default:
                return <p className="text-sm text-muted-foreground italic">No properties to configure for this block type.</p>;
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Properties</CardTitle>
                <CardDescription>Configure the '{selectedNode.data.label}' block.</CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1">
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="node-label">Block Label</Label>
                        <Input id="node-label" value={selectedNode.data.label || ''} onChange={(e) => handleDataChange('label', e.target.value)} />
                    </div>
                    <Separator />
                    {renderProperties()}
                </CardContent>
            </ScrollArea>
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


export default function FacebookFlowBuilderPage() {
    // This component will have a simplified UI for now, focusing on a few key nodes.
    // It will not have the full react-flow-renderer setup yet.
    const [isClient, setIsClient] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [flows, setFlows] = useState<WithId<FacebookFlow>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<FacebookFlow> | null>(null);
    const [nodes, setNodes] = useState<FacebookFlowNode[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isSaving, startSaveTransition] = useTransition();
    
    const { toast } = useToast();

    useEffect(() => {
        setIsClient(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    const fetchFlows = useCallback(() => {
        if(projectId) {
            startLoadingTransition(async () => {
                const flowsData = await getFacebookFlows(projectId);
                setFlows(flowsData);
                if (flowsData.length > 0 && !currentFlow) {
                    handleSelectFlow(flowsData[0]._id.toString());
                } else if (flowsData.length === 0) {
                    handleCreateNewFlow();
                }
            });
        }
    }, [projectId, currentFlow]);

    useEffect(() => {
        if(isClient && projectId) {
            fetchFlows();
        }
    }, [isClient, projectId, fetchFlows]);
    
    const handleSelectFlow = async (flowId: string) => {
        const flow = await getFacebookFlowById(flowId);
        setCurrentFlow(flow);
        setNodes(flow?.nodes || []);
        setSelectedNodeId(null);
    }
    
    const handleCreateNewFlow = () => {
        setCurrentFlow(null);
        setNodes([{ id: 'start', type: 'start', data: { label: 'Start Flow' }, position: { x: 50, y: 50 } }]);
        setSelectedNodeId('start');
    }

    const addNode = (type: NodeType) => {
        const newNode: FacebookFlowNode = {
            id: `${type}-${Date.now()}`,
            type,
            data: { label: `New ${type}` },
            position: { x: 100, y: nodes.length * 100 },
        };
        setNodes(prev => [...prev, newNode]);
    };
    
     const updateNodeData = (id: string, data: Partial<any>) => {
        setNodes(prev => prev.map(node => 
            node.id === id ? { ...node, data: { ...node.data, ...data } } : node
        ));
    };

    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(node => node.id !== id));
        if (selectedNodeId === id) setSelectedNodeId(null);
    };

    const handleSaveFlow = async () => {
        const flowName = (document.getElementById('flow-name-input') as HTMLInputElement)?.value;
        if (!projectId || !flowName) return;
        const startNode = nodes.find(n => n.type === 'start');
        const triggerKeywords = startNode?.data.triggerKeywords?.split(',').map((k:string) => k.trim()).filter(Boolean) || [];

        startSaveTransition(async () => {
             const result = await saveFacebookFlow({
                flowId: currentFlow?._id.toString(),
                projectId,
                name: flowName,
                nodes,
                edges: [], // Edges not implemented in this simple view yet
                triggerKeywords
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

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    if (!isClient) {
        return <Skeleton className="h-full w-full"/>
    }
    
    if (!projectId) {
         return (
             <div className="flex flex-col gap-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project from the main dashboard to use the Flow Builder.</AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <GitFork className="h-8 w-8"/>
                    Facebook Flow Builder
                </h1>
                <p className="text-muted-foreground mt-2">
                    Create automated chatbot flows for your Facebook Page.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-3 space-y-4">
                    <Card>
                        <CardHeader className="p-4">
                            <CardTitle className="text-base">Flows</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                             <Button variant="outline" className="w-full mb-2" onClick={handleCreateNewFlow}>
                                <Plus className="mr-2 h-4 w-4"/> New Flow
                            </Button>
                            <ScrollArea className="h-40">
                                {flows.map(flow => (
                                    <Button key={flow._id.toString()} variant="ghost" className={cn("w-full justify-start", currentFlow?._id.toString() === flow._id.toString() && "bg-muted")} onClick={() => handleSelectFlow(flow._id.toString())}>
                                        {flow.name}
                                    </Button>
                                ))}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="p-4"><CardTitle className="text-base">Blocks</CardTitle></CardHeader>
                        <CardContent className="p-2 space-y-2">
                            {blockTypes.map(block => (
                                <Button key={block.type} variant="outline" className="w-full justify-start" onClick={() => addNode(block.type as NodeType)}>
                                    <block.icon className="mr-2 h-4 w-4"/> {block.label}
                                </Button>
                            ))}
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-5">
                    <Card className="h-full flex flex-col">
                        <CardHeader>
                            <Input id="flow-name-input" key={currentFlow?._id.toString()} defaultValue={currentFlow?.name || "New Flow"} className="text-lg font-semibold" />
                        </CardHeader>
                        <ScrollArea className="flex-1 p-4">
                           <div className="space-y-3">
                                {nodes.map(node => (
                                    <button key={node.id} className="w-full" onClick={() => setSelectedNodeId(node.id)}>
                                        <NodeComponent node={node} isSelected={selectedNodeId === node.id} />
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                        <CardFooter>
                            <Button className="w-full" onClick={handleSaveFlow} disabled={isSaving}>
                                {isSaving ? <LoaderCircle className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2"/>} Save Flow
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
                <div className="lg:col-span-4">
                    {selectedNode ? (
                        <PropertiesPanel selectedNode={selectedNode} updateNodeData={updateNodeData} deleteNode={deleteNode} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground p-8 text-center border-2 border-dashed rounded-lg">
                            Select a block to edit its properties.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

