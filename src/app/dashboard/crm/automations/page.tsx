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
    FolderKanban,
    Wand2,
    Webhook
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
    onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string, isOutput: boolean) => void;
}) => {
    const BlockIcon = blockTypes.find(b => b.type === node.type)?.icon || Play;

    const Handle = ({ position, id, style }: { position: 'left' | 'right', id: string, style?: React.CSSProperties }) => (
        <div 
            id={id}
            data-handle-pos={position}
            style={style}
            className={cn(
                "absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10",
                position === 'left' ? "-left-2 top-1/2 -translate-y-1/2" : "-right-2",
            )} 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onHandleClick(e, node.id, id, position === 'right'); }}
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

function WebhookTriggerDialog({ flow, triggerUrl }: { flow: WithId<CrmAutomation>, triggerUrl: string }) {
  const { copy } = useToast();
  const curlSnippet = `curl -X POST ${triggerUrl} \\
-H "Content-Type: application/json" \\
-d '{
  "email": "lead@example.com",
  "name": "New Lead",
  "phone": "1234567890",
  "company": "Acme Inc."
}'`;

  const jsSnippet = `fetch('${triggerUrl}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'lead@example.com',
    name: 'New Lead'
  })
})
.then(res => res.json())
.then(console.log)
.catch(console.error);`;

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Webhook Trigger for "{flow.name}"</DialogTitle>
        <DialogDescription>
          Use this URL to start this automation from an external service, like a website form.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Webhook URL</Label>
          <div className="flex items-center gap-2">
            <Input readOnly value={triggerUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy({ title: "URL Copied!", description: "Webhook URL copied to clipboard." })}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
        <div>
          <Label>cURL Example</Label>
           <div className="relative p-4 bg-muted rounded-md font-mono text-xs">
              <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => copy({ title: "cURL Copied!", description: "cURL snippet copied to clipboard." })}><Copy className="h-4 w-4" /></Button>
              <pre><code>{curlSnippet}</code></pre>
          </div>
        </div>
        <div>
          <Label>JavaScript (Fetch) Example</Label>
           <div className="relative p-4 bg-muted rounded-md font-mono text-xs">
              <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => copy({ title: "JS Snippet Copied!", description: "JavaScript snippet copied to clipboard." })}><Copy className="h-4 w-4" /></Button>
              <pre><code>{jsSnippet}</code></pre>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}


export default function CrmAutomationsPage() {
    const { toast } = useToast();
    const [flows, setFlows] = useState<WithId<CrmAutomation>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<CrmAutomation> | null>(null);
    const [nodes, setNodes] = useState<CrmAutomationNode[]>([]);
    const [edges, setEdges] = useState<CrmAutomationEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const [isGenerating, startGenerateTransition] = useTransition();
    const viewportRef = useRef<HTMLDivElement>(null);
    
    // UI State
    const [isPropsPanelOpen, setIsPropsPanelOpen] = useState(false);
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [webhookFlow, setWebhookFlow] = useState<WithId<CrmAutomation> | null>(null);

    const handleCreateNewFlow = () => {
        const startNode = { id: 'start', type: 'triggerTagAdded' as NodeType, data: { label: 'When Tag is Added' }, position: { x: 50, y: 150 } };
        setCurrentFlow(null); setNodes([startNode]); setEdges([]); setSelectedNodeId(startNode.id);
    };

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

    const handleGenerateFlow = async () => {
        startGenerateTransition(async () => {
            const result = await generateCrmAutomation({ prompt: aiPrompt });
            if(result.nodes && result.edges) {
                setCurrentFlow(null);
                setNodes(result.nodes);
                setEdges(result.edges);
                toast({title: 'Flow Generated!', description: 'Review the generated flow and save it.'});
                setIsAiDialogOpen(false);
                setAiPrompt('');
            } else {
                toast({title: 'Error', description: 'Failed to generate flow from prompt.', variant: 'destructive'});
            }
        });
    };
    
    const webhookTriggerUrl = webhookFlow ? `${window.location.origin}/api/crm/automations/trigger/${webhookFlow._id.toString()}` : '';
    
    // ... rest of the component logic for drag/drop, etc. ...
    return (
        <div className="flex flex-col h-full gap-4">
             <div className="flex-shrink-0 flex items-center justify-between">
                <Input id="flow-name-input" defaultValue={currentFlow?.name || 'New Automation'} className="text-3xl font-bold font-headline h-auto p-0 border-0 shadow-none focus-visible:ring-0" />
                <div className="flex items-center gap-2">
                     <Button variant="outline" onClick={() => setIsAiDialogOpen(true)}><Wand2 className="mr-2 h-4 w-4" /> Generate with AI</Button>
                     <Button asChild variant="outline"><Link href="/dashboard/crm/automations/docs"><BookOpen className="mr-2 h-4 w-4"/>Docs</Link></Button>
                    <Button onClick={handleSaveFlow} disabled={isSaving}>{isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save</Button>
                </div>
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
                                             <Dialog onOpenChange={(open) => !open && setWebhookFlow(null)}>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setWebhookFlow(flow)}><Webhook className="h-4 w-4"/></Button>
                                                </DialogTrigger>
                                                {webhookFlow && <WebhookTriggerDialog flow={webhookFlow} triggerUrl={webhookTriggerUrl} />}
                                            </Dialog>
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
                    {selectedNodeId && nodes.find(n => n.id === selectedNodeId) && (
                        <CrmAutomationBlockEditor 
                            node={nodes.find(n => n.id === selectedNodeId)} 
                            onUpdate={() => {}} 
                        />
                    )}
                </div>
            </div>
            <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Automation with AI</DialogTitle>
                        <DialogDescription>Describe the workflow you want to create.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder="e.g., When a contact gets the 'new_lead' tag, wait 1 day, then send them the welcome email."
                        className="min-h-[120px]"
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                    />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAiDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleGenerateFlow} disabled={isGenerating || !aiPrompt.trim()}>
                            {isGenerating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4"/>}
                            Generate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
