
'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
    LoaderCircle,
    BookOpen,
    PanelLeft,
    Settings2,
    Copy,
    File,
    ZoomIn,
    ZoomOut,
    Frame,
    Maximize,
    Minimize,
    ImageIcon,
    Clock,
    ShoppingCart,
    View,
    PackageCheck,
    ArrowRightLeft,
    Tag,
    FolderKan
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  getCrmAutomations,
  getCrmAutomationById,
  saveCrmAutomation,
  deleteCrmAutomation,
} from '@/app/actions/crm-automations.actions';
import type { CrmAutomation, CrmAutomationNode, CrmAutomationEdge } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type NodeType = 'triggerTagAdded' | 'actionSendEmail' | 'actionCreateTask' | 'actionAddTag' | 'delay' | 'condition';

const blockTypes = [
    { type: 'triggerTagAdded', label: 'Trigger: Tag Added', icon: Tag },
    { type: 'actionCreateTask', label: 'Action: Create Task', icon: FolderKan },
    { type: 'actionAddTag', label: 'Action: Add Tag', icon: Tag },
    { type: 'actionSendEmail', label: 'Action: Send Email', icon: MessageSquare },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
];

const NodeComponent = ({ 
    node, 
    onSelectNode, 
    isSelected,
    onNodeMouseDown,
    onHandleClick 
}: { 
    node: CrmAutomationNode; 
    onSelectNode: (id: string) => void; 
    isSelected: boolean;
    onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string) => void;
}) => {
    const BlockIcon = blockTypes.find(b => b.type === node.type)?.icon || Play;

    const Handle = ({ position, id, style }: { position: 'left' | 'right', id: string, style?: React.CSSProperties }) => (
        <div 
            id={id}
            data-handle-pos={position}
            style={style}
            className={cn(
                "absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10",
                position === 'left' && "-left-2 top-1/2 -translate-y-1/2",
                position === 'right' && "-right-2",
            )} 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onHandleClick(e, node.id, id); }}
        />
    );

    return (
        <div 
            className="absolute cursor-grab active:cursor-grabbing transition-all"
            style={{ top: node.position.y, left: node.position.x }}
            onMouseDown={(e) => onNodeMouseDown(e, node.id)}
            onClick={(e) => { e.stopPropagation(); onSelectNode(node.id); }}
        >
            <Card className={cn("w-64 hover:shadow-xl hover:-translate-y-1 bg-card", isSelected && "ring-2 ring-primary shadow-2xl")}>
                <CardHeader className="flex flex-row items-center gap-3 p-3">
                    <BlockIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{node.data.label}</CardTitle>
                </CardHeader>
                 {node.type === 'condition' && (
                    <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center"><span>Yes</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between items-center"><span>No</span></div>
                    </CardContent>
                )}
            </Card>

            {node.type !== 'triggerTagAdded' && <Handle position="left" id={`${node.id}-input`} style={{top: '50%', transform: 'translateY(-50%)'}} />}
            
            {node.type === 'condition' ? (
                <>
                    <Handle position="right" id={`${node.id}-output-yes`} style={{ top: '33.33%', transform: 'translateY(-50%)' }} />
                    <Handle position="right" id={`${node.id}-output-no`} style={{ top: '66.67%', transform: 'translateY(-50%)' }} />
                </>
            ) : (
                 <Handle position="right" id={`${node.id}-output-main`} style={{top: '50%', transform: 'translateY(-50%)'}} />
            )}
        </div>
    );
};

const PropertiesPanel = ({ selectedNode, updateNodeData, deleteNode }: { selectedNode: CrmAutomationNode | null; updateNodeData: (id: string, data: Partial<any>) => void, deleteNode: (id: string) => void }) => {
    if (!selectedNode) return null;
    
    const { toast } = useToast();

    const handleDataChange = (field: keyof any, value: any) => {
        updateNodeData(selectedNode.id, { [field]: value });
    };

    const renderProperties = () => {
        switch (selectedNode.type) {
            case 'triggerTagAdded':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="tagName">Tag Name</Label>
                            <Input 
                                id="tagName"
                                placeholder="e.g., hot-lead" 
                                value={selectedNode.data.tagName || ''} 
                                onChange={(e) => handleDataChange('tagName', e.target.value)}
                            />
                        </div>
                    </div>
                );
            case 'actionCreateTask':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="taskTitle">Task Title</Label>
                            <Input placeholder="Follow up with {{contact.name}}" value={selectedNode.data.taskTitle || ''} onChange={(e) => handleDataChange('taskTitle', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="taskDescription">Description</Label>
                            <Textarea placeholder="Contact signed up for webinar." value={selectedNode.data.taskDescription || ''} onChange={(e) => handleDataChange('taskDescription', e.target.value)} />
                        </div>
                    </div>
                );
            default:
                return <p className="text-sm text-muted-foreground italic">No properties to configure for this block type.</p>;
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader><CardTitle>Properties</CardTitle><CardDescription>Configure the '{selectedNode.data.label}' block.</CardDescription></CardHeader>
            <ScrollArea className="flex-1"><CardContent className="space-y-4">{renderProperties()}</CardContent></ScrollArea>
            {selectedNode.type !== 'triggerTagAdded' && (
                <CardFooter className="border-t pt-4"><Button variant="destructive" className="w-full" onClick={() => deleteNode(selectedNode.id)}><Trash2 className="mr-2 h-4 w-4" />Delete Block</Button></CardFooter>
            )}
        </Card>
    );
};

const getEdgePath = (sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
    if (!sourcePos || !targetPos) return '';
    const dx = Math.abs(sourcePos.x - targetPos.x) * 0.5;
    return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + dx} ${sourcePos.y}, ${targetPos.x - dx} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
};

