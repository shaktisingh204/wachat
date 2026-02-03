'use client';

import { useState, useCallback, useRef, useEffect, useTransition } from 'react';
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
import { LoaderCircle, Save, Settings2, ArrowLeft, BookOpen, Play } from 'lucide-react';
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

const FlowBuilder = () => {
    const router = useRouter();
    const { activeProjectId } = useProject();
    const { toast } = useToast();

    // React Flow state
    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    // App state
    const [currentFlow, setCurrentFlow] = useState(null);
    const [flowName, setFlowName] = useState('New Flow');
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const [selectedNode, setSelectedNode] = useState(null);
    const [isPropsOpen, setIsPropsOpen] = useState(false);

    // Load flow
    useEffect(() => {
        if (activeProjectId) {
            startLoadingTransition(async () => {
                const flows = await getFlowsForProject(activeProjectId);
                if (flows.length > 0) {
                    // Load the first flow for now, or use URL param logic if present
                    // For simple reconstruction, we just load the most recent or create new
                    const flow = flows[0]; // Simplification for demo
                    loadFlow(flow._id.toString());
                } else {
                    // Init empty flow
                    setNodes([{ id: 'start', type: 'start', position: { x: 50, y: 50 }, data: { label: 'Start Flow' } }]);
                }
            });
        }
    }, [activeProjectId]);

    const loadFlow = async (flowId) => {
        const flow = await getFlowById(flowId);
        if (!flow) return;
        setCurrentFlow(flow);
        setFlowName(flow.name);

        // Restore nodes and edges (React Flow format)
        // Assuming backend data structure is compatible or we map it
        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
    };

    const onConnect: OnConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
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

    const onNodeClick = useCallback((event, node) => {
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
                nodes,
                edges,
                // Backend logic for triggerKeywords might need manual extraction from start node data if used
                triggerKeywords: [],
            };

            const result = await saveFlow(flowData);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'Flow saved successfully' });
                if (result.flowId && !currentFlow) {
                    // If it was a new flow, set currentFlow so future saves update it
                    setCurrentFlow({ _id: result.flowId, name: flowName });
                }
            }
        });
    };

    const onNodeUpdate = (id, newData) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === id) {
                return { ...node, data: { ...node.data, ...newData } };
            }
            return node;
        }));
        // Update selected node reference as well to keep UI in sync
        setSelectedNode((prev) => prev?.id === id ? { ...prev, data: { ...prev.data, ...newData } } : prev);
    };

    const onDeleteNode = (id) => {
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
                    <Link href="/dashboard" className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">
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
                                />
                            )}
                        </SheetContent>
                    </Sheet>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 hidden border-r bg-muted/10 md:block overflow-hidden">
                    <Sidebar />
                </aside>

                {/* Canvas */}
                <div className="flex-1 h-full w-full" ref={reactFlowWrapper}>
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
                        <Panel position="top-right" className="bg-background/50 p-2 rounded-lg backdrop-blur-sm border shadow-sm">
                            <div className="text-xs text-muted-foreground">
                                Drag blocks from the left sidebar
                            </div>
                        </Panel>
                    </ReactFlow>
                </div>

                {/* Right Panel (Desktop) */}
                {selectedNode && isPropsOpen && (
                    <aside className="w-80 border-l bg-background hidden md:block overflow-y-auto">
                        <PropertiesPanel
                            node={selectedNode}
                            onUpdate={onNodeUpdate}
                            deleteNode={onDeleteNode}
                        />
                    </aside>
                )}
            </div>
        </div>
    );
};

export default function FlowBuilderPage() {
    return (
        <ReactFlowProvider>
            <FlowBuilder />
        </ReactFlowProvider>
    );
}
