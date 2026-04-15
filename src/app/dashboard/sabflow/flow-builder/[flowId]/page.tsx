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
    Connection,
    Edge,
    Node,
    OnConnect,
    NodeTypes,
    MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
    LoaderCircle, Save, ArrowLeft, ChevronRight, ChevronLeft,
    PlayCircle, Zap, Share2, Eye,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/context/project-context';
import { getSabFlowById, saveSabFlow } from '@/app/actions/sabflow.actions';
import { getSession } from '@/app/actions';
import { SabFlowSidebar } from '@/components/wabasimplify/sabflow/flow-builder/SabFlowSidebar';
import SabFlowCustomNode from '@/components/wabasimplify/sabflow/flow-builder/SabFlowCustomNode';
import { SabFlowPropertiesPanel } from '@/components/wabasimplify/sabflow/flow-builder/SabFlowPropertiesPanel';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { validateFlow } from '@/lib/sabflow/validation';

// ─── Node types ────────────────────────────────────────────────────────────────
const nodeTypes: NodeTypes = {
    action: SabFlowCustomNode,
    trigger: SabFlowCustomNode,
    condition: SabFlowCustomNode,
    start: SabFlowCustomNode,
    // built-in block types (Typebot-style)
    text_bubble: SabFlowCustomNode,
    image_bubble: SabFlowCustomNode,
    video_bubble: SabFlowCustomNode,
    audio_bubble: SabFlowCustomNode,
    embed_bubble: SabFlowCustomNode,
    text_input: SabFlowCustomNode,
    number_input: SabFlowCustomNode,
    email_input: SabFlowCustomNode,
    phone_input: SabFlowCustomNode,
    date_input: SabFlowCustomNode,
    url_input: SabFlowCustomNode,
    file_input: SabFlowCustomNode,
    buttons: SabFlowCustomNode,
    rating: SabFlowCustomNode,
    payment: SabFlowCustomNode,
    set_variable: SabFlowCustomNode,
    redirect: SabFlowCustomNode,
    script: SabFlowCustomNode,
    wait: SabFlowCustomNode,
    ab_test: SabFlowCustomNode,
    jump: SabFlowCustomNode,
    filter: SabFlowCustomNode,
    webhook_trigger: SabFlowCustomNode,
    schedule: SabFlowCustomNode,
    manual: SabFlowCustomNode,
    ai_message: SabFlowCustomNode,
    ai_agent: SabFlowCustomNode,
    sticky_note: SabFlowCustomNode,
};

let _idCounter = 0;
const getId = () => `node_${Date.now()}_${_idCounter++}`;

