
'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getFlowsForProject, getFlowById, saveFlow, deleteFlow } from '@/app/actions/flow.actions';
import type { Project, Flow, FlowNode, FlowEdge } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, ToggleRight, GitFork, Play, Trash2, Save, Plus, Type, LoaderCircle, BookOpen, PanelLeft, Settings2, Copy, File as FileIcon, ZoomIn, ZoomOut, Frame, Maximize, Minimize, ImageIcon, Clock, Code, Send, Bot
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useProject } from '@/context/project-context';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { TestFlowDialog } from '@/components/wabasimplify/test-flow-dialog';
import { generateFlowBuilderFlow } from '@/ai/flows/generate-flow-builder-flow';

type NodeType = 'start' | 'text' | 'buttons' | 'input' | 'image' | 'delay' | 'condition' | 'api' | 'carousel' | 'addToCart' | 'language' | 'sendTemplate' | 'triggerMetaFlow' | 'triggerFlow';
type ButtonConfig = { id: string; text: string; };

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'condition', label: 'Condition', icon: GitFork },
    { type: 'api', label: 'Call API', icon: Code },
    { type: 'sendTemplate', label: 'Send Template', icon: Send },
    { type: 'triggerMetaFlow', label: 'Trigger Meta Flow', icon: Bot },
];

const NodePreview = ({ node }: { node: FlowNode }) => {
    // ... implementation for previewing node content ...
    return null;
};

const NodeComponent = ({ node, onSelectNode, isSelected, onNodeMouseDown, onHandleClick }: { node: FlowNode; onSelectNode: (id: string) => void; isSelected: boolean; onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void; onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string) => void;}) => {
    const BlockIcon = [...blockTypes, {type: 'start', label: 'Start', icon: Play}].find(b => b.type === node.type)?.icon || MessageSquare;

    const Handle = ({ position, id, style }: { position: 'left' | 'right' | 'top' | 'bottom', id: string, style?: React.CSSProperties }) => (
        <div id={id} data-handle-pos={position} style={style} className={cn("absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10", position === 'left' && "-left-2 top-1/2 -translate-y-1/2", position === 'right' && "-right-2")} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onHandleClick(e, node.id, id); }} />
    );

    return (
        <div className="absolute cursor-grab active:cursor-grabbing transition-all" style={{ top: node.position.y, left: node.position.x }} onMouseDown={(e) => onNodeMouseDown(e, node.id)} onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }}>
            <Card className={cn("w-64 hover:shadow-xl hover:-translate-y-1 bg-card", isSelected && "ring-2 ring-primary shadow-2xl")}>
                <CardHeader className="flex flex-row items-center gap-3 p-3"><BlockIcon className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-sm font-medium">{node.data.label}</CardTitle></CardHeader>
                <NodePreview node={node} />
                 {node.type === 'condition' && ( <CardContent className="p-3 pt-0 text-xs text-muted-foreground"><div className="flex justify-between items-center"><span>Yes</span></div><Separator className="my-1"/><div className="flex justify-between items-center"><span>No</span></div></CardContent>)}
            </Card>
            {node.type !== 'start' && <Handle position="left" id={`${node.id}-input`} style={{top: '50%', transform: 'translateY(-50%)'}} />}
            {node.type === 'condition' ? ( <> <Handle position="right" id={`${node.id}-output-yes`} style={{ top: '33.33%', transform: 'translateY(-50%)' }} /> <Handle position="right" id={`${node.id}-output-no`} style={{ top: '66.67%', transform: 'translateY(-50%)' }} /></>) : node.type === 'buttons' ? ((node.data.buttons || []).map((btn: ButtonConfig, index: number) => { const totalButtons = (node.data.buttons || []).length; const topPosition = totalButtons > 1 ? `${(100 / (totalButtons + 1)) * (index + 1)}%` : '50%'; return <Handle key={btn.id || index} position="right" id={`${node.id}-btn-${index}`} style={{ top: topPosition, transform: 'translateY(-50%)' }} />; })) : ( <Handle position="right" id={`${node.id}-output-main`} style={{top: '50%', transform: 'translateY(-50%)'}} />)}
        </div>
    );
};

