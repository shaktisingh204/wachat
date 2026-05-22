'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Button,
  Card,
  Input,
  Label,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ScrollArea,
  Switch,
  useZoruToast,
} from '@/components/zoruui';
import React, { useState, useEffect, useCallback, useTransition } from 'react';

import {
    GitFork,
    Play,
    Trash2,
    Save,
    Plus,
    LoaderCircle,
    BookOpen,
    Wand2,
    Webhook,
    MessageSquare,
    Tag,
    FolderKanban,
    Clock,
    Zap,
} from 'lucide-react';

import {
  getCrmAutomations,
  getCrmAutomationById,
  saveCrmAutomation,
  deleteCrmAutomation,
  generateCrmAutomation,
} from '@/app/actions/crm-automations.actions';
import type { CrmAutomation, CrmAutomationNode, CrmAutomationEdge } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { cn } from '@/lib/utils';

import { CrmAutomationBlockEditor } from '@/components/wabasimplify/crm-automation-block-editor';

import Link from 'next/link';

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
        <ZoruCard
            onClick={onSelect}
            className={cn(
                'p-0 w-80 cursor-pointer transition-shadow hover:shadow-md',
                isSelected && 'ring-2 ring-primary',
            )}
        >
            <div className="flex flex-row items-center gap-4 p-4">
                <div className="rounded-lg bg-secondary p-2">
                    <BlockIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                    <p className="text-[14px] font-semibold text-foreground">{node.data.label}</p>
                    {node.type === 'triggerTagAdded' && node.data.tagName && (
                        <p className="text-[12px] text-muted-foreground">Tag: {node.data.tagName}</p>
                    )}
                    {node.type === 'delay' && (
                        <p className="text-[12px] text-muted-foreground">
                            Wait for {node.data.delayValue || 1} {node.data.delayUnit || 'days'}
                        </p>
                    )}
                </div>
            </div>
        </ZoruCard>
    );
}

function AddActionPopover({ onAddNode, sourceNodeId, sourceHandle }: { onAddNode: (type: NodeType, sourceNodeId: string, sourceHandle?: string) => void; sourceNodeId: string; sourceHandle?: string; }) {
    return (
        <ZoruPopover>
            <ZoruPopoverTrigger asChild>
                <ZoruButton variant="outline" size="icon" className="rounded-full bg-background hover:bg-muted shadow-md">
                    <Plus className="h-5 w-5" />
                </ZoruButton>
            </ZoruPopoverTrigger>
            <ZoruPopoverContent className="w-64 p-2">
                <div className="space-y-1">
                    {blockTypes.map(block => (
                         <ZoruButton key={block.type} variant="ghost" className="w-full justify-start" onClick={() => onAddNode(block.type as NodeType, sourceNodeId, sourceHandle)}>
                            <block.icon className="mr-2 h-4 w-4"/>
                            {block.label}
                        </ZoruButton>
                    ))}
                </div>
            </ZoruPopoverContent>
        </ZoruPopover>
    )
}

