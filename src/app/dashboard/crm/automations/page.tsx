'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
    GitFork, 
    Play,
    Trash2,
    Save,
    Plus,
    LoaderCircle,
    BookOpen,
    Settings2,
    Copy,
    File,
    Wand2,
    Webhook,
    ArrowLeft,
    RefreshCw,
    ChevronsUpDown,
    MessageSquare,
    Tag,
    FolderKanban,
    Clock,
    Link as LinkIcon,
    MoreVertical
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getCrmAutomations,
  getCrmAutomationById,
  saveCrmAutomation,
  deleteCrmAutomation,
  generateCrmAutomation,
} from '@/app/actions/crm-automations.actions';
import type { CrmAutomation, CrmAutomationNode, CrmAutomationEdge } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Sheet, SheetContent, SheetDescription, SheetTitle, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CrmAutomationBlockEditor } from '@/components/wabasimplify/crm-automation-block-editor';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type NodeType = 'triggerTagAdded' | 'actionSendEmail' | 'actionCreateTask' | 'actionAddTag' | 'delay' | 'condition';

const blockTypes = [
    { type: 'triggerTagAdded', label: 'Trigger: Tag Added', icon: Tag },
    { type: 'actionCreateTask', label: 'Action: Create Task', icon: FolderKanban },
    { type: 'actionAddTag', label: 'Action: Add Tag', icon: Tag },
    { type: 'actionSendEmail', label: 'Action: Send Email', icon: MessageSquare },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
];

const NodeComponent = ({ node, onSelectNode, isSelected }: { node: CrmAutomationNode, onSelectNode: (node: CrmAutomationNode) => void, isSelected: boolean }) => {
    const BlockIcon = blockTypes.find(b => b.type === node.type)?.icon || Play;
    
    return (
        <div 
            className="flex items-center justify-center"
            onClick={() => onSelectNode(node)}
        >
            <div className={cn(
                "flex items-center gap-2 py-2 px-4 rounded-full border bg-card text-card-foreground shadow-sm cursor-pointer transition-all",
                isSelected && 'ring-2 ring-primary'
            )}>
                <BlockIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{node.data.label}</span>
            </div>
        </div>
    );
};


const AddActionPopover = ({ onAddNode }: { onAddNode: (type: NodeType) => void }) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full bg-background hover:bg-muted">
                    <Plus className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
                <div className="space-y-1">
                    {blockTypes.filter(b => b.type !== 'triggerTagAdded').map(block => (
                         <Button key={block.type} variant="ghost" className="w-full justify-start" onClick={() => onAddNode(block.type as NodeType)}>
                            <block.icon className="mr-2 h-4 w-4"/>
                            {block.label.split(': ')[1]}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

const ConditionSettingsPanel = ({ node, onUpdate, onClose }: { node: CrmAutomationNode | null, onUpdate: (data: any) => void, onClose: () => void }) => {
    if (!node) return null;
    
    return (
        <Card className="absolute top-24 right-8 w-[500px] z-10 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Condition settings for:</CardTitle>
                    <CardDescription className="flex items-center gap-1 text-xs">
                        <Tag className="h-3 w-3" />
                        <span>Update Stage</span>
                        <ArrowRight className="h-3 w-3" />
                        <FolderKanban className="h-3 w-3" />
                        <span>Salesforce leads</span>
                    </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}><Trash2 className="h-4 w-4"/></Button>
            </CardHeader>
            <CardContent>
                {/* Rule builder UI would go here */}
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">This is a placeholder for the rule builder UI.</p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button>Run Query</Button>
            </CardFooter>
        </Card>
    );
};

export default function CrmAutomationsPage() {
    const { toast } = useToast();
    const [flows, setFlows] = useState<WithId<CrmAutomation>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<CrmAutomation> | null>(null);
    const [nodes, setNodes] = useState<CrmAutomationNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<CrmAutomationNode | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();

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
    }, [currentFlow]);

    useEffect(() => {
        fetchFlows();
    }, [fetchFlows]);

    const handleSelectFlow = async (flowId: string) => {
        const flow = await getCrmAutomationById(flowId);
        setCurrentFlow(flow);
        setNodes(flow?.nodes || []);
        setSelectedNode(null);
    };

    const handleCreateNewFlow = () => {
        const startNode = { id: 'start', type: 'triggerTagAdded' as NodeType, data: { label: 'Trigger' }, position: { x: 0, y: 0 } };
        setCurrentFlow(null);
        setNodes([startNode]);
        setSelectedNode(null);
    };
    
    const handleAddNode = (type: NodeType) => {
        const newNode: CrmAutomationNode = {
            id: `${type}-${Date.now()}`, type, data: { label: `New ${type.replace('action', '')}` }, position: { x: 0, y: 0 },
        };
        setNodes(prev => [...prev, newNode]);
    };

    return (
        <div className="flex flex-col h-full bg-muted/30">
            <header className="flex-shrink-0 flex items-center justify-between p-3 bg-card border-b">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard/crm"><ArrowLeft/></Link>
                    </Button>
                    <h1 className="font-semibold">{currentFlow?.name || 'New Automation'}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Last run: 5 Jun, 14:53</span>
                    <Button variant="outline" size="sm"><RefreshCw className="mr-2 h-4 w-4"/>Run now</Button>
                    <div className="flex items-center gap-2"><Label htmlFor="enabled-switch">Enabled</Label><Switch id="enabled-switch" /></div>
                    <Button variant="ghost" size="icon"><LinkIcon className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                </div>
            </header>

            <main className="flex-1 relative overflow-hidden">
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                
                <div className="relative h-full w-full flex justify-center pt-16">
                    <div className="flex flex-col items-center gap-4">
                        {nodes.map((node, index) => (
                           <React.Fragment key={node.id}>
                               <NodeComponent 
                                   node={node} 
                                   onSelectNode={setSelectedNode}
                                   isSelected={selectedNode?.id === node.id}
                               />
                               {index < nodes.length -1 && (
                                   <div className="h-12 w-px bg-border border-dashed" />
                               )}
                                <AddActionPopover onAddNode={handleAddNode} />
                               {index === nodes.length -1 && (
                                   <div className="h-12 w-px bg-border border-dashed" />
                               )}
                           </React.Fragment>
                        ))}
                    </div>
                </div>
                
                {selectedNode && selectedNode.type === 'condition' && (
                    <ConditionSettingsPanel node={selectedNode} onUpdate={() => {}} onClose={() => setSelectedNode(null)} />
                )}
            </main>
        </div>
    );
}