export default function CrmAutomationsPage() {
    const { toast } = useToast();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [flows, setFlows] = useState<WithId<CrmAutomation>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<CrmAutomation> | null>(null);
    const [nodes, setNodes] = useState<CrmAutomationNode[]>([]);
    const [edges, setEdges] = useState<CrmAutomationEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const [connecting, setConnecting] = useState<{ sourceNodeId: string; sourceHandleId: string; startPos: { x: number; y: number } } | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const viewportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    const handleCreateNewFlow = () => {
        const startNode = { id: 'start', type: 'triggerTagAdded' as NodeType, data: { label: 'When Tag is Added' }, position: { x: 50, y: 150 } };
        setCurrentFlow(null); setNodes([startNode]); setEdges([]); setSelectedNodeId(startNode.id);
    };

    const fetchFlows = useCallback(() => {
        if (!projectId) return;
        startLoadingTransition(async () => {
            const flowsData = await getCrmAutomations(projectId);
            setFlows(flowsData);
            if (flowsData.length > 0) {
                handleSelectFlow(flowsData[0]._id.toString());
            } else {
                handleCreateNewFlow();
            }
        });
    }, [projectId]);

    useEffect(() => {
        fetchFlows();
    }, [projectId, fetchFlows]);

    const handleSelectFlow = async (flowId: string) => {
        const flow = await getCrmAutomationById(flowId);
        setCurrentFlow(flow);
        setNodes(flow?.nodes || []);
        setEdges(flow?.edges || []);
        setSelectedNodeId(null);
    };

    const addNode = (type: NodeType) => {
        const newNode = { id: `${type}-${Date.now()}`, type, data: { label: `New ${type}` }, position: { x: 300, y: 150 } };
        setNodes(prev => [...prev, newNode]);
    };

    const updateNodeData = (id: string, data: Partial<any>) => {
        setNodes(prev => prev.map(node => node.id === id ? { ...node, data: { ...node.data, ...data } } : node));
    };

    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(node => node.id !== id));
        setEdges(prev => prev.filter(edge => edge.source !== id && edge.target !== id));
        if (selectedNodeId === id) setSelectedNodeId(null);
    };

    const handleSaveFlow = () => {
        const flowName = (document.getElementById('flow-name-input') as HTMLInputElement)?.value;
        if (!projectId || !flowName) return;
        startSaveTransition(async () => {
            const result = await saveCrmAutomation({ flowId: currentFlow?._id.toString(), projectId, name: flowName, nodes, edges });
            if(result.error) toast({title: "Error", description: result.error, variant: 'destructive'});
            else {
                toast({title: "Success", description: result.message});
                if(result.flowId) await handleSelectFlow(result.flowId);
                fetchFlows();
            }
        });
    };

    if (!projectId) {
        return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No Project Selected</AlertTitle><AlertDescription>Please select a project to manage its automations.</AlertDescription></Alert>;
    }
    
    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    return (
        <div className="flex flex-col h-full gap-4">
             <div className="flex-shrink-0 flex items-center justify-between">
                <Input id="flow-name-input" defaultValue={currentFlow?.name || 'New Automation'} className="text-3xl font-bold font-headline h-auto p-0 border-0 shadow-none focus-visible:ring-0" />
                <Button onClick={handleSaveFlow} disabled={isSaving}>{isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save</Button>
            </div>
            <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
                <div className="col-span-2 flex flex-col gap-4">
                    {blockTypes.map(({ type, label, icon: Icon }) => (
                        <Button key={type} variant="outline" className="justify-start" onClick={() => addNode(type)}><Icon className="mr-2 h-4 w-4" />{label}</Button>
                    ))}
                </div>
                <div className="col-span-7">
                    <Card ref={viewportRef} className="h-full w-full overflow-hidden relative">
                         <div className="relative w-full h-full">
                            {nodes.map(node => (<NodeComponent key={node.id} node={node} onSelectNode={setSelectedNodeId} isSelected={selectedNodeId === node.id} onNodeMouseDown={() => {}} onHandleClick={() => {}} />))}
                         </div>
                    </Card>
                </div>
                <div className="col-span-3">
                    <PropertiesPanel selectedNode={selectedNode} updateNodeData={updateNodeData} deleteNode={deleteNode} />
                </div>
            </div>
        </div>
    );
}