export default function CrmAutomationsPage() {
    const { toast } = useZoruToast();
    const [flows, setFlows] = useState<WithId<CrmAutomation>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<CrmAutomation> | null>(null);
    const [nodes, setNodes] = useState<CrmAutomationNode[]>([]);
    const [edges, setEdges] = useState<CrmAutomationEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();

    // AI Generation State
    const [prompt, setPrompt] = useState('');
    const [isGenerating, startGeneration] = useTransition();

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

    const handleGenerateClick = () => {
        if (!prompt.trim()) return;
        startGeneration(async () => {
            const result = await generateCrmAutomation({ prompt });
            handleFlowGenerated(result.nodes, result.edges);
            setPrompt('');
        });
    };
    
    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    const renderNodeAndChildren = (nodeId: string): (React.ReactElement | null)[] => {
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
                    <AddActionPopover onAddNode={(type) => handleAddNode(type, nodeId, edge.sourceHandle)} sourceNodeId={nodeId} sourceHandle={edge.sourceHandle} />
                    <div className="h-8 w-px bg-border my-2" />
                    {renderNodeAndChildren(edge.target)}
                </div>
            ))
        ];
    };

    // ── KPI strip (sidebar): Active · Total · Failed runs (deferred) · Avg success rate (deferred)
    const activeCount = flows.length;
    const totalRuns30d = 0; // Runtime engine deferred — see §1D scope notes
    const failedRuns = 0;
    const avgSuccess = 0;

    return (
        <div className="flex h-[calc(100vh-theme(spacing.20))] bg-muted/30">
            <aside className="w-72 bg-background border-r p-4 flex flex-col gap-4">
                <h2 className="text-xl font-bold">Automations</h2>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded border bg-card p-2">
                        <div className="text-muted-foreground">Active</div>
                        <div className="text-base font-semibold">{activeCount}</div>
                    </div>
                    <div className="rounded border bg-card p-2">
                        <div className="text-muted-foreground">Runs 30d</div>
                        <div className="text-base font-semibold">{totalRuns30d}</div>
                    </div>
                    <div className="rounded border bg-card p-2">
                        <div className="text-muted-foreground">Failed</div>
                        <div className="text-base font-semibold">{failedRuns}</div>
                    </div>
                    <div className="rounded border bg-card p-2">
                        <div className="text-muted-foreground">Success</div>
                        <div className="text-base font-semibold">{avgSuccess}%</div>
                    </div>
                </div>
                <p className="text-[10.5px] text-muted-foreground">
                    Run metrics will populate once the automation runtime ships. Rule
                    configs persist today.
                </p>
                <div className="flex gap-2">
                    <ZoruButton size="sm" className="flex-1" onClick={handleCreateNewFlow}><Plus className="mr-2 h-4 w-4"/>New</ZoruButton>
                </div>
                <ZoruScrollArea className="flex-1 -mx-4">
                    <div className="px-4">
                        {flows.map(flow => (
                            <ZoruButton key={flow._id.toString()} variant="ghost" className={cn("w-full justify-start", currentFlow?._id.toString() === flow._id.toString() && 'bg-muted')} onClick={() => handleSelectFlow(flow._id.toString())}>
                                {flow.name}
                            </ZoruButton>
                        ))}
                    </div>
                </ZoruScrollArea>
                <div className="mt-auto">
                    <ZoruButton variant="ghost" className="w-full justify-start" asChild>
                        <Link href="/dashboard/crm/automations/docs"><BookOpen className="mr-2 h-4 w-4" />Documentation</Link>
                    </ZoruButton>
                </div>
            </aside>
            <div className="flex-1 flex flex-col relative">
                 <header className="flex-shrink-0 flex items-center justify-between p-3 bg-card border-b">
                     <div className="flex items-center gap-2">
                        <ZoruInput id="automation-name-input" key={currentFlow?._id.toString()} defaultValue={currentFlow?.name || 'New Automation'} className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Last run: N/A</span>
                        <div className="flex items-center gap-2"><ZoruLabel htmlFor="enabled-switch" className="text-sm">Enabled</ZoruLabel><ZoruSwitch id="enabled-switch" /></div>
                        <ZoruButton variant="outline" size="sm"><Webhook className="mr-2 h-4 w-4"/>Get Webhook URL</ZoruButton>
                        <ZoruAlertDialog>
                            <ZoruAlertDialogTrigger asChild>
                                <ZoruButton variant="destructive" size="icon" className="h-8 w-8" disabled={!currentFlow}><Trash2 className="h-4 w-4"/></ZoruButton>
                            </ZoruAlertDialogTrigger>
                            <ZoruAlertDialogContent>
                                <ZoruAlertDialogHeader><ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle><ZoruAlertDialogDescription>This action will permanently delete this automation.</ZoruAlertDialogDescription></ZoruAlertDialogHeader>
                                <ZoruAlertDialogFooter>
                                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                    <ZoruAlertDialogAction onClick={handleDeleteFlow}>Delete</ZoruAlertDialogAction>
                                </ZoruAlertDialogFooter>
                            </ZoruAlertDialogContent>
                        </ZoruAlertDialog>
                        <ZoruButton onClick={handleSaveFlow} disabled={isSaving}>
                            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                            Save
                        </ZoruButton>
                    </div>
                 </header>
                 <main className="flex-1 grid grid-cols-12 overflow-hidden">
                    <ZoruScrollArea className="col-span-8 p-8">
                        <div className="flex justify-center">
                            {nodes.length > 0 && renderNodeAndChildren(nodes[0].id)}
                        </div>
                    </ZoruScrollArea>
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
                  <ZoruCard
                    className="p-0 absolute bottom-4 left-1/2 z-10 w-full max-w-lg -translate-x-1/2"
                  >
                    <div className="p-2">
                        <div className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <ZoruInput
                                placeholder="Describe your workflow and let AI build it..."
                                className="border-none shadow-none focus-visible:ring-0"
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                            />
                            <ZoruButton
                               
                                onClick={handleGenerateClick}
                                disabled={isGenerating || !prompt.trim()}
                               
                            >
                                Generate
                            </ZoruButton>
                        </div>
                    </div>
                </ZoruCard>
            </div>
        </div>
    );
}
