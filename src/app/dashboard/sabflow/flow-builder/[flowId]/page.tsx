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
    Edge,
    Node,
    OnConnect,
    NodeTypes,
    MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    LoaderCircle, Save, ArrowLeft,
    Zap, Share2, Settings, Palette, Play, LayoutTemplate,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSabFlowById, saveSabFlow } from '@/app/actions/sabflow.actions';
import { getSession } from '@/app/actions';
import { SabFlowSidebar } from '@/components/wabasimplify/sabflow/flow-builder/SabFlowSidebar';
import SabFlowCustomNode from '@/components/wabasimplify/sabflow/flow-builder/SabFlowCustomNode';
import { SabFlowPropertiesPanel } from '@/components/wabasimplify/sabflow/flow-builder/SabFlowPropertiesPanel';
import { cn } from '@/lib/utils';
import { validateFlow } from '@/lib/sabflow/validation';

// ─── Node type registry ────────────────────────────────────────────────────────
const nodeTypes: NodeTypes = {
    action:        SabFlowCustomNode,
    trigger:       SabFlowCustomNode,
    condition:     SabFlowCustomNode,
    start:         SabFlowCustomNode,
    text_bubble:   SabFlowCustomNode,
    image_bubble:  SabFlowCustomNode,
    video_bubble:  SabFlowCustomNode,
    audio_bubble:  SabFlowCustomNode,
    embed_bubble:  SabFlowCustomNode,
    text_input:    SabFlowCustomNode,
    number_input:  SabFlowCustomNode,
    email_input:   SabFlowCustomNode,
    phone_input:   SabFlowCustomNode,
    date_input:    SabFlowCustomNode,
    url_input:     SabFlowCustomNode,
    file_input:    SabFlowCustomNode,
    buttons:       SabFlowCustomNode,
    rating:        SabFlowCustomNode,
    payment:       SabFlowCustomNode,
    set_variable:  SabFlowCustomNode,
    redirect:      SabFlowCustomNode,
    script:        SabFlowCustomNode,
    wait:          SabFlowCustomNode,
    ab_test:       SabFlowCustomNode,
    jump:          SabFlowCustomNode,
    filter:        SabFlowCustomNode,
    webhook_trigger: SabFlowCustomNode,
    schedule:      SabFlowCustomNode,
    manual:        SabFlowCustomNode,
    ai_message:    SabFlowCustomNode,
    ai_agent:      SabFlowCustomNode,
    sticky_note:   SabFlowCustomNode,
};

let _idCounter = 0;
const getId = () => `node_${Date.now()}_${_idCounter++}`;

// ─── Tab definitions ───────────────────────────────────────────────────────────
type Tab = 'flow' | 'theme' | 'settings' | 'share' | 'publish';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'flow',     label: 'Flow',     icon: LayoutTemplate },
    { id: 'theme',    label: 'Theme',    icon: Palette },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'share',    label: 'Share',    icon: Share2 },
    { id: 'publish',  label: 'Publish',  icon: Play },
];

