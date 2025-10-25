
'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    MessageSquare, 
    ToggleRight, 
    GitFork, 
    Webhook, 
    ImageIcon,
    Play,
    Trash2,
    Save,
    Plus,
    Clock,
    Type,
    BrainCircuit,
    ArrowRightLeft,
    ShoppingCart,
    View,
    Server,
    Variable,
    File as FileIcon,
    LoaderCircle,
    BookOpen,
    PanelLeft,
    Settings2,
    Copy,
    ServerCog,
    FileText as FileTextIcon,
    ZoomIn,
    ZoomOut,
    Frame,
    Maximize,
    Minimize,
    CreditCard,
    Wand2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { getTemplates } from '@/app/actions/whatsapp.actions';
import { saveFlow, getFlowById, getFlowsForProject, deleteFlow } from '@/app/actions/flow.actions';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import type { Flow, FlowNode, FlowEdge, Template, MetaFlow, Project } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { TestFlowDialog } from '@/components/wabasimplify/test-flow-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { generateFlowBuilderFlow } from '@/ai/flows/generate-flow-builder-flow';
import { Separator } from '@/components/ui/separator';
import { useProject } from '@/context/project-context';

type NodeType = 'start' | 'text' | 'buttons' | 'condition' | 'webhook' | 'image' | 'input' | 'delay' | 'api' | 'carousel' | 'addToCart' | 'language' | 'sendTemplate' | 'triggerMetaFlow' | 'triggerFlow' | 'payment';

type ButtonConfig = {
    id: string;
    type: 'QUICK_REPLY';
    text: string;
};

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'carousel', label: 'Carousel', icon: View },
    { type: 'payment', label: 'Request Payment', icon: CreditCard },
    { type: 'language', label: 'Set Language', icon: BrainCircuit },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'api', label: 'Call API', icon: ArrowRightLeft },
    { type: 'sendTemplate', label: 'Send Template', icon: FileTextIcon },
    { type: 'triggerMetaFlow', label: 'Trigger Meta Flow', icon: ServerCog },
    { type: 'triggerFlow', label: 'Trigger Flow', icon: GitFork },
];