export function FlowBuilder() {
    const { activeProjectId } = useProject();
    const { toast } = useToast();
    const [flows, setFlows] = useState<WithId<Flow>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<Flow> | null>(null);
    const [nodes, setNodes] = useState<FlowNode[]>([]);
    const [edges, setEdges] = useState<FlowEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
    
    // AI Generation
    const [prompt, setPrompt] = useState('');
    const [isGenerating, startGeneration] = useTransition();

    const [isBlocksSheetOpen, setIsBlocksSheetOpen] = useState(false);
    const [isPropsSheetOpen, setIsPropsSheetOpen] = useState(false);

    // Canvas state
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<{ sourceNodeId: string; sourceHandleId: string; startPos: { x: number; y: number } } | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isFullScreen, setIsFullScreen] = useState(false);

    const fetchFlows = useCallback(() => {
        if(activeProjectId) {
            startLoadingTransition(async () => {
                const flowsData = await getFlowsForProject(activeProjectId);
                setFlows(flowsData);
                if (flowsData.length > 0 && !currentFlow) {
                    handleSelectFlow(flowsData[0]._id.toString());
                } else if (flowsData.length === 0) {
                    handleCreateNewFlow();
                }
            });
        }
    }, [activeProjectId, currentFlow]);

    useEffect(() => {
        fetchFlows();
    }, [fetchFlows]);

    const handleSelectFlow = async (flowId: string) => {
        const flow = await getFlowById(flowId);
        setCurrentFlow(flow);
        setNodes(flow?.nodes || []);
        setEdges(flow?.edges || []);
        setSelectedNodeId(null);
        setIsBlocksSheetOpen(false);
    }
    
    const handleCreateNewFlow = () => {
        setCurrentFlow(null);
        setNodes([{ id: 'start', type: 'start', data: { label: 'Start Flow' }, position: { x: 50, y: 150 } }]);
        setEdges([]);
        setSelectedNodeId('start');
    }

    const addNode = (type: NodeType) => {
        const centerOfViewX = viewportRef.current ? (viewportRef.current.clientWidth / 2 - pan.x) / zoom : 300;
        const centerOfViewY = viewportRef.current ? (viewportRef.current.clientHeight / 2 - pan.y) / zoom : 150;
        const newNode: FlowNode = {
            id: `${type}-${Date.now()}`, type, data: { label: `New ${type}`, apiRequest: { method: 'GET', url: '', headers: '', body: '', responseMappings: [] } }, position: { x: centerOfViewX, y: centerOfViewY },
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
        setIsBlocksSheetOpen(false);
    };

    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(node => node.id !== id));
        setEdges(prev => prev.filter(edge => edge.source !== id && edge.target !== id));
        if (selectedNodeId === id) setSelectedNodeId(null);
        setIsPropsSheetOpen(false);
    };
    
    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => { e.preventDefault(); e.stopPropagation(); setDraggingNode(nodeId); };
    const handleCanvasMouseDown = (e: React.MouseEvent) => { if (e.target === e.currentTarget) { e.preventDefault(); setIsPanning(true); } };
    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        else if (draggingNode) setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, position: { x: n.position.x + e.movementX / zoom, y: n.position.y + e.movementY / zoom } } : n));
        if (connecting && viewportRef.current) { const rect = viewportRef.current.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; setMousePosition({ x: (mouseX - pan.x) / zoom, y: (mouseY - pan.y) / zoom }); }
    };
    const handleCanvasMouseUp = () => { setIsPanning(false); setDraggingNode(null); };
    const handleCanvasClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) { if (connecting) setConnecting(null); else setSelectedNodeId(null); }};

    const handleHandleClick = (e: React.MouseEvent, nodeId: string, handleId: string) => {
        e.preventDefault(); e.stopPropagation();
        if (!viewportRef.current) return;
        const isOutputHandle = handleId.includes('output') || handleId.includes('-btn-');
        if (isOutputHandle) { const sourceNode = nodes.find(n => n.id === nodeId); if(sourceNode){ const handlePos = getNodeHandlePosition(sourceNode, handleId); if (handlePos) setConnecting({ sourceNodeId: nodeId, sourceHandleId: handleId, startPos: handlePos });}}
        else if (connecting && !isOutputHandle) {
            if (connecting.sourceNodeId === nodeId) { setConnecting(null); return; }
            const newEdge: FlowEdge = { id: `edge-${connecting.sourceNodeId}-${nodeId}-${connecting.sourceHandleId}-${handleId}`, source: connecting.sourceNodeId, target: nodeId, sourceHandle: connecting.sourceHandleId, targetHandle: handleId };
            const edgesWithoutExistingTarget = edges.filter(edge => !(edge.target === nodeId && edge.targetHandle === handleId));
            const sourceHasSingleOutput = !connecting.sourceHandleId.includes('btn-') && !connecting.sourceHandleId.includes('output-yes') && !connecting.sourceHandleId.includes('output-no');
            if (sourceHasSingleOutput) { const edgesWithoutExistingSource = edgesWithoutExistingTarget.filter(e => e.source !== connecting.sourceNodeId); setEdges([...edgesWithoutExistingSource, newEdge]); } else { setEdges([...edgesWithoutExistingTarget, newEdge]); }
            setConnecting(null);
        }
    };
    
    // ... more handlers ...

    return (
        // JSX for the FlowBuilder component
        <div className="h-full">
            The Flow Builder component content goes here.
        </div>
    );
}

export default function FlowBuilderPage() {
  return (
    <FlowBuilder />
  )
}


