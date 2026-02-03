'use client';

import { useState, useCallback, useRef, useEffect, useTransition, use } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    applyEdgeChanges,
    applyNodeChanges,
    Connection,
    Edge,
    Node,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    BackgroundVariant,
    Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save, Settings2, ArrowLeft, BookOpen, Play, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useProject } from '@/context/project-context';
import { getFlowById, saveFlow, getFlowsForProject } from '@/app/actions/flow.actions';
import { Sidebar } from '@/components/flow-builder/Sidebar';
import CustomNode from '@/components/flow-builder/CustomNode';
import { PropertiesPanel } from '@/components/wabasimplify/properties-panel';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const nodeTypes = {
    text: CustomNode,
    image: CustomNode,
    buttons: CustomNode,
    input: CustomNode,
    delay: CustomNode,
    condition: CustomNode,
    api: CustomNode,
    sendTemplate: CustomNode,
    triggerMetaFlow: CustomNode,
    sendSms: CustomNode,
    sendEmail: CustomNode,
    createCrmLead: CustomNode,
    generateShortLink: CustomNode,
    generateQrCode: CustomNode,
    start: CustomNode,
};

let id = 0;
const getId = () => `dndnode_${id++}`;

const FlowBuilder = ({ flowId }: { flowId: string }) => {
    const router = useRouter();
    const { activeProjectId } = useProject();
    const { toast } = useToast();

    // React Flow state
    const reactFlowWrapper = useRef(null);
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

    // Load flow
    useEffect(() => {
        if (activeProjectId) {
            startLoadingTransition(async () => {
                if (flowId === 'new') {
                    setNodes([{ id: 'start', type: 'start', position: { x: 50, y: 50 }, data: { label: 'Start Flow' } }]);
                    setCurrentFlow(null);
                    setFlowName('New Flow');
                } else {
                    loadFlow(flowId);
                }
            });
        }
    }, [activeProjectId, flowId]);

    const loadFlow = async (id: string) => {
        const flow = await getFlowById(id);
        if (!flow) {
            toast({ title: 'Error', description: 'Flow not found', variant: 'destructive' });
            router.push('/dashboard/flow-builder');
            return;
        }
        setCurrentFlow(flow);
        setFlowName(flow.name);

        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
    };

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

            const type = event.dataTransfer.getData('application/reactflow');

            // check if the dropped element is valid
            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });
            const newNode = {
                id: getId(),
                type,
                position,
                data: { label: `${type} node` },
            };

            setNodes((nds) => nds.concat(newNode));
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
        if (!activeProjectId) return;
        if (!flowName) {
            toast({ title: 'Error', description: 'Flow name is required', variant: 'destructive' });
            return;
        }

        startSaveTransition(async () => {
            // Serialize nodes and edges
            const flowData = {
                flowId: currentFlow?._id.toString(),
                projectId: activeProjectId,
                name: flowName,
                nodes: nodes as any,
                edges: edges as any,
                // Backend logic for triggerKeywords might need manual extraction from start node data if used
                // but usually the start node data contains it if editable there.
                // For now we assume they are managed in properties or separate logic.
                triggerKeywords: (nodes.find(n => n.type === 'start')?.data as any)?.triggerKeywords || [],
            };

            const result = await saveFlow(flowData);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'Flow saved successfully' });
                if (result.flowId && (!currentFlow || currentFlow._id.toString() !== result.flowId)) {
                    // Update current flow and URL if new
                    setCurrentFlow({ _id: result.flowId, name: flowName });
                    if (flowId === 'new') {
                        router.replace(`/dashboard/flow-builder/${result.flowId}`);
                    }
                }
            }
        });
    };

    const onNodeUpdate = (id: string, newData: any) => {
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
    };

    const onDeleteNode = (id: string) => {
        setNodes((nds) => nds.filter((n) => n.id !== id));
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setSelectedNode(null);
        setIsPropsOpen(false);
    };

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
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            {/* Header */}
            <header className="flex h-14 items-center justify-between border-b px-4 lg:h-[60px] bg-card">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/flow-builder" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Link>
                    <div className="h-6 w-px bg-border" />
                    <Input
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                        className="h-8 w-[200px] font-medium"
                        placeholder="Flow Name"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/flow-builder/docs" target="_blank">
                            <BookOpen className="mr-2 h-4 w-4" />
                            Docs
                        </Link>
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Flow
                    </Button>
                    <Sheet open={isPropsOpen} onOpenChange={setIsPropsOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Settings2 className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="p-0 sm:max-w-md">
                            <SheetHeader className="sr-only">
                                <SheetTitle>Properties</SheetTitle>
                            </SheetHeader>
                            {selectedNode && (
                                <PropertiesPanel
                                    node={selectedNode}
                                    onUpdate={onNodeUpdate}
                                    deleteNode={onDeleteNode}
                                    availableVariables={[]}
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
                    >
                        <Controls />
                        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

                        <Panel position="top-left" className="m-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button size="icon" className="h-12 w-12 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-all active:scale-95">
                                        <Plus className="h-6 w-6 text-primary-foreground" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent side="right" align="start" className="w-[340px] p-0 ml-4 max-h-[80vh] overflow-hidden bg-background/95 backdrop-blur-sm shadow-2xl border-muted">
                                    <div className="p-4 border-b">
                                        <h4 className="font-semibold leading-none">Add Block</h4>
                                        <p className="text-sm text-muted-foreground mt-1">Drag blocks to the canvas</p>
                                    </div>
                                    <ScrollArea className="h-[400px]">
                                        <div className="p-4 pt-2">
                                            <Sidebar className="w-full" />
                                        </div>
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>
                        </Panel>

                        {/* Helper text if needed, or remove since FAB is self-explanatory */}
                    </ReactFlow>
                </div>

                {/* Right Panel (Desktop) */}
                {selectedNode && isPropsOpen && (
                    <aside className="w-80 border-l bg-background hidden md:block overflow-y-auto shrink-0 z-10 shadow-[-5px_0_15px_-5px_hsl(var(--foreground)/0.05)]">
                        <PropertiesPanel
                            node={selectedNode}
                            onUpdate={onNodeUpdate}
                            deleteNode={onDeleteNode}
                            availableVariables={[]}
                        />
                    </aside>
                )}
            </div>
        </div>
    );
};

export default function FlowBuilderPageWrapper({ params }: { params: Promise<{ flowId: string }> }) {
    // Unwrapping params as they are a promise in newer Next.js versions (if applicable), 
    // or just using 'use' if it's available. For safety with Next.js 13/14+ server components 
    // passed to client, we can use a hook or just await if it was server.
    // However, this is a client component ('use client').
    // But params in Next.js 15+ are async. 
    // Let's use the 'use' hook for unwrap if we are on bleeding edge, or just standard prop access if older.
    // Assuming standard Next.js 14 behavior where params might be sync or async depending on config.
    // To be safe and compatible with recent changes:
    const { flowId } = use(params);

    return (
        <ReactFlowProvider>
            <FlowBuilder flowId={flowId} />
        </ReactFlowProvider>
    );
}