const NodePreview = ({ node }: { node: FlowNode }) => {
    const renderTextWithVariables = (text?: string) => {
        if (!text) return <span className="italic opacity-50">Enter message...</span>;
        const parts = text.split(/({{\s*[\w\d._]+\s*}})/g);
        return parts.map((part, i) =>
            part.match(/^{{.*}}$/) ? (
                <span key={i} className="font-semibold text-primary/90 bg-primary/10 rounded-sm px-1">
                    {part}
                </span>
            ) : (
                part
            )
        );
    };

    const previewContent = () => {
        switch (node.type) {
            case 'text':
            case 'input':
                return <p className="whitespace-pre-wrap">{renderTextWithVariables(node.data.text)}</p>;
            case 'image':
                return (
                     <div className="space-y-1">
                        <div className="aspect-video bg-background/50 rounded-md flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-foreground/20" />
                        </div>
                        {node.data.caption && <p className="whitespace-pre-wrap text-xs">{renderTextWithVariables(node.data.caption)}</p>}
                    </div>
                );
            case 'buttons':
                return (
                    <div className="space-y-2">
                        <p className="whitespace-pre-wrap">{renderTextWithVariables(node.data.text)}</p>
                        <div className="space-y-1 mt-2 border-t border-muted-foreground/20 pt-2">
                            {(node.data.buttons || []).map((btn: any, index: number) => (
                                <div key={btn.id || index} className="text-center text-primary font-medium bg-background/50 py-1.5 rounded-md text-xs">
                                    {btn.text || `Button ${index + 1}`}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'sendTemplate':
                 return <p className="text-xs text-muted-foreground italic">Sends template: {node.data.templateName || 'None selected'}</p>;
            case 'triggerMetaFlow':
                 return <p className="text-xs text-muted-foreground italic">Triggers flow: {node.data.metaFlowName || 'None selected'}</p>;
            case 'triggerFlow':
                 return <p className="text-xs text-muted-foreground italic">Triggers flow: {node.data.flowName || 'None selected'}</p>;
            case 'payment':
                 return <p className="text-xs text-muted-foreground italic">Request payment of {node.data.paymentAmount || '0'} INR</p>;
            default:
                return null;
        }
    };

    const content = previewContent();
    if (!content) return null;

    return (
        <CardContent className="p-2 pt-0">
            <div className="bg-muted p-2 rounded-lg text-sm text-card-foreground/80">
                {content}
            </div>
        </CardContent>
    );
};


const NodeComponent = ({ 
    node, 
    onSelectNode, 
    isSelected,
    onNodeMouseDown,
    onHandleClick 
}: { 
    node: FlowNode; 
    onSelectNode: (id: string) => void; 
    isSelected: boolean;
    onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string) => void;
}) => {
    const BlockIcon = [...blockTypes, {type: 'start', label: 'Start', icon: Play}].find(b => b.type === node.type)?.icon || MessageSquare;

    const Handle = ({ position, id, style, children }: { position: 'left' | 'right' | 'top' | 'bottom', id: string, style?: React.CSSProperties, children?: React.ReactNode }) => (
         <div 
            id={id}
            style={style}
            data-handle-pos={position}
            className={cn(
                "absolute w-4 h-4 rounded-full bg-background border-2 border-primary hover:bg-primary transition-colors z-10 flex items-center justify-center",
                position === 'left' && "-left-2 top-1/2 -translate-y-1/2",
                position === 'right' && "-right-2 top-1/2 -translate-y-1/2",
            )} 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onHandleClick(e, node.id, id); }}
        >
            {children}
        </div>
    );

    return (
         <div 
            className="absolute cursor-grab active:cursor-grabbing transition-all"
            style={{ top: node.position.y, left: node.position.x }}
            onMouseDown={(e) => onNodeMouseDown(e, node.id)}
            onClick={(e) => {e.stopPropagation(); onSelectNode(node.id)}}
        >
            <Card className={cn(
                "w-64 hover:shadow-xl hover:-translate-y-1 bg-card",
                isSelected && "ring-2 ring-primary shadow-2xl"
            )}>
                <CardHeader className="flex flex-row items-center gap-3 p-3">
                    <BlockIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{node.data.label}</CardTitle>
                </CardHeader>
                 
                <NodePreview node={node} />

                 {node.type === 'condition' && (
                     <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center"><span>Yes</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between items-center"><span>No</span></div>
                    </CardContent>
                )}
                 {node.type === 'payment' && (
                     <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center"><span>Success</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between items-center"><span>Failure</span></div>
                    </CardContent>
                )}
            </Card>

            {node.type !== 'start' && <Handle position="left" id={`${node.id}-input`} />}
            
            {node.type === 'condition' || node.type === 'payment' ? (
                <>
                     <Handle position="right" id={`${node.id}-output-yes`} style={{ top: '33.33%' }} />
                     <Handle position="right" id={`${node.id}-output-no`} style={{ top: '66.67%' }} />
                </>
            ) : node.type === 'buttons' ? (
                (node.data.buttons || []).map((btn: ButtonConfig, index: number) => {
                    const totalButtons = node.data.buttons.length;
                    const topPosition = totalButtons > 1 ? `${(100 / (totalButtons + 1)) * (index + 1)}%` : '50%';
                    return <Handle key={btn.id || index} position="right" id={`${node.id}-btn-${index}`} style={{ top: topPosition }} />;
                })
            ) : (
                 node.type !== 'addToCart' && <Handle position="right" id={`${node.id}-output-main`} />
            )}
        </div>
    );
};

const PropertiesPanel = ({ selectedNode, updateNodeData, deleteNode, templates, metaFlows, allFlows, currentFlow }: { selectedNode: FlowNode | null; updateNodeData: (id: string, data: Partial<any>) => void; deleteNode: (id: string) => void, templates: WithId<Template>[], metaFlows: WithId<MetaFlow>[], allFlows: WithId<Flow>[], currentFlow: WithId<Flow> | null }) => {
    if (!selectedNode) return null;
    
    const { toast } = useToast();

    const handleDataChange = (field: keyof any, value: any) => {
        updateNodeData(selectedNode.id, { [field]: value });
    };

    const handleButtonChange = (index: number, field: 'text', value: string) => {
        const newButtons: ButtonConfig[] = [...(selectedNode.data.buttons || [])];
        newButtons[index] = { ...newButtons[index], [field]: value };
        handleDataChange('buttons', newButtons);
    };

    const addFlowButton = () => {
        const currentButtons = selectedNode.data.buttons || [];
        if (currentButtons.length >= 3) {
            toast({ title: "Limit Reached", description: "WhatsApp allows a maximum of 3 Quick Reply buttons.", variant: "destructive" });
            return;
        }
        const newButtons: ButtonConfig[] = [...currentButtons, { id: `btn-${Date.now()}`, type: 'QUICK_REPLY', text: '' }];
        handleDataChange('buttons', newButtons);
    };

    const removeFlowButton = (index: number) => {
        const newButtons = (selectedNode.data.buttons || []).filter((_: any, i: number) => i !== index);
        handleDataChange('buttons', newButtons);
    };
    
     const handleApiChange = (field: keyof any, value: any) => {
        const currentApiRequest = selectedNode.data.apiRequest || {};
        const newApiRequest = { ...currentApiRequest, [field]: value };
        handleDataChange('apiRequest', newApiRequest);
    };

    const handleMappingChange = (index: number, field: 'variable' | 'path', value: string) => {
        const mappings = [...(selectedNode.data.apiRequest?.responseMappings || [])];
        mappings[index] = { ...mappings[index], [field]: value };
        handleApiChange('responseMappings', mappings);
    };

    const addMapping = () => {
        const mappings = [...(selectedNode.data.apiRequest?.responseMappings || []), { variable: '', path: '' }];
        handleApiChange('responseMappings', mappings);
    };

    const removeMapping = (index: number) => {
        const mappings = (selectedNode.data.apiRequest?.responseMappings || []).filter((_: any, i: number) => i !== index);
        handleApiChange('responseMappings', mappings);
    };

    const renderProperties = () => {
        switch (selectedNode.type) {
            case 'start':
                return <Input id="trigger-keywords" placeholder="e.g., help, menu" value={selectedNode.data.triggerKeywords || ''} onChange={(e) => handleDataChange('triggerKeywords', e.target.value)} />;
            case 'text':
                return <Textarea id="text-content" placeholder="Enter your message here..." value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} className="h-32" />;
            case 'image':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2"><Label htmlFor="image-url">Image URL</Label><Input id="image-url" placeholder="https://example.com/image.png" value={selectedNode.data.imageUrl || ''} onChange={(e) => handleDataChange('imageUrl', e.target.value)} /></div>
                        <div className="space-y-2"><Label htmlFor="image-caption">Caption (Optional)</Label><Textarea id="image-caption" placeholder="A caption for your image..." value={selectedNode.data.caption || ''} onChange={(e) => handleDataChange('caption', e.target.value)} /></div>
                    </div>
                );
            case 'buttons':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="buttons-text">Message Text</Label>
                            <Textarea id="buttons-text" placeholder="Choose an option:" value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Buttons (max 3)</Label>
                            <div className="space-y-3">
                                {(selectedNode.data.buttons || []).map((btn: ButtonConfig, index: number) => (
                                    <div key={btn.id || index} className="flex items-center gap-2">
                                        <Input placeholder="Button Text" value={btn.text} onChange={(e) => handleButtonChange(index, 'text', e.target.value)} maxLength={20} />
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFlowButton(index)}><Trash2 className="h-3 w-3"/></Button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addFlowButton}><Plus className="mr-2 h-4 w-4"/>Add Button</Button>
                        </div>
                    </div>
                );
            case 'input':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2"><Label htmlFor="input-text">Question to Ask</Label><Textarea id="input-text" placeholder="e.g., What is your name?" value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} /></div>
                        <div className="space-y-2"><Label htmlFor="input-variable">Save Answer to Variable</Label><Input id="input-variable" placeholder="e.g., user_name" value={selectedNode.data.variableToSave || ''} onChange={(e) => handleDataChange('variableToSave', e.target.value)} /><p className="text-xs text-muted-foreground">Use {'{{user_name}}'} in later steps.</p></div>
                    </div>
                 );
            case 'delay':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2"><Label htmlFor="delay-seconds">Delay (seconds)</Label><Input id="delay-seconds" type="number" min="1" value={selectedNode.data.delaySeconds || 1} onChange={(e) => handleDataChange('delaySeconds', parseFloat(e.target.value))} /></div>
                        <div className="flex items-center space-x-2"><Switch id="typing-indicator" checked={selectedNode.data.showTyping} onCheckedChange={(checked) => handleDataChange('showTyping', checked)} /><Label htmlFor="typing-indicator">Show typing indicator</Label></div>
                    </div>
                );
             case 'condition':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2"><Label>Condition Type</Label><RadioGroup value={selectedNode.data.conditionType || 'variable'} onValueChange={(val) => handleDataChange('conditionType', val)} className="flex gap-4 pt-1"><div className="flex items-center space-x-2"><RadioGroupItem value="variable" id="type-variable" /><Label htmlFor="type-variable" className="font-normal">Variable</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="user_response" id="type-user-response" /><Label htmlFor="type-user-response" className="font-normal">User Response</Label></div></RadioGroup><p className="text-xs text-muted-foreground">"User Response" will pause the flow and wait for the user's next message.</p></div>
                        {(selectedNode.data.conditionType === 'variable' || !selectedNode.data.conditionType) && <div className="space-y-2"><Label htmlFor="condition-variable">Variable to Check</Label><Input id="condition-variable" placeholder="e.g., {{user_name}}" value={selectedNode.data.variable || ''} onChange={(e) => handleDataChange('variable', e.target.value)} /></div>}
                        <div className="space-y-2"><Label htmlFor="condition-operator">Operator</Label><Select value={selectedNode.data.operator || 'equals'} onValueChange={(val) => handleDataChange('operator', val)}><SelectTrigger id="condition-operator"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="equals">Equals</SelectItem><SelectItem value="not_equals">Does not equal</SelectItem><SelectItem value="contains">Contains</SelectItem><SelectItem value="is_one_of">Is one of (comma-sep)</SelectItem><SelectItem value="is_not_one_of">Is not one of (comma-sep)</SelectItem><SelectItem value="greater_than">Is greater than</SelectItem><SelectItem value="less_than">Is less than</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label htmlFor="condition-value">Value to Compare Against</Label><Input id="condition-value" placeholder="e.g., confirmed" value={selectedNode.data.value || ''} onChange={(e) => handleDataChange('value', e.target.value)} /></div>
                    </div>
                );
            case 'api':
            case 'webhook':
                 return (
                    <Tabs defaultValue="request">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="request">Request</TabsTrigger>
                            <TabsTrigger value="response">Response</TabsTrigger>
                        </TabsList>
                        <TabsContent value="request" className="space-y-4 pt-2">
                            <Select value={selectedNode.data.apiRequest?.method || 'GET'} onValueChange={(val) => handleApiChange('method', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GET">GET</SelectItem>
                                    <SelectItem value="POST">POST</SelectItem>
                                    <SelectItem value="PUT">PUT</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input placeholder="https://api.example.com" value={selectedNode.data.apiRequest?.url || ''} onChange={(e) => handleApiChange('url', e.target.value)} />
                            <Textarea placeholder='Headers (JSON format)\n{\n  "Authorization": "Bearer ..."\n}' className="font-mono text-xs h-24" value={selectedNode.data.apiRequest?.headers || ''} onChange={(e) => handleApiChange('headers', e.target.value)} />
                            <Textarea placeholder="Request Body (JSON)" className="font-mono text-xs h-32" value={selectedNode.data.apiRequest?.body || ''} onChange={(e) => handleApiChange('body', e.target.value)} />
                        </TabsContent>
                        <TabsContent value="response" className="space-y-4 pt-2">
                            <Label>Save Response to Variables</Label>
                            <div className="space-y-3">
                                {(selectedNode.data.apiRequest?.responseMappings || []).map((mapping: any, index: number) => (
                                    <div key={index} className="p-2 border rounded-md space-y-2 relative bg-background">
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeMapping(index)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                        <Input placeholder="Variable Name (e.g. user_email)" value={mapping.variable || ''} onChange={(e) => handleMappingChange(index, 'variable', e.target.value)} />
                                        <Input placeholder="Response Path (e.g. data.email)" value={mapping.path || ''} onChange={(e) => handleMappingChange(index, 'path', e.target.value)} />
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addMapping}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Mapping
                            </Button>
                            <p className="text-xs text-muted-foreground">e.g., to access a field, use {'{{variable_name}}'}</p>
                        </TabsContent>
                    </Tabs>
                );
            case 'sendTemplate':
                return <div className="space-y-2"><Label>Template</Label><Select value={selectedNode.data.templateId || ''} onValueChange={(val) => handleDataChange('templateId', val)}><SelectTrigger><SelectValue placeholder="Select a template..." /></SelectTrigger><SelectContent>{templates.map(t => <SelectItem key={t._id.toString()} value={t._id.toString()}>{t.name}</SelectItem>)}</SelectContent></Select></div>;
            case 'triggerMetaFlow':
                 return <div className="space-y-4"><div className="space-y-2"><Label>Meta Flow to Trigger</Label><Select value={selectedNode.data.metaFlowId || ''} onValueChange={(val) => handleDataChange('metaFlowId', val)}><SelectTrigger><SelectValue placeholder="Select a Meta Flow..." /></SelectTrigger><SelectContent>{metaFlows.map(f => <SelectItem key={f._id.toString()} value={f._id.toString()}>{f.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Header</Label><Input value={selectedNode.data.header || ''} onChange={(e) => handleDataChange('header', e.target.value)} /></div><div className="space-y-2"><Label>Body</Label><Input value={selectedNode.data.body || ''} onChange={(e) => handleDataChange('body', e.target.value)} /></div><div className="space-y-2"><Label>Footer</Label><Input value={selectedNode.data.footer || ''} onChange={(e) => handleDataChange('footer', e.target.value)} /></div></div>;
            case 'triggerFlow':
                 return <div className="space-y-2"><Label>Flow to Trigger</Label><Select value={selectedNode.data.flowId || ''} onValueChange={(val) => handleDataChange('flowId', val)}><SelectTrigger><SelectValue placeholder="Select a flow..." /></SelectTrigger><SelectContent>{allFlows.filter(f => f._id.toString() !== currentFlow?._id.toString()).map(f => <SelectItem key={f._id.toString()} value={f._id.toString()}>{f.name}</SelectItem>)}</SelectContent></Select></div>;
            case 'payment':
                 return <div className="space-y-4"><div className="space-y-2"><Label>Amount (INR)</Label><Input type="number" step="0.01" placeholder="e.g. 500" value={selectedNode.data.paymentAmount || ''} onChange={(e) => handleDataChange('paymentAmount', e.target.value)} /></div><div className="space-y-2"><Label>Description</Label><Textarea placeholder="e.g. Payment for Order #123" value={selectedNode.data.paymentDescription || ''} onChange={(e) => handleDataChange('paymentDescription', e.target.value)} /></div></div>;
            default:
                return <p className="text-sm text-muted-foreground italic">No properties to configure for this block type.</p>;
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Properties</CardTitle>
                <CardDescription>Configure the '{selectedNode.data.label}' block.</CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1">
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="node-label">Block Label</Label>
                        <Input id="node-label" value={selectedNode.data.label || ''} onChange={(e) => handleDataChange('label', e.target.value)} />
                    </div>
                    <Separator />
                    {renderProperties()}
                </CardContent>
            </ScrollArea>
            {selectedNode.type !== 'start' && (
                <CardFooter className="border-t pt-4">
                     <Button variant="destructive" className="w-full" onClick={() => deleteNode(selectedNode.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Block
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
};

const FlowsAndBlocksPanel = ({ 
    isLoading,
    flows,
    currentFlow,
    handleSelectFlow,
    handleDeleteFlow,
    handleCreateNewFlow,
    addNode,
} : {
    isLoading: boolean;
    flows: WithId<Flow>[];
    currentFlow: WithId<Flow> | null;
    handleSelectFlow: (id: string) => void;
    handleDeleteFlow: (id: string) => void;
    handleCreateNewFlow: () => void;
    addNode: (type: NodeType) => void;
}) => (
    <>
        <Card>
            <CardHeader className="flex-row items-center justify-between p-3">
                <CardTitle className="text-base">Flows</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateNewFlow}><Plus/></Button>
            </CardHeader>
            <CardContent className="p-2 pt-0">
                <ScrollArea className="h-40">
                    {isLoading && flows.length === 0 ? <Skeleton className="h-full w-full"/> : 
                        flows.map(flow => (
                            <div key={flow._id.toString()} className="flex items-center group">
                                <Button 
                                    variant="ghost" 
                                    className={cn("w-full justify-start font-normal", currentFlow?._id.toString() === flow._id.toString() && 'bg-muted font-semibold')}
                                    onClick={() => handleSelectFlow(flow._id.toString())}
                                >
                                    <File className="mr-2 h-4 w-4"/>
                                    {flow.name}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteFlow(flow._id.toString())}>
                                    <Trash2 className="h-4 w-4"/>
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
                        <Button key={type} variant="outline" className="w-full justify-start mb-2" onClick={() => addNode(type as NodeType)}>
                            <Icon className="mr-2 h-4 w-4" />
                            {label}
                        </Button>
                    ))}
                </ScrollArea>
            </CardContent>
        </Card>
    </>
);
```
  </change>
  <change>
    <file>src/app/dashboard/flow-builder/page.tsx</file>
    <content><![CDATA[
'use client';

import { FlowBuilder } from '@/components/wabasimplify/flow-builder';

export default function FlowBuilderPage() {
    return <FlowBuilder />;
}