// ─── Flow builder inner (needs ReactFlowProvider context) ──────────────────────
const SabFlowBuilder = ({ flowId }: { flowId: string }) => {
    const router = useRouter();
    const { toast } = useToast();

    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

    const [currentFlow, setCurrentFlow] = useState<any>(null);
    const [flowName, setFlowName] = useState('Untitled Flow');
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [user, setUser] = useState<any>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        getSession().then(s => setUser(s?.user));
    }, []);

    // ── Load flow ─────────────────────────────────────────────────────────────
    useEffect(() => {
        startLoadingTransition(async () => {
            if (flowId === 'new-flow') {
                setNodes([{
                    id: 'start_trigger',
                    type: 'trigger',
                    position: { x: 180, y: 140 },
                    data: { name: 'Start', triggerType: 'manual', blockType: 'trigger' },
                }]);
                setCurrentFlow(null);
                setFlowName('Untitled Flow');
            } else {
                const flow = await getSabFlowById(flowId);
                if (!flow) {
                    toast({ title: 'Flow not found', variant: 'destructive' });
                    return;
                }
                setCurrentFlow(flow);
                setFlowName(flow.name);
                setNodes(flow.nodes || []);
                setEdges(flow.edges || []);
            }
        });
    }, [flowId, toast]);

    // ── Connections ───────────────────────────────────────────────────────────
    const onConnect: OnConnect = useCallback(
        (params) => setEdges(eds => addEdge({ ...params, animated: true }, eds)),
        [setEdges],
    );

    // ── Drag & drop ───────────────────────────────────────────────────────────
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('application/reactflow');
        if (!raw) return;
        try {
            const payload = JSON.parse(raw);
            const { type, blockType, appId } = payload;
            const nodeType = type === 'action' ? 'action' : (type || blockType);
            if (!nodeType) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: e.clientX,
                y: e.clientY,
            });

            const newNode: Node = {
                id: getId(),
                type: nodeType,
                position,
                data: {
                    name: blockType ? blockType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'New Block',
                    blockType: blockType || nodeType,
                    appId: appId || '',
                    connectionId: '',
                    actionName: '',
                    inputs: {},
                },
            };
            setNodes(nds => nds.concat(newNode));
        } catch { /* ignore */ }
    }, [reactFlowInstance, setNodes]);

    // ── Selection ─────────────────────────────────────────────────────────────
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = () => {
        if (!flowName.trim()) {
            toast({ title: 'Flow name is required', variant: 'destructive' });
            return;
        }
        const validation = validateFlow(nodes, edges);
        if (!validation.isValid) {
            const errCount = validation.errors.filter(e => e.type === 'error').length;
            toast({
                title: 'Validation failed',
                description: `${errCount} error(s) — resolve them before saving.`,
                variant: 'destructive',
            });
            return;
        }
        const triggerNode = nodes.find(n => n.type === 'trigger');
        startSaveTransition(async () => {
            const fd = new FormData();
            fd.append('flowId', currentFlow?._id?.toString() || (flowId !== 'new-flow' ? flowId : ''));
            fd.append('name', flowName);
            fd.append('nodes', JSON.stringify(nodes));
            fd.append('edges', JSON.stringify(edges));
            fd.append('trigger', JSON.stringify(triggerNode?.data ?? {}));
            fd.append('status', currentFlow?.status || 'ACTIVE');
            const result = await saveSabFlow({ message: null, error: null }, fd);
            if (result.error) {
                toast({ title: 'Save failed', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Saved', description: 'Flow saved successfully.' });
                if (result.flowId && flowId === 'new-flow') {
                    router.replace(`/dashboard/sabflow/flow-builder/${result.flowId}`);
                }
            }
        });
    };

    // ── Node update / delete ──────────────────────────────────────────────────
    const onNodeUpdate = useCallback((id: string, data: any) => {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
        setSelectedNode(prev => prev?.id === id ? { ...prev, data: { ...prev.data, ...data } } as Node : prev);
    }, [setNodes]);

    const onDeleteNode = useCallback((id: string) => {
        setNodes(nds => nds.filter(n => n.id !== id));
        setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
        setSelectedNode(null);
    }, [setNodes, setEdges]);

    const isPaused = currentFlow?.status === 'PAUSED';

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">

            {/* ── Typebot-style header ──────────────────────────────────────── */}
            <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-3 gap-2">

                {/* Left */}
                <div className="flex items-center gap-2 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                        asChild
                    >
                        <Link href="/dashboard/sabflow/flow-builder">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>

                    {/* Logo badge */}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600">
                        <Zap className="h-3.5 w-3.5 text-white" />
                    </div>

                    {/* Flow name — editable, minimal */}
                    <input
                        value={flowName}
                        onChange={e => setFlowName(e.target.value)}
                        className={cn(
                            'h-8 w-44 rounded-md border-transparent bg-transparent px-2 text-sm font-semibold text-foreground',
                            'focus:border-border focus:bg-muted/40 focus:outline-none focus:ring-0 truncate',
                            'transition-colors placeholder:text-muted-foreground/50',
                        )}
                        placeholder="Untitled Flow"
                        spellCheck={false}
                    />
                </div>

                {/* Right */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Active / Paused toggle */}
                    <div className={cn(
                        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors',
                        isPaused
                            ? 'border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-700/40'
                            : 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700/40',
                    )}>
                        <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse',
                        )} />
                        {isPaused ? 'Paused' : 'Active'}
                        <Switch
                            checked={!isPaused}
                            onCheckedChange={checked =>
                                setCurrentFlow((f: any) => ({ ...f, status: checked ? 'ACTIVE' : 'PAUSED' }))
                            }
                            className="h-4 w-7 [&_span]:h-3 [&_span]:w-3"
                        />
                    </div>

                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white shadow-none"
                    >
                        {isSaving
                            ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            : <Save className="h-3.5 w-3.5" />
                        }
                        Save
                    </Button>
                </div>
            </header>

            {/* ── 3-column body ─────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

                {/* LEFT SIDEBAR — always visible block palette */}
                <div className={cn(
                    'relative flex flex-col border-r bg-background/60 transition-all duration-200 shrink-0',
                    sidebarCollapsed ? 'w-0 overflow-hidden border-0' : 'w-64',
                )}>
                    <SabFlowSidebar className="h-full w-full" />

                    {/* Collapse toggle */}
                    <button
                        onClick={() => setSidebarCollapsed(c => !c)}
                        className={cn(
                            'absolute -right-3 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center',
                            'rounded-full border bg-background shadow-sm text-muted-foreground hover:text-foreground',
                            'transition-colors',
                        )}
                    >
                        <ChevronLeft className="h-3 w-3" />
                    </button>
                </div>

                {/* Show sidebar button when collapsed */}
                {sidebarCollapsed && (
                    <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="absolute left-0 top-1/2 z-20 flex h-8 w-5 -translate-y-1/2 items-center justify-center rounded-r-md border-y border-r bg-background shadow-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronRight className="h-3 w-3" />
                    </button>
                )}

                {/* CENTER — ReactFlow canvas */}
                <div className="relative flex-1 overflow-hidden" ref={reactFlowWrapper}>
                    {isLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                            <LoaderCircle className="h-6 w-6 animate-spin text-violet-600" />
                        </div>
                    )}

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
                        fitViewOptions={{ padding: 0.3 }}
                        proOptions={{ hideAttribution: true }}
                        snapToGrid
                        snapGrid={[16, 16]}
                        defaultEdgeOptions={{
                            animated: true,
                            style: { strokeWidth: 2 },
                        }}
                        connectionLineStyle={{ strokeWidth: 2 }}
                    >
                        <Controls
                            className="!shadow-none !border !border-border !rounded-xl !overflow-hidden"
                            showInteractive={false}
                        />
                        <MiniMap
                            className="!border !border-border !rounded-xl !shadow-none"
                            zoomable
                            pannable
                            nodeColor="#8b5cf6"
                        />
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={20}
                            size={1.2}
                            color="hsl(var(--muted-foreground)/0.2)"
                        />
                    </ReactFlow>
                </div>

                {/* RIGHT — Properties panel (always rendered, shows empty state) */}
                <aside className={cn(
                    'flex shrink-0 flex-col border-l bg-background transition-all duration-200',
                    selectedNode ? 'w-80' : 'w-0 overflow-hidden border-0',
                )}>
                    {selectedNode && (
                        <SabFlowPropertiesPanel
                            node={selectedNode}
                            onUpdate={onNodeUpdate}
                            deleteNode={onDeleteNode}
                            user={user}
                            flowId={flowId}
                        />
                    )}
                </aside>
            </div>
        </div>
    );
};

// ─── Page wrapper ──────────────────────────────────────────────────────────────
export default function SabFlowBuilderPage({ params }: { params: Promise<{ flowId: string }> }) {
    const { flowId } = use(params);
    return (
        <ReactFlowProvider>
            <SabFlowBuilder flowId={flowId} />
        </ReactFlowProvider>
    );
}
