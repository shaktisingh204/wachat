
'use client';

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
    GitFork, 
    Play,
    Trash2,
    Save,
    Plus,
    LoaderCircle,
    BookOpen,
    Settings2,
    Copy,
    File,
    Wand2,
    Webhook,
    ArrowLeft,
    RefreshCw,
    MessageSquare,
    Tag,
    FolderKanban,
    Clock,
    MoreVertical,
    Check
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
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CrmAutomationBlockEditor } from '@/components/wabasimplify/crm-automation-block-editor';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';


type NodeType = 'triggerTagAdded' | 'actionSendEmail' | 'actionCreateTask' | 'actionAddTag' | 'delay' | 'condition';

const blockTypes = [
    { type: 'actionSendEmail', label: 'Send Email', icon: MessageSquare },
    { type: 'actionAddTag', label: 'Add Tag', icon: Tag },
    { type: 'actionCreateTask', label: 'Create Task', icon: FolderKanban },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'condition', label: 'Condition (If/Else)', icon: GitFork },
];

function NodeComponent({ node, onSelect, isSelected }: { node: CrmAutomationNode, onSelect: () => void, isSelected: boolean }) {
    const BlockIcon = [...blockTypes, { type: 'triggerTagAdded', label: 'Trigger', icon: Play }].find(b => b.type === node.type)?.icon || Play;
    
    return (
        <Card 
            onClick={onSelect} 
            className={cn(
                "w-80 cursor-pointer hover:shadow-lg transition-shadow",
                isSelected && 'ring-2 ring-primary'
            )}
        >
            <CardHeader className="flex flex-row items-center gap-4 p-4">
                <div className="p-2 bg-muted rounded-md">
                    <BlockIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                    <CardTitle className="text-base">{node.data.label}</CardTitle>
                    {node.type === 'triggerTagAdded' && node.data.tagName && <CardDescription>Tag: {node.data.tagName}</CardDescription>}
                    {node.type === 'delay' && <CardDescription>Wait for {node.data.delayValue || 1} {node.data.delayUnit || 'days'}</CardDescription>}
                </div>
            </CardHeader>
        </Card>
    );
}

