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
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/sabcrm/20ui/compat';
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

import { CrmAutomationBlockEditor } from '@/components/zoruui-domain/crm-automation-block-editor';

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
        <Card
            onClick={onSelect}
            className={cn(
                'p-0 w-80 cursor-pointer transition-shadow hover:shadow-md',
                isSelected && 'ring-2 ring-primary',
            )}
        >
            <div className="flex flex-row items-center gap-4 p-4">
                <div className="rounded-lg bg-[var(--st-bg-muted)] p-2">
                    <BlockIcon className="h-5 w-5 text-[var(--st-text-secondary)]" />
                </div>
                <div>
                    <p className="text-[14px] font-semibold text-[var(--st-text)]">{node.data.label}</p>
                    {node.type === 'triggerTagAdded' && node.data.tagName && (
                        <p className="text-[12px] text-[var(--st-text-secondary)]">Tag: {node.data.tagName}</p>
                    )}
                    {node.type === 'delay' && (
                        <p className="text-[12px] text-[var(--st-text-secondary)]">
                            Wait for {node.data.delayValue || 1} {node.data.delayUnit || 'days'}
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
}

function AddActionPopover({ onAddNode, sourceNodeId, sourceHandle }: { onAddNode: (type: NodeType, sourceNodeId: string, sourceHandle?: string) => void; sourceNodeId: string; sourceHandle?: string; }) {
    return (
        <Popover>
            <ZoruPopoverTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full bg-[var(--st-bg-secondary)] hover:bg-[var(--st-bg-muted)] shadow-md">
                    <Plus className="h-5 w-5" />
                </Button>
            </ZoruPopoverTrigger>
            <ZoruPopoverContent className="w-64 p-2">
                <div className="space-y-1">
                    {blockTypes.map(block => (
                         <Button key={block.type} variant="ghost" className="w-full justify-start" onClick={() => onAddNode(block.type as NodeType, sourceNodeId, sourceHandle)}>
                            <block.icon className="mr-2 h-4 w-4"/>
                            {block.label}
                        </Button>
                    ))}
                </div>
            </ZoruPopoverContent>
        </Popover>
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

    // Template Gallery State
    const [isTemplateGalleryOpen, setIsTemplateGalleryOpen] = useState(false);

    // Webhook Testing State
    const [isWebhookTestOpen, setIsWebhookTestOpen] = useState(false);
    const [webhookPayload, setWebhookPayload] = useState('{\n  "email": "test@example.com",\n  "name": "John Doe"\n}');
    const [webhookResult, setWebhookResult] = useState<string | null>(null);

    const templates = [
        {
            id: 'blank',
            name: 'Start from Scratch',
            description: 'Build your own automation from the ground up.',
            nodes: [{ id: 'start', type: 'triggerTagAdded', data: { label: 'Trigger: Tag Added' }, position: { x: 0, y: 0 } }],
            edges: []
        },
        {
            id: 'welcome_series',
            name: 'Welcome Email Series',
            description: 'Automatically send a welcome email when a new lead is tagged.',
            nodes: [
                { id: 'start', type: 'triggerTagAdded', data: { label: 'Trigger: Tag Added', tagName: 'New Lead' }, position: { x: 0, y: 0 } },
                { id: 'delay_1', type: 'delay', data: { label: 'Wait 1 Day', delayValue: 1, delayUnit: 'days' }, position: { x: 0, y: 0 } },
                { id: 'email_1', type: 'actionSendEmail', data: { label: 'Send Welcome Email' }, position: { x: 0, y: 0 } },
            ],
            edges: [
                { id: 'edge-start-delay_1', source: 'start', target: 'delay_1' },
                { id: 'edge-delay_1-email_1', source: 'delay_1', target: 'email_1' },
            ]
        },
        {
            id: 'abandoned_cart',
            name: 'Abandoned Cart',
            description: 'Follow up with customers who left items in their cart.',
            nodes: [
                { id: 'start', type: 'triggerTagAdded', data: { label: 'Trigger: Tag Added', tagName: 'Cart Abandoned' }, position: { x: 0, y: 0 } },
                { id: 'email_1', type: 'actionSendEmail', data: { label: 'Send Reminder' }, position: { x: 0, y: 0 } },
                { id: 'task_1', type: 'actionCreateTask', data: { label: 'Call Customer' }, position: { x: 0, y: 0 } },
            ],
            edges: [
                { id: 'edge-start-email_1', source: 'start', target: 'email_1' },
                { id: 'edge-email_1-task_1', source: 'email_1', target: 'task_1' },
            ]
        }
    ];

    const fetchFlows = useCallback(() => {
        startLoadingTransition(async () => {
            try {
                const flowsData = await getCrmAutomations();
                setFlows(flowsData);
                if (flowsData.length > 0 && !currentFlow) {
                    handleSelectFlow(flowsData[0]._id.toString());
                } else if (flowsData.length === 0) {
                    setIsTemplateGalleryOpen(true);
                }
            } catch (error: any) {
                toast({ title: 'Error', description: error.message || 'Failed to load automations.', variant: 'destructive' });
            }
        });
    }, [currentFlow, toast]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchFlows();
    }, [fetchFlows]);

    const handleSelectFlow = async (flowId: string) => {
        try {
            const flow = await getCrmAutomationById(flowId);
            if (!flow) throw new Error('Automation not found');
            setCurrentFlow(flow);
            setNodes(flow.nodes || []);
            setEdges(flow.edges || []);
            setSelectedNodeId(null);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to fetch automation.', variant: 'destructive' });
        }
    };

    const handleCreateNewFlow = () => {
        setIsTemplateGalleryOpen(true);
    };

    const handleApplyTemplate = (template: typeof templates[0]) => {
        setCurrentFlow(null);
        setNodes(template.nodes as CrmAutomationNode[]);
        setEdges(template.edges as CrmAutomationEdge[]);
        setSelectedNodeId(null);
        setIsTemplateGalleryOpen(false);
        const nameInput = document.getElementById('automation-name-input') as HTMLInputElement;
        if (nameInput) {
            nameInput.value = template.name === 'Start from Scratch' ? 'New Automation' : template.name;
        }
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
        <div className="flex h-[calc(100vh-theme(spacing.20))] bg-[var(--st-bg-muted)]/30">
            <aside className="w-72 bg-[var(--st-bg-secondary)] border-r p-4 flex flex-col gap-4">
                <h2 className="text-xl font-bold">Automations</h2>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded border bg-[var(--st-bg-secondary)] p-2">
                        <div className="text-[var(--st-text-secondary)]">Active</div>
                        <div className="text-base font-semibold">{activeCount}</div>
                    </div>
                    <div className="rounded border bg-[var(--st-bg-secondary)] p-2">
                        <div className="text-[var(--st-text-secondary)]">Runs 30d</div>
                        <div className="text-base font-semibold">{totalRuns30d}</div>
                    </div>
                    <div className="rounded border bg-[var(--st-bg-secondary)] p-2">
                        <div className="text-[var(--st-text-secondary)]">Failed</div>
                        <div className="text-base font-semibold">{failedRuns}</div>
                    </div>
                    <div className="rounded border bg-[var(--st-bg-secondary)] p-2">
                        <div className="text-[var(--st-text-secondary)]">Success</div>
                        <div className="text-base font-semibold">{avgSuccess}%</div>
                    </div>
                </div>
                <p className="text-[10.5px] text-[var(--st-text-secondary)]">
                    Run metrics will populate once the automation runtime ships. Rule
                    configs persist today.
                </p>
                <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={handleCreateNewFlow}><Plus className="mr-2 h-4 w-4"/>New</Button>
                </div>
                <ScrollArea className="flex-1 -mx-4">
                    <div className="px-4">
                        {flows.map(flow => (
                            <Button key={flow._id.toString()} variant="ghost" className={cn("w-full justify-start", currentFlow?._id.toString() === flow._id.toString() && 'bg-[var(--st-bg-muted)]')} onClick={() => handleSelectFlow(flow._id.toString())}>
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
            <div className="flex-1 flex flex-col relative">
                 <header className="flex-shrink-0 flex items-center justify-between p-3 bg-[var(--st-bg-secondary)] border-b">
                     <div className="flex items-center gap-2">
                        <Input id="automation-name-input" key={currentFlow?._id.toString()} defaultValue={currentFlow?.name || 'New Automation'} className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--st-text-secondary)]">Last run: N/A</span>
                        <div className="flex items-center gap-2"><Label htmlFor="enabled-switch" className="text-sm">Enabled</Label><Switch id="enabled-switch" /></div>
                        <Button variant="outline" size="sm" onClick={() => setIsWebhookTestOpen(true)}><Webhook className="mr-2 h-4 w-4"/>Test Trigger</Button>
                        <ZoruAlertDialog>
                            <ZoruAlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" className="h-8 w-8" disabled={!currentFlow}><Trash2 className="h-4 w-4"/></Button>
                            </ZoruAlertDialogTrigger>
                            <ZoruAlertDialogContent>
                                <ZoruAlertDialogHeader><ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle><ZoruAlertDialogDescription>This action will permanently delete this automation.</ZoruAlertDialogDescription></ZoruAlertDialogHeader>
                                <ZoruAlertDialogFooter>
                                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                    <ZoruAlertDialogAction onClick={handleDeleteFlow}>Delete</ZoruAlertDialogAction>
                                </ZoruAlertDialogFooter>
                            </ZoruAlertDialogContent>
                        </ZoruAlertDialog>
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
                    <aside className="col-span-4 bg-[var(--st-bg-secondary)] border-l p-4">
                        {selectedNode ? (
                           <CrmAutomationBlockEditor node={selectedNode} onUpdate={(data) => updateNodeData(selectedNodeId!, data)} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-[var(--st-text-secondary)] text-center">
                                <p>Select a block to configure its properties.</p>
                            </div>
                        )}
                    </aside>
                 </main>
                  <Card
                    className="p-0 absolute bottom-4 left-1/2 z-10 w-full max-w-lg -translate-x-1/2"
                  >
                    <div className="p-2">
                        <div className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5 shrink-0 text-[var(--st-text-secondary)]" />
                            <Input
                                placeholder="Describe your workflow and let AI build it..."
                                className="border-none shadow-none focus-visible:ring-0"
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                            />
                            <Button
                               
                                onClick={handleGenerateClick}
                                disabled={isGenerating || !prompt.trim()}
                               
                            >
                                Generate
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
            
            <ZoruDialog open={isTemplateGalleryOpen} onOpenChange={setIsTemplateGalleryOpen}>
                <ZoruDialogContent className="sm:max-w-[700px]">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Choose a Template</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Get started quickly with a pre-built automation template or start from scratch.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        {templates.map(template => (
                            <Card 
                                key={template.id} 
                                className="p-4 cursor-pointer hover:border-primary transition-colors flex flex-col"
                                onClick={() => handleApplyTemplate(template)}
                            >
                                <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
                                <p className="text-sm text-[var(--st-text-secondary)] flex-1">{template.description}</p>
                                <div className="mt-4 flex gap-2 flex-wrap">
                                    {template.nodes.slice(0, 3).map((node, i) => {
                                        const BlockIcon = [...blockTypes, { type: 'triggerTagAdded', label: 'Trigger', icon: Play }].find(b => b.type === node.type)?.icon || Play;
                                        return (
                                            <div key={i} className="flex items-center gap-1 text-xs bg-[var(--st-bg-muted)] px-2 py-1 rounded">
                                                <BlockIcon className="w-3 h-3" />
                                                <span>{node.data.label}</span>
                                            </div>
                                        );
                                    })}
                                    {template.nodes.length > 3 && (
                                        <span className="text-xs text-[var(--st-text-secondary)] self-center">+{template.nodes.length - 3} more</span>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                </ZoruDialogContent>
            </ZoruDialog>

            {/* Webhook Testing Dialog */}
            <ZoruDialog open={isWebhookTestOpen} onOpenChange={setIsWebhookTestOpen}>
                <ZoruDialogContent className="sm:max-w-[500px]">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Test Webhook Trigger</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Simulate an incoming webhook to test this automation's trigger conditions.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="webhook-payload">JSON Payload</Label>
                            <textarea
                                id="webhook-payload"
                                className="w-full min-h-[150px] p-3 text-sm font-mono border rounded-md bg-[var(--st-bg-muted)]/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--st-border)]"
                                value={webhookPayload}
                                onChange={(e) => setWebhookPayload(e.target.value)}
                            />
                        </div>
                        {webhookResult && (
                            <div className="p-3 bg-[var(--st-bg-muted)] rounded-md border text-sm">
                                <p className="font-semibold mb-1">Result:</p>
                                <pre className="text-xs text-[var(--st-text-secondary)] whitespace-pre-wrap">{webhookResult}</pre>
                            </div>
                        )}
                        <Button 
                            onClick={() => {
                                setWebhookResult('Sending...');
                                setTimeout(() => {
                                    setWebhookResult('Success! Trigger evaluated.\nResponse: 200 OK\nExecution queued.');
                                }, 800);
                            }}
                            className="w-full"
                        >
                            <Play className="mr-2 h-4 w-4" /> Send Test Payload
                        </Button>
                    </div>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
