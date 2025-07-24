

'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
    FolderKanban
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getCrmAutomations,
  getCrmAutomationById,
  saveCrmAutomation,
  deleteCrmAutomation,
} from '@/app/actions/crm-automations.actions';
import type { CrmAutomation, CrmAutomationNode, CrmAutomationEdge } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

type NodeType = 'triggerTagAdded' | 'actionSendEmail' | 'actionCreateTask' | 'actionAddTag' | 'delay' | 'condition';

const blockTypes = [
    { type: 'triggerTagAdded', label: 'Trigger: Tag Added', icon: Tag },
    { type: 'actionCreateTask', label: 'Action: Create Task', icon: FolderKanban },
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
            </Card>

            {node.type !== 'triggerTagAdded' && <Handle position="left" id={`${node.id}-input`} style={{top: '50%', transform: 'translateY(-50%)'}} />}
            <Handle position="right" id={`${node.id}-output-main`} style={{top: '50%', transform: 'translateY(-50%)'}} />
        </div>
    );
};

export default function CrmAutomationsPage() {
    const { toast } = useToast();
    const [flows, setFlows] = useState<WithId<CrmAutomation>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<CrmAutomation> | null>(null);
    const [nodes, setNodes] = useState<CrmAutomationNode[]>([]);
    const [edges, setEdges] = useState<CrmAutomationEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const viewportRef = useRef<HTMLDivElement>(null);

    const handleCreateNewFlow = () => {
        const startNode = { id: 'start', type: 'triggerTagAdded' as NodeType, data: { label: 'When Tag is Added' }, position: { x: 50, y: 150 } };
        setCurrentFlow(null); setNodes([startNode]); setEdges([]); setSelectedNodeId(startNode.id);
    };

    const fetchFlows = useCallback(() => {
        startLoadingTransition(async () => {
            const flowsData = await getCrmAutomations();
            setFlows(flowsData);
            if (flowsData.length > 0) {
                handleSelectFlow(flowsData[0]._id.toString());
            } else {
                handleCreateNewFlow();
            }
        });
    }, []);

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
    
    const handleSaveFlow = () => {
        const flowName = (document.getElementById('flow-name-input') as HTMLInputElement)?.value;
        if (!flowName) return;
        startSaveTransition(async () => {
            const result = await saveCrmAutomation({ flowId: currentFlow?._id.toString(), name: flowName, nodes, edges });
            if(result.error) toast({title: "Error", description: result.error, variant: 'destructive'});
            else {
                toast({title: "Success", description: result.message});
                if(result.flowId) await handleSelectFlow(result.flowId);
                fetchFlows();
            }
        });
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex-shrink-0 flex items-center justify-between">
                <Input id="flow-name-input" defaultValue={currentFlow?.name || 'New Automation'} className="text-3xl font-bold font-headline h-auto p-0 border-0 shadow-none focus-visible:ring-0" />
                <Button onClick={handleSaveFlow} disabled={isSaving}>{isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save</Button>
            </div>
            <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
                <div className="col-span-2 flex flex-col gap-4">
                     <Card>
                        <CardHeader className="flex-row items-center justify-between p-3">
                            <CardTitle className="text-base">Flows</CardTitle>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateNewFlow}><Plus/></Button>
                        </CardHeader>
                        <CardContent className="p-2 pt-0">
                            <ScrollArea className="h-40">
                                {isLoading && flows.length === 0 ? <p>Loading...</p> : 
                                    flows.map(flow => (
                                        <div key={flow._id.toString()} className="flex items-center group">
                                            <Button 
                                                variant="ghost" 
                                                className={cn("w-full justify-start font-normal", currentFlow?._id.toString() === flow._id.toString() && "bg-muted font-semibold")}
                                                onClick={() => handleSelectFlow(flow._id.toString())}
                                            >
                                                {flow.name}
                                            </Button>
                                        </div>
                                    ))
                                }
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    <Card className="flex-1 flex flex-col">
                        <CardHeader className="p-3"><CardTitle className="text-base">Blocks</CardTitle></CardHeader>
                        <CardContent className="space-y-2 p-2 pt-0 flex-1 min-h-0">
                            <ScrollArea className="h-full">
                                {blockTypes.map(({ type, label, icon: Icon }) => (
                                    <Button key={type} variant="outline" className="w-full justify-start mb-2" onClick={() => {}}><Icon className="mr-2 h-4 w-4" />{label}</Button>
                                ))}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
                <div className="col-span-7">
                    <Card ref={viewportRef} className="h-full w-full overflow-hidden relative">
                        <div className="relative w-full h-full">
                            {nodes.map(node => (<NodeComponent key={node.id} node={node} onSelectNode={() => {}} isSelected={false} onNodeMouseDown={() => {}} onHandleClick={() => {}} />))}
                        </div>
                    </Card>
                </div>
                <div className="col-span-3">
                </div>
            </div>
        </div>
    );
}