function AddActionPopover({ onAddNode }: { onAddNode: (type: NodeType) => void }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full bg-background hover:bg-muted shadow-md">
                    <Plus className="h-5 w-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
                <div className="space-y-1">
                    {blockTypes.map(block => (
                         <Button key={block.type} variant="ghost" className="w-full justify-start" onClick={() => onAddNode(block.type as NodeType)}>
                            <block.icon className="mr-2 h-4 w-4"/>
                            {block.label}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

function GenerateFlowDialog({ onFlowGenerated }: { onFlowGenerated: (nodes: CrmAutomationNode[], edges: CrmAutomationEdge[]) => void }) {
    const [prompt, setPrompt] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, startGeneration] = useTransition();

    const handleGenerate = () => {
        startGeneration(async () => {
            const result = await generateCrmAutomation({ prompt });
            onFlowGenerated(result.nodes, result.edges);
            setIsOpen(false);
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline"><Wand2 className="mr-2 h-4 w-4" />Generate with AI</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Generate Automation with AI</DialogTitle>
                    <DialogDescription>Describe the workflow you want to create, and the AI will build it for you.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea placeholder="e.g. When a contact is tagged 'new_lead', wait 1 day, then send the 'Welcome Email'..." value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-32"/>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
                        {isGenerating && <LoaderCircle className="mr-2 h-4 w-4 animate-spin/>} Generate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
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
    }, [currentFlow]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const handleCreateNewFlow = () => {
        const startNode = { id: 'start', type: 'triggerTagAdded' as NodeType, data: { label: 'Trigger: Tag Added' }, position: { x: 0, y: 0 } };
        setCurrentFlow(null);
        setNodes([startNode]);
        setEdges([]);
        setSelectedNodeId(null);
    };
    
    const handleAddNode = (type: NodeType, sourceNodeId: string, sourceHandle?: string) => {
        const newNodeId = `${type}-${Date.now()}`;
        const newNode: CrmAutomationNode = {
            id: newNodeId, type, data: { label: `New ${type.replace('action', '')}` }, position: { x: 0, y: 0 },
        };
        const newEdge: CrmAutomationEdge = {
            id: `edge-${sourceNodeId}-${newNodeId}`,
            source: sourceNodeId,
            target: newNodeId,
            sourceHandle
        };
        setNodes(prev => [...prev, newNode]);
        setEdges(prev => [...prev, newEdge]);
    };
    
    const updateNodeData = (nodeId: string, data: Partial<any>) => {
        setNodes(prev => prev.map(node => 
            node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        ));
    };

    const handleSaveFlow = async () => {
        const nameInput = document.getElementById('automation-name-input') as HTMLInputElement;
        if(!nameInput || !nameInput.value) {
            toast({title: "Error", description: "Automation name is required.", variant: 'destructive'});
            return;
        }

        startSaveTransition(async () => {
            const result = await saveCrmAutomation({
                flowId: currentFlow?._id.toString(),
                name: nameInput.value,
                nodes,
                edges,
            });
            if (result.error) toast({title: "Error", description: result.error, variant: 'destructive'});
            else {
                toast({title: "Success", description: result.message});
                if (result.flowId) await handleSelectFlow(result.flowId);
                fetchFlows();
            }
        });
    };
    
    const handleDeleteFlow = async () => {
        if (!currentFlow) return;
        const result = await deleteCrmAutomation(currentFlow._id.toString());
        if(result.error) toast({title: "Error", description: result.error, variant: 'destructive'});
        else {
            toast({title: "Success", description: result.message});
            setCurrentFlow(null);
            fetchFlows();
        }
    }
    
    const handleFlowGenerated = (newNodes: CrmAutomationNode[], newEdges: CrmAutomationEdge[]) => {
        setCurrentFlow(null);
        setNodes(newNodes);
        setEdges(newEdges);
        setSelectedNodeId(null);
        toast({title: "Flow Generated!", description: "Your new workflow is ready to be configured."});
    };
    
    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    const renderNodeAndChildren = (nodeId: string): (JSX.Element | null)[] => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return [null];
    
        const childrenEdges = edges.filter(e => e.source === nodeId);
    
        return [
            <div key={node.id} className="flex flex-col items-center">
                <NodeComponent
                    node={node}
                    isSelected={selectedNodeId === nodeId}
                    onSelect={() => setSelectedNodeId(nodeId)}
                />
            </div>,
            ...childrenEdges.map(edge => (
                <div key={edge.id} className="flex flex-col items-center">
                    <div className="h-8 w-px bg-border my-2" />
                    <AddActionPopover onAddNode={(type) => handleAddNode(type, nodeId, edge.sourceHandle)} />
                    <div className="h-8 w-px bg-border my-2" />
                    {renderNodeAndChildren(edge.target)}
                </div>
            ))
        ];
    };

    return (
        <div className="flex h-[calc(100vh-theme(spacing.20))] bg-muted/30">
            <aside className="w-72 bg-background border-r p-4 flex flex-col gap-4">
                <h2 className="text-xl font-bold">Automations</h2>
                <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={handleCreateNewFlow}><Plus className="mr-2 h-4 w-4"/>New</Button>
                    <GenerateFlowDialog onFlowGenerated={handleFlowGenerated} />
                </div>
                <ScrollArea className="flex-1 -mx-4">
                    <div className="px-4">
                        {flows.map(flow => (
                            <Button key={flow._id.toString()} variant="ghost" className={cn("w-full justify-start", currentFlow?._id.toString() === flow._id.toString() && 'bg-muted')} onClick={() => handleSelectFlow(flow._id.toString())}>
                                {flow.name}
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
                <div className="mt-auto">
                    <Button variant="ghost" className="w-full justify-start" asChild>
                        <Link href="/dashboard/crm/automations/docs"><BookOpen className="mr-2 h-4 w-4" />Documentation</Link>
                    </Button>
                </div>
            </aside>
            <div className="flex-1 flex flex-col">
                 <header className="flex-shrink-0 flex items-center justify-between p-3 bg-card border-b">
                     <div className="flex items-center gap-2">
                        <Input id="automation-name-input" key={currentFlow?._id.toString()} defaultValue={currentFlow?.name || 'New Automation'} className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Last run: N/A</span>
                        <div className="flex items-center gap-2"><Label htmlFor="enabled-switch" className="text-sm">Enabled</Label><Switch id="enabled-switch" /></div>
                        <Button variant="outline" size="sm"><Webhook className="mr-2 h-4 w-4"/>Get Webhook URL</Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" className="h-8 w-8" disabled={!currentFlow}><Trash2 className="h-4 w-4"/></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete this automation.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteFlow}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <Button onClick={handleSaveFlow} disabled={isSaving}>
                            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                            Save
                        </Button>
                    </div>
                 </header>
                 <main className="flex-1 grid grid-cols-12 overflow-hidden">
                    <ScrollArea className="col-span-8 p-8">
                        <div className="flex justify-center">
                            {nodes.length > 0 && renderNodeAndChildren(nodes[0].id)}
                        </div>
                    </ScrollArea>
                    <aside className="col-span-4 bg-background border-l p-4">
                        {selectedNode ? (
                           <CrmAutomationBlockEditor node={selectedNode} onUpdate={(data) => updateNodeData(selectedNodeId!, data)} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-center">
                                <p>Select a block to configure its properties.</p>
                            </div>
                        )}
                    </aside>
                 </main>
            </div>
        </div>
    );
}