// ─── Inner builder (must be inside ReactFlowProvider) ─────────────────────────
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
    const [activeTab, setActiveTab] = useState<Tab>('flow');

    useEffect(() => {
        getSession().then(s => setUser(s?.user));
    }, []);

    // ── Load flow ──────────────────────────────────────────────────────────────
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

    // ── Connect edges ──────────────────────────────────────────────────────────
    const onConnect: OnConnect = useCallback(
        (params) => setEdges(eds => addEdge({
            ...params,
            animated: true,
            style: { strokeWidth: 2, stroke: '#6366f1' },
            type: 'smoothstep',
        }, eds)),
        [setEdges],
    );

    // ── Drag & drop onto canvas ────────────────────────────────────────────────
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
            const { type, blockType, appId, actionName } = payload;
            const nodeType = type === 'action' ? 'action' : (type || blockType);
            if (!nodeType) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: e.clientX,
                y: e.clientY,
            });

            const rawLabel = actionName || blockType || nodeType;
            const label = rawLabel
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase());

            const newNode: Node = {
                id: getId(),
                type: nodeType,
                position,
                data: {
                    name:         label,
                    blockType:    blockType || nodeType,
                    appId:        appId || '',
                    connectionId: '',
                    actionName:   actionName || '',
                    inputs:       {},
                },
            };
            setNodes(nds => nds.concat(newNode));
        } catch {
            // malformed payload — ignore
        }
    }, [reactFlowInstance, setNodes]);

    // ── Node selection ─────────────────────────────────────────────────────────
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    // ── Save flow ──────────────────────────────────────────────────────────────
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

    // ── Node update / delete ───────────────────────────────────────────────────
    const onNodeUpdate = useCallback((id: string, data: any) => {
        setNodes(nds => nds.map(n =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
        ));
        setSelectedNode(prev =>
            prev?.id === id ? { ...prev, data: { ...prev.data, ...data } } as Node : prev,
        );
    }, [setNodes]);

    const onDeleteNode = useCallback((id: string) => {
        setNodes(nds => nds.filter(n => n.id !== id));
        setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
        setSelectedNode(null);
    }, [setNodes, setEdges]);

    const isPaused = currentFlow?.status === 'PAUSED';

    return (
        // Full-screen overlay — sits above the Clay sidebar (z-100)
        <div className="fixed inset-0 z-100 flex flex-col overflow-hidden bg-background">

            {/* ══ Header bar ══════════════════════════════════════════════════ */}
            <header className="relative z-10 flex h-13 shrink-0 items-center border-b border-border/60 bg-background px-3">

                {/* Left: back arrow + violet Zap badge + editable flow name */}
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <Link
                        href="/dashboard/sabflow/flow-builder"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>

                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 shadow-sm">
                        <Zap className="h-3.5 w-3.5 text-white" />
                    </div>

                    <input
                        value={flowName}
                        onChange={e => setFlowName(e.target.value)}
                        spellCheck={false}
                        placeholder="Untitled Flow"
                        className={cn(
                            'h-8 max-w-45 rounded-lg border-transparent bg-transparent px-2',
                            'text-[13.5px] font-semibold text-foreground',
                            'transition-all placeholder:text-muted-foreground/40',
                            'hover:bg-muted/40 focus:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-violet-500/50',
                        )}
                    />
                </div>

                {/* Center: tab nav pills — absolutely centered */}
                <nav className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 rounded-xl border border-border/50 bg-muted/40 p-1">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all duration-150',
                                    active
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:bg-background/50 hover:text-foreground',
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Right: Live/Paused pill + Save button */}
                <div className="flex flex-1 shrink-0 items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setCurrentFlow((f: any) => ({
                            ...f,
                            status: isPaused ? 'ACTIVE' : 'PAUSED',
                        }))}
                        className={cn(
                            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors',
                            isPaused
                                ? 'border-amber-300/60 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'border-emerald-300/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300',
                        )}
                    >
                        <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isPaused ? 'bg-amber-500' : 'animate-pulse bg-emerald-500',
                        )} />
                        {isPaused ? 'Paused' : 'Live'}
                    </button>

                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-8 gap-1.5 rounded-lg bg-violet-600 px-4 text-[12.5px] font-semibold text-white shadow-none hover:bg-violet-700"
                    >
                        {isSaving
                            ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            : <Save className="h-3.5 w-3.5" />
                        }
                        Save
                    </Button>
                </div>
            </header>

            {/* ══ Body — sidebar floats above full-width canvas ════════════ */}
            <div className="relative flex min-h-0 flex-1 overflow-hidden">

                {/* LEFT sidebar — Typebot: absolutely positioned, slides in/out */}
                <SabFlowSidebar />

                {/* CENTER — ReactFlow canvas — always full width */}
                <div
                    ref={reactFlowWrapper}
                    className="absolute inset-0 overflow-hidden bg-[#f8f9fa] dark:bg-zinc-950"
                >
                    {isLoading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3">
                                <LoaderCircle className="h-7 w-7 animate-spin text-violet-600" />
                                <p className="text-sm font-medium text-muted-foreground">Loading flow…</p>
                            </div>
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
                            animated: false,
                            style: { strokeWidth: 2, stroke: '#f97316' },
                            type: 'smoothstep',
                        }}
                        connectionLineStyle={{ strokeWidth: 2, stroke: '#f97316' }}
                        elevateEdgesOnSelect
                    >
                        <Controls
                            showInteractive={false}
                            className="shadow-none! border! border-zinc-200! dark:border-zinc-700! rounded-xl! overflow-hidden! bg-white! dark:bg-zinc-900!"
                        />
                        <MiniMap
                            zoomable
                            pannable
                            nodeColor="#f97316"
                            maskColor="rgba(248,249,250,0.7)"
                            className="border! border-zinc-200! dark:border-zinc-700! rounded-xl! shadow-none! bg-white! dark:bg-zinc-900!"
                        />
                        {/* Typebot-style radial-gradient dot pattern */}
                        <Background
                            variant={BackgroundVariant.Dots}
                            gap={40}
                            size={1.5}
                            color="#9ca3af"
                        />
                    </ReactFlow>
                </div>

                {/* RIGHT — properties panel (slides in when node selected) */}
                <div className={cn(
                    'absolute right-0 top-0 h-full z-10',
                    'flex shrink-0 flex-col overflow-hidden border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900',
                    'transition-all duration-200',
                    selectedNode ? 'w-96' : 'w-0 border-l-0',
                )}>
                    {selectedNode && (
                        <SabFlowPropertiesPanel
                            node={selectedNode}
                            onUpdate={onNodeUpdate}
                            deleteNode={onDeleteNode}
                            onClose={() => setSelectedNode(null)}
                            user={user}
                            flowId={flowId}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Page wrapper ──────────────────────────────────────────────────────────────
export default function SabFlowBuilderPage({
    params,
}: {
    params: Promise<{ flowId: string }>;
}) {
    const { flowId } = use(params);
    return (
        <ReactFlowProvider>
            <SabFlowBuilder flowId={flowId} />
        </ReactFlowProvider>
    );
}
