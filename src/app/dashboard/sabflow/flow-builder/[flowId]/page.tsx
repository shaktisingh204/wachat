'use client';

import React, { useState, useCallback, useRef, useEffect, useTransition, use } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    BackgroundVariant,
    Panel,
    Connection,
    Edge,
    Node,
    OnConnect,
    NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save, Settings2, ArrowLeft, BookOpen, Plus, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/context/project-context';
import { getSabFlowById, saveSabFlow } from '@/app/actions/sabflow.actions';
import { getSession } from '@/app/actions';
import { SabFlowSidebar } from '@/components/wabasimplify/sabflow/flow-builder/SabFlowSidebar';
import SabFlowCustomNode from '@/components/wabasimplify/sabflow/flow-builder/SabFlowCustomNode';
import { SabFlowPropertiesPanel } from '@/components/wabasimplify/sabflow/flow-builder/SabFlowPropertiesPanel';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { validateFlow } from '@/lib/sabflow/validation';

const nodeTypes: NodeTypes = {
    action: SabFlowCustomNode,
    trigger: SabFlowCustomNode,
    condition: SabFlowCustomNode,
    start: SabFlowCustomNode,
};

let id = 0;
const getId = () => `dndnode_${Date.now()}_${id++}`;

const SabFlowBuilder = ({ flowId }: { flowId: string }) => {
    const router = useRouter();
    const { activeProjectId } = useProject();
    const { toast } = useToast();

    // React Flow state
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

    // App state
    const [currentFlow, setCurrentFlow] = useState<any>(null);
    const [flowName, setFlowName] = useState('New Flow');
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isPropsOpen, setIsPropsOpen] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        getSession().then(session => {
            setUser(session?.user);
        });
    }, []);

    // Load flow
    useEffect(() => {
        startLoadingTransition(async () => {
            if (flowId === 'new-flow') {
                // Initialize with a simple manual trigger
                setNodes([{
                    id: 'start_trigger',
                    type: 'trigger',
                    position: { x: 100, y: 100 },
                    data: { name: 'Start', triggerType: 'manual' }
                }]);
                setCurrentFlow(null);
                setFlowName('New Flow');
            } else {
                const flow = await getSabFlowById(flowId);
                if (!flow) {
                    toast({ title: 'Error', description: 'Flow not found', variant: 'destructive' });
                    // router.push('/dashboard/sabflow/flow-builder');
                    return;
                }
                setCurrentFlow(flow);
                setFlowName(flow.name);
                setNodes(flow.nodes || []);
                setEdges(flow.edges || []);
            }
        });
    }, [flowId, toast]);

    const onConnect: OnConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const dataString = event.dataTransfer.getData('application/reactflow');
            if (!dataString) return;

            try {
                const { type, appId } = JSON.parse(dataString);

                if (typeof type === 'undefined' || !type) {
                    return;
                }

                // Check if the drop target is the flow pane
                const position = reactFlowInstance.screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });

                const newNode: Node = {
                    id: getId(),
                    type,
                    position,
                    data: {
                        name: type === 'condition' ? 'New Condition' : 'New Action',
                        appId: appId || '',
                        connectionId: '',
                        actionName: '',
                        inputs: {}
                    },
                };

                setNodes((nds) => nds.concat(newNode));
            } catch (error) {
                console.error("Error parsing drop data", error);
            }
        },
        [reactFlowInstance],
    );

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        setIsPropsOpen(true);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
        setIsPropsOpen(false);
    }, []);

    const handleSave = async () => {
        if (!flowName) {
            toast({ title: 'Error', description: 'Flow name is required', variant: 'destructive' });
            return;
        }

        const validation = validateFlow(nodes, edges);
        if (!validation.isValid) {
            const errorCount = validation.errors.filter(e => e.type === 'error').length;
            const warningCount = validation.errors.filter(e => e.type === 'warning').length;

            toast({
                title: 'Validation Failed',
                description: `Found ${errorCount} error(s). Please resolve them before saving.`,
                variant: 'destructive'
            });
            return;
        }

        const triggerNode = nodes.find(n => n.type === 'trigger');
        const flowData = {
            flowId: currentFlow?._id?.toString() || (flowId === 'new-flow' ? undefined : flowId),
            name: flowName,
            nodes: nodes as any,
            edges: edges as any,
            trigger: triggerNode ? triggerNode.data : {},
        };

        startSaveTransition(async () => {
            const formData = new FormData();
            // Manually constructing what server action expects if it expects FormData. 
            // But saveSabFlow signature is `(prevState: any, formData: FormData) => Promise<any>`.
            // Wait, the original code used `useActionState(saveSabFlow, ...)` which hooks into form submission.
            // But we want to call it programmatically.
            // We can pass a mock formData or call it differently if it supports direct object. 
            // Checking safeSabFlow signature: `export async function saveSabFlow(prevState: any, formData: FormData)`
            // It ONLY takes FormData. So we must append data to FormData.

            formData.append('flowId', flowData.flowId || '');
            formData.append('name', flowData.name);
            formData.append('nodes', JSON.stringify(flowData.nodes));
            formData.append('edges', JSON.stringify(flowData.edges));
            formData.append('trigger', JSON.stringify(flowData.trigger));
            formData.append('status', currentFlow?.status || 'ACTIVE');

            const result = await saveSabFlow({ message: null, error: null }, formData);

            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'Flow saved successfully' });
                if (result.flowId && (!currentFlow || currentFlow._id.toString() !== result.flowId)) {
                    setCurrentFlow({ ...currentFlow, _id: result.flowId });
                    if (flowId === 'new-flow') {
                        router.replace(`/dashboard/sabflow/flow-builder/${result.flowId}`);
                    }
                }
            }
        });
    };

    const onNodeUpdate = useCallback((id: string, newData: any) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === id) {
                return { ...node, data: { ...node.data, ...newData } };
            }
            return node;
        }));
        setSelectedNode((prev) => {
            if (!prev || prev.id !== id) return prev;
            return { ...prev, data: { ...prev.data, ...newData } } as Node;
        });
    }, [setNodes]);

    const onDeleteNode = useCallback((id: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setSelectedNode(null);
        setIsPropsOpen(false);
    }, [setNodes, setEdges]);

    // Auto-open properties when a new node is added (optional, but good UX)
    useEffect(() => {
        if (nodes.length > 0) {
            // Logic to auto select the last added node? Maybe too intrusive.
        }
    }, [nodes.length]);

    // Sync React Flow selection with our state if needed, or rely on onNodeClick

    const isPaused = currentFlow?.status === 'PAUSED';

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            {/* Header */}
            <header className="relative flex h-14 items-center justify-between border-b px-4 lg:h-[60px] shrink-0 bg-background/85 backdrop-blur-xl">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
                <div className="relative flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-muted-foreground hover:text-foreground">
                        <Link href="/dashboard/sabflow/flow-builder">
                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                            Back
                        </Link>
                    </Button>
                    <div className="h-6 w-px bg-border" />
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 shrink-0 rounded-md bg-violet-500/10 border border-border/40 flex items-center justify-center">
                            <Save className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <Input
                            value={flowName}
                            onChange={(e) => setFlowName(e.target.value)}
                            className="h-8 w-56 font-semibold bg-muted/30 border-border/60 focus-visible:bg-background"
                            placeholder="Untitled Flow"
                        />
                    </div>
                </div>
                <div className="relative flex items-center gap-2">
                    <Button variant="ghost" size="sm" asChild className="h-8">
                        <Link href="/dashboard/sabflow/docs" target="_blank">
                            <BookOpen className="mr-1.5 h-4 w-4" />
                            Docs
                        </Link>
                    </Button>
                    <div className={cn(
                        "flex items-center gap-2 h-8 px-2.5 rounded-md border transition-colors",
                        isPaused
                            ? "border-amber-500/40 bg-amber-500/5"
                            : "border-emerald-500/40 bg-emerald-500/5"
                    )}>
                        <span className="flex items-center gap-1.5">
                            <span className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isPaused ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                            )} />
                            <span className={cn(
                                "text-[10px] font-bold uppercase tracking-[0.12em]",
                                isPaused ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                            )}>
                                {isPaused ? 'Paused' : 'Active'}
                            </span>
                        </span>
                        <Switch
                            checked={!isPaused}
                            onCheckedChange={(checked) => setCurrentFlow({ ...currentFlow, status: checked ? 'ACTIVE' : 'PAUSED' })}
                        />
                    </div>
                    <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 shadow-sm">
                        {isSaving ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                        Save Flow
                    </Button>

                    <Sheet open={isPropsOpen} onOpenChange={setIsPropsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Settings2 className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="p-0 sm:max-w-md w-full">
                            <SheetHeader className="sr-only">
                                <SheetTitle>Properties</SheetTitle>
                            </SheetHeader>
                            {selectedNode && (
                                <SabFlowPropertiesPanel
                                    node={selectedNode}
                                    onUpdate={onNodeUpdate}
                                    deleteNode={onDeleteNode}
                                    user={user}
                                    flowId={flowId}
                                />
                            )}
                        </SheetContent>
                    </Sheet>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Canvas */}
                <div className="flex-1 h-full w-full relative" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        fitView
                        proOptions={{ hideAttribution: true }}
                        snapToGrid
                        defaultEdgeOptions={{
                            type: 'default',
                            animated: true,
                        }}
                    >
                        <Controls />
                        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

                        <Panel position="top-left" className="m-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        size="icon"
                                        className="h-12 w-12 rounded-full shadow-xl bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-95 ring-2 ring-background"
                                        aria-label="Add block"
                                    >
                                        <Plus className="h-6 w-6 text-white" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent side="right" align="start" className="w-85 p-0 ml-4 max-h-[80vh] overflow-hidden bg-background/95 backdrop-blur-xl shadow-2xl border-border/60">
                                    <div className="relative p-4 border-b bg-gradient-to-br from-violet-500/5 via-transparent to-emerald-500/5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-md bg-violet-500/10 border border-border/40 flex items-center justify-center">
                                                <Plus className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold leading-none text-sm">Add Block</h4>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">Drag blocks onto the canvas</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-100">
                                        <SabFlowSidebar className="w-full" />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </Panel>
                    </ReactFlow>
                </div>

                {/* Right Panel (Desktop) */}
                {selectedNode && isPropsOpen && (
                    <aside className="w-80 border-l bg-background hidden md:block overflow-hidden shrink-0 z-10 shadow-[-5px_0_15px_-5px_hsl(var(--foreground)/0.05)]">
                        <SabFlowPropertiesPanel
                            node={selectedNode}
                            onUpdate={onNodeUpdate}
                            deleteNode={onDeleteNode}
                            user={user}
                            flowId={flowId}
                        />
                    </aside>
                )}
            </div>
        </div>
    );
};

export default function SabFlowBuilderPageWrapper({ params }: { params: Promise<{ flowId: string }> }) {
    const { flowId } = use(params);

    return (
        <ReactFlowProvider>
            <SabFlowBuilder flowId={flowId} />
        </ReactFlowProvider>
    );
}
