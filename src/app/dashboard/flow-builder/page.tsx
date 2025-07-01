

'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
    File,
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
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFlowsForProject, saveFlow, deleteFlow, getFlowById, getFlowBuilderPageData, getTemplates } from '@/app/actions';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import type { Flow, FlowNode, FlowEdge, Template, MetaFlow } from '@/app/actions';
import type { WithId } from 'mongodb';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { TestFlowDialog } from '@/components/wabasimplify/test-flow-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

type NodeType = 'start' | 'text' | 'buttons' | 'condition' | 'webhook' | 'image' | 'input' | 'delay' | 'api' | 'carousel' | 'addToCart' | 'language' | 'sendTemplate' | 'triggerMetaFlow';

type ButtonConfig = {
    id: string;
    type: 'QUICK_REPLY';
    text: string;
};

type CarouselSection = {
    title: string;
    products: { product_retailer_id: string }[];
};

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'carousel', label: 'Carousel', icon: View },
    { type: 'language', label: 'Set Language', icon: BrainCircuit },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'api', label: 'Call API', icon: ArrowRightLeft },
    { type: 'sendTemplate', label: 'Send Template', icon: FileTextIcon },
    { type: 'triggerMetaFlow', label: 'Trigger Meta Flow', icon: ServerCog },
    { type: 'addToCart', label: 'Add to Cart', icon: ShoppingCart },
];

const NodePreview = ({ node }: { node: FlowNode }) => {
    const renderTextWithVariables = (text: string) => {
        if (!text) return null;
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
                return <p className="whitespace-pre-wrap">{renderTextWithVariables(node.data.text) || <span className="italic opacity-50">Enter message...</span>}</p>;
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
                        <p className="whitespace-pre-wrap">{renderTextWithVariables(node.data.text) || <span className="italic opacity-50">Enter message...</span>}</p>
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
            </Card>

            {node.type !== 'start' && <Handle position="left" id={`${node.id}-input`} />}
            
            {node.type === 'condition' ? (
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

const ConnectionLine = ({ from, to }: { from: {x: number, y: number}, to: {x: number, y: number} }) => {
    if (!from || !to) return null;
    const dx = Math.abs(from.x - to.x) * 0.5;
    const path = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
    return <path d={path} stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeDasharray="5,5" />;
};

const PropertiesPanel = ({ selectedNode, updateNodeData, deleteNode, templates, metaFlows }: { selectedNode: FlowNode | null; updateNodeData: (id: string, data: Partial<any>) => void, deleteNode: (id: string) => void, templates: WithId<Template>[], metaFlows: WithId<MetaFlow>[] }) => {
    const { toast } = useToast();

    if (!selectedNode) {
        return (
            <Card className="h-full">
                <CardContent className="flex h-full items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground text-center">Select a block to see its properties.</p>
                </CardContent>
            </Card>
        );
    }
    
    const handleDataChange = (field: keyof any, value: any) => {
        updateNodeData(selectedNode.id, { [field]: value });
    };

    const handleSelectChange = (id: string, name: string, fieldPrefix: string) => {
        updateNodeData(selectedNode.id, {
            [`${fieldPrefix}Id`]: id,
            [`${fieldPrefix}Name`]: name,
        });
    }

    const handleApiChange = (field: keyof any, value: any) => {
        const currentApiRequest = selectedNode.data.apiRequest || {};
        const newApiRequest = { ...currentApiRequest, [field]: value };
        updateNodeData(selectedNode.id, { apiRequest: newApiRequest });
    };

     const handleButtonChange = (index: number, field: 'text', value: string) => {
        const newButtons: ButtonConfig[] = [...(selectedNode.data.buttons || [])];
        newButtons[index] = { ...newButtons[index], [field]: value };
        handleDataChange('buttons', newButtons);
    };

    const addFlowButton = () => {
        const currentButtons = selectedNode.data.buttons || [];
        if (currentButtons.length >= 3) {
            toast({ title: "Limit Reached", description: "You can add a maximum of 3 Quick Reply buttons.", variant: "destructive" });
            return;
        }
        const newButtons: ButtonConfig[] = [...currentButtons, { id: `btn-${Date.now()}`, type: 'QUICK_REPLY', text: '' }];
        handleDataChange('buttons', newButtons);
    };

    const removeFlowButton = (index: number) => {
        const newButtons = (selectedNode.data.buttons || []).filter((_: any, i: number) => i !== index);
        handleDataChange('buttons', newButtons);
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

    const handleCarouselSectionChange = (sectionIndex: number, field: 'title', value: string) => {
        const newSections = [...(selectedNode.data.sections || [])];
        newSections[sectionIndex] = { ...newSections[sectionIndex], [field]: value };
        handleDataChange('sections', newSections);
    };
    
    const handleCarouselProductChange = (sectionIndex: number, productIndex: number, value: string) => {
        const newSections = JSON.parse(JSON.stringify(selectedNode.data.sections || []));
        newSections[sectionIndex].products[productIndex].product_retailer_id = value;
        handleDataChange('sections', newSections);
    };
    
    const addCarouselSection = () => {
        const newSections = [...(selectedNode.data.sections || []), { title: '', products: [{ product_retailer_id: '' }] }];
        handleDataChange('sections', newSections);
    };
    
    const removeCarouselSection = (sectionIndex: number) => {
        const newSections = (selectedNode.data.sections || []).filter((_: any, i: number) => i !== sectionIndex);
        handleDataChange('sections', newSections);
    };
    
    const addCarouselProduct = (sectionIndex: number) => {
        const newSections = JSON.parse(JSON.stringify(selectedNode.data.sections || []));
        newSections[sectionIndex].products.push({ product_retailer_id: '' });
        handleDataChange('sections', newSections);
    };

    const removeCarouselProduct = (sectionIndex: number, productIndex: number) => {
        const newSections = JSON.parse(JSON.stringify(selectedNode.data.sections || []));
        newSections[sectionIndex].products = newSections[sectionIndex].products.filter((_: any, i: number) => i !== productIndex);
        handleDataChange('sections', newSections);
    };

    const renderProperties = () => {
        switch (selectedNode.type) {
            case 'start':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="triggerKeywords">Trigger Keywords</Label>
                        <Input 
                            id="triggerKeywords"
                            placeholder="e.g., help, support, contact" 
                            value={selectedNode.data.triggerKeywords || ''} 
                            onChange={(e) => handleDataChange('triggerKeywords', e.target.value)}
                        />
                         <p className="text-xs text-muted-foreground">Comma-separated keywords to start this flow.</p>
                    </div>
                );
            case 'text':
                return <Textarea id="text-content" placeholder="Enter your message here..." value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} className="h-32" />;
            case 'image':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="image-url">Image URL</Label>
                            <Input id="image-url" placeholder="https://example.com/image.png" value={selectedNode.data.imageUrl || ''} onChange={(e) => handleDataChange('imageUrl', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="image-caption">Caption (Optional)</Label>
                            <Textarea id="image-caption" placeholder="A caption for your image..." value={selectedNode.data.caption || ''} onChange={(e) => handleDataChange('caption', e.target.value)} />
                        </div>
                    </div>
                );
            case 'buttons':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="buttons-text">Message Text</Label>
                            <Textarea id="buttons-text" placeholder="Choose an option:" value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} />
                        </div>
                        <Separator/>
                        <div className="space-y-2">
                            <Label>Buttons (Quick Reply)</Label>
                            <div className="space-y-3">
                                {(selectedNode.data.buttons || []).map((btn: ButtonConfig, index: number) => (
                                    <div key={btn.id || index} className="p-2 border rounded-md space-y-2 relative">
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeFlowButton(index)}><Trash2 className="h-3 w-3"/></Button>
                                        <Input 
                                            placeholder="Button Text" 
                                            value={btn.text} 
                                            onChange={(e) => handleButtonChange(index, 'text', e.target.value)} 
                                            maxLength={20}
                                        />
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addFlowButton}><Plus className="mr-2 h-4 w-4"/>Add Button</Button>
                            <p className="text-xs text-muted-foreground mt-2">Note: Buttons in flows are Quick Replies only. For URL/Call buttons, you must use a pre-approved template.</p>
                        </div>
                    </div>
                );
            case 'condition':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Condition Type</Label>
                            <RadioGroup
                                value={selectedNode.data.conditionType || 'variable'}
                                onValueChange={(val) => handleDataChange('conditionType', val)}
                                className="flex gap-4 pt-1"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="variable" id="type-variable" />
                                    <Label htmlFor="type-variable" className="font-normal">Variable</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="user_response" id="type-user-response" />
                                    <Label htmlFor="type-user-response" className="font-normal">User Response</Label>
                                </div>
                            </RadioGroup>
                            <p className="text-xs text-muted-foreground">"User Response" will pause the flow and wait for the user's next message.</p>
                        </div>

                        {(selectedNode.data.conditionType === 'variable' || !selectedNode.data.conditionType) && (
                            <div className="space-y-2">
                                <Label htmlFor="condition-variable">Variable to Check</Label>
                                <Input
                                    id="condition-variable"
                                    placeholder="e.g., {{user_name}} or {{order_status}}"
                                    value={selectedNode.data.variable || ''}
                                    onChange={(e) => handleDataChange('variable', e.target.value)}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="condition-operator">Operator</Label>
                            <Select
                                value={selectedNode.data.operator || 'equals'}
                                onValueChange={(val) => handleDataChange('operator', val)}
                            >
                                <SelectTrigger id="condition-operator"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="equals">Equals</SelectItem>
                                    <SelectItem value="not_equals">Does not equal</SelectItem>
                                    <SelectItem value="contains">Contains</SelectItem>
                                    <SelectItem value="is_one_of">Is one of (comma-sep)</SelectItem>
                                    <SelectItem value="is_not_one_of">Is not one of (comma-sep)</SelectItem>
                                    <SelectItem value="greater_than">Greater than (number)</SelectItem>
                                    <SelectItem value="less_than">Less than (number)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="condition-value">Value to Compare Against</Label>
                            <Input
                                id="condition-value"
                                placeholder="e.g., confirmed"
                                value={selectedNode.data.value || ''}
                                onChange={(e) => handleDataChange('value', e.target.value)}
                            />
                        </div>
                    </div>
                );
            case 'language':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Language Mode</Label>
                            <RadioGroup
                                value={selectedNode.data.mode || 'automatic'}
                                onValueChange={(val) => handleDataChange('mode', val)}
                                className="flex gap-4 pt-1"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="automatic" id="mode-auto" />
                                    <Label htmlFor="mode-auto" className="font-normal">Automatic</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="manual" id="mode-manual" />
                                    <Label htmlFor="mode-manual" className="font-normal">Manual</Label>
                                </div>
                            </RadioGroup>
                            <p className="text-xs text-muted-foreground">"Automatic" uses the contact's country code. "Manual" asks the user.</p>
                        </div>
                        {selectedNode.data.mode === 'manual' && (
                            <div className="space-y-4 p-3 border rounded-md bg-muted/50">
                                <div className="space-y-2">
                                    <Label htmlFor="lang-prompt">Prompt Message</Label>
                                    <Textarea id="lang-prompt" placeholder="Please select your language:" value={selectedNode.data.promptMessage || ''} onChange={(e) => handleDataChange('promptMessage', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lang-list">Languages (comma-separated)</Label>
                                    <Input id="lang-list" placeholder="English, Spanish, French" value={selectedNode.data.languages || ''} onChange={(e) => handleDataChange('languages', e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'delay':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                             <Label htmlFor="delay-seconds">Delay (seconds)</Label>
                             <Input id="delay-seconds" type="number" min="1" value={selectedNode.data.delaySeconds || 1} onChange={(e) => handleDataChange('delaySeconds', parseFloat(e.target.value))} />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="typing-indicator" checked={selectedNode.data.showTyping} onCheckedChange={(checked) => handleDataChange('showTyping', checked)} />
                            <Label htmlFor="typing-indicator">Show typing indicator</Label>
                        </div>
                    </div>
                );
            case 'input':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="input-text">Question to Ask</Label>
                            <Textarea id="input-text" placeholder="e.g., What is your name?" value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                             <Label htmlFor="input-variable">Save Answer to Variable</Label>
                             <Input id="input-variable" placeholder="e.g., user_name" value={selectedNode.data.variableToSave || ''} onChange={(e) => handleDataChange('variableToSave', e.target.value)} />
                        </div>
                    </div>
                 );
            case 'sendTemplate':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="template-select">Select Template</Label>
                        <Select
                            value={selectedNode.data.templateId || ''}
                            onValueChange={(val) => handleSelectChange(val, templates.find(t => t._id.toString() === val)?.name || '', 'template')}
                        >
                            <SelectTrigger id="template-select"><SelectValue placeholder="Choose a template..." /></SelectTrigger>
                            <SelectContent>
                                {templates.filter(t => t.status === 'APPROVED').map(t => (
                                    <SelectItem key={t._id.toString()} value={t._id.toString()}>
                                        {t.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Use variables in the format {'{{variable1}}'} to fill template placeholders.</p>
                    </div>
                );
             case 'triggerMetaFlow':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Select Meta Flow</Label>
                            <Select
                                value={selectedNode.data.metaFlowId || ''}
                                onValueChange={(val) => handleSelectChange(val, metaFlows.find(f => f._id.toString() === val)?.name || '', 'metaFlow')}
                            >
                                <SelectTrigger><SelectValue placeholder="Choose a Meta flow..." /></SelectTrigger>
                                <SelectContent>
                                    {metaFlows.map(f => (
                                        <SelectItem key={f._id.toString()} value={f._id.toString()}>
                                            {f.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Separator />
                        <h4 className="font-medium">Trigger Message Content</h4>
                        <div className="space-y-2">
                            <Label htmlFor="flow-header">Header Text</Label>
                            <Input id="flow-header" value={selectedNode.data.header || ''} onChange={(e) => handleDataChange('header', e.target.value)} placeholder="e.g., Complete This Form" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="flow-body">Body Text</Label>
                            <Textarea id="flow-body" value={selectedNode.data.body || ''} onChange={(e) => handleDataChange('body', e.target.value)} placeholder="e.g., Tap the button to start." />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="flow-footer">Footer Text</Label>
                            <Input id="flow-footer" value={selectedNode.data.footer || ''} onChange={(e) => handleDataChange('footer', e.target.value)} placeholder="e.g., Powered by Wachat" />
                        </div>
                    </div>
                );
             case 'api':
                return (
                    <Tabs defaultValue="request">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="request">Request</TabsTrigger>
                            <TabsTrigger value="response">Response</TabsTrigger>
                        </TabsList>
                        <TabsContent value="request" className="space-y-4 pt-2">
                             <Select value={selectedNode.data.apiRequest?.method || 'GET'} onValueChange={(val) => handleApiChange('method', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
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
                                    <div key={index} className="p-2 border rounded-md space-y-2 relative">
                                        <Button
                                            type="button" variant="ghost" size="icon"
                                            className="absolute top-1 right-1 h-6 w-6"
                                            onClick={() => removeMapping(index)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                        <Input
                                            placeholder="Variable Name (e.g. user_email)"
                                            value={mapping.variable || ''}
                                            onChange={(e) => handleMappingChange(index, 'variable', e.target.value)}
                                        />
                                        <Input
                                            placeholder="Response Path (e.g. data.email)"
                                            value={mapping.path || ''}
                                            onChange={(e) => handleMappingChange(index, 'path', e.target.value)}
                                        />
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
            case 'carousel':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="carousel-header">Header Text</Label>
                            <Input id="carousel-header" placeholder="Our Top Items" value={selectedNode.data.headerText || ''} onChange={(e) => handleDataChange('headerText', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="carousel-body">Body Text</Label>
                            <Textarea id="carousel-body" placeholder="Check out these amazing items." value={selectedNode.data.bodyText || ''} onChange={(e) => handleDataChange('bodyText', e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="carousel-footer">Footer Text</Label>
                            <Input id="carousel-footer" placeholder="Powered by Wachat" value={selectedNode.data.footerText || ''} onChange={(e) => handleDataChange('footerText', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="carousel-catalog-id">Catalog ID</Label>
                            <Input id="carousel-catalog-id" placeholder="Your Meta Catalog ID" value={selectedNode.data.catalogId || ''} onChange={(e) => handleDataChange('catalogId', e.target.value)} required />
                            <p className="text-xs text-muted-foreground">This feature requires a Meta Commerce Catalog.</p>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Sections</Label>
                                <Button type="button" size="sm" variant="outline" onClick={addCarouselSection}>
                                    <Plus className="mr-2 h-4 w-4" /> Section
                                </Button>
                            </div>
                             {(selectedNode.data.sections || []).map((section: CarouselSection, sectionIndex: number) => (
                                <div key={sectionIndex} className="p-3 border rounded-lg space-y-3 bg-muted/50">
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            placeholder="Section Title" 
                                            value={section.title} 
                                            onChange={(e) => handleCarouselSectionChange(sectionIndex, 'title', e.target.value)}
                                        />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeCarouselSection(sectionIndex)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                    <div className="space-y-2 pl-4">
                                        {(section.products || []).map((product, productIndex) => (
                                            <div key={productIndex} className="flex items-center gap-2">
                                                <Input 
                                                    placeholder="Item/Product ID" 
                                                    value={product.product_retailer_id}
                                                    onChange={(e) => handleCarouselProductChange(sectionIndex, productIndex, e.target.value)}
                                                />
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeCarouselProduct(sectionIndex, productIndex)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </div>
                                        ))}
                                        <Button type="button" size="sm" variant="link" onClick={() => addCarouselProduct(sectionIndex)}>+ Add Item/Product</Button>
                                    </div>
                                </div>
                             ))}
                        </div>
                    </div>
                );
            case 'addToCart':
                 return <p className="text-sm text-muted-foreground italic">Configuration for this block is coming soon.</p>;
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

const NODE_WIDTH = 256;

const getNodeHandlePosition = (node: FlowNode, handleId: string) => {
    if (!node || !handleId) return null;

    const x = node.position.x;
    const y = node.position.y;
    
    // Consistent height for simple nodes
    let nodeHeight = 60; 
    
    if (node.type === 'condition') nodeHeight = 80;
    if (node.type === 'buttons') {
        const buttonCount = node.data.buttons?.length || 1;
        nodeHeight = 60 + (buttonCount * 20); // Base height + height per button
    }


    if (handleId.endsWith('-input')) {
        return { x: x, y: y + 30 }; // Consistent input position
    }
    if (handleId.endsWith('-output-main')) {
        return { x: x + NODE_WIDTH, y: y + 30 };
    }
    if (handleId.endsWith('-output-yes')) {
        return { x: x + NODE_WIDTH, y: y + nodeHeight * (1/3) };
    }
    if (handleId.endsWith('-output-no')) {
        return { x: x + NODE_WIDTH, y: y + nodeHeight * (2/3) };
    }
    if (handleId.includes('-btn-')) {
        const buttonIndex = parseInt(handleId.split('-btn-')[1], 10);
        const totalButtons = node.data.buttons.length;
        const topPosition = totalButtons > 1 ? (60 + (nodeHeight - 60) / (totalButtons + 1) * (buttonIndex + 1)) : 60 + (nodeHeight - 60) / 2;
        return { x: x + NODE_WIDTH, y: y + topPosition };
    }
    
    // Fallback for generic output handles from older data structures
    if (handleId.includes('output')) {
        return { x: x + NODE_WIDTH, y: y + 30 };
    }
    
    return null;
}

const getEdgePath = (sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
    if (!sourcePos || !targetPos) return '';
    const dx = Math.abs(sourcePos.x - targetPos.x) * 0.5;
    const path = `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + dx} ${sourcePos.y}, ${targetPos.x - dx} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
    return path;
};

const FlowsAndBlocksPanel = ({ 
    isLoading,
    isDeleting,
    flows,
    currentFlow,
    handleSelectFlow,
    handleDeleteFlow,
    handleCreateNewFlow,
    addNode,
} : {
    isLoading: boolean;
    isDeleting: boolean;
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
                <ScrollArea className="h-32">
                    {isLoading && flows.length === 0 ? <Skeleton className="h-full w-full"/> : 
                        flows.map(flow => (
                            <div key={flow._id.toString()} className="flex items-center group">
                                <Button 
                                    variant="ghost" 
                                    className={cn("w-full justify-start font-normal", currentFlow?._id.toString() === flow._id.toString() && "bg-muted font-semibold")}
                                    onClick={() => handleSelectFlow(flow._id.toString())}
                                >
                                    <File className="mr-2 h-4 w-4"/>
                                    {flow.name}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteFlow(flow._id.toString())} disabled={isDeleting}>
                                    {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4"/>}
                                </Button>
                            </div>
                        ))
                    }
                </ScrollArea>
            </CardContent>
        </Card>
        <Card className="flex-1">
            <CardHeader className="p-3"><CardTitle className="text-base">Blocks</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-2 pt-0">
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

export default function FlowBuilderPage() {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [flows, setFlows] = useState<WithId<Flow>[]>([]);
    const [templates, setTemplates] = useState<WithId<Template>[]>([]);
    const [metaFlows, setMetaFlows] = useState<WithId<MetaFlow>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<Flow> | null>(null);
    const [nodes, setNodes] = useState<FlowNode[]>([]);
    const [edges, setEdges] = useState<FlowEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    const [isDeleting, startDeleteTransition] = useTransition();
    const [isTestFlowOpen, setIsTestFlowOpen] = useState(false);
    
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<{ sourceNodeId: string; sourceHandleId: string; startPos: { x: number; y: number } } | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const [isBlocksSheetOpen, setIsBlocksSheetOpen] = useState(false);
    const [isPropsSheetOpen, setIsPropsSheetOpen] = useState(false);
    
    const [isFullScreen, setIsFullScreen] = useState(false);

    useEffect(() => {
        setIsClient(true);
        document.title = 'Flow Builder | Wachat';
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    const handleCreateNewFlow = () => {
        const startNode = { id: 'node-start', type: 'start' as NodeType, data: { label: 'Start Flow' }, position: { x: 50, y: 150 } };
        setCurrentFlow(null);
        setNodes([startNode]);
        setEdges([]);
        setSelectedNodeId(startNode.id);
        setPan({x: 0, y: 0});
        setZoom(1);
    };

    const loadInitialData = useCallback(async () => {
        if (projectId) {
            startLoadingTransition(async () => {
                const [flowsData, templateData, metaFlowsData] = await Promise.all([
                    getFlowBuilderPageData(projectId),
                    getTemplates(projectId),
                    getMetaFlows(projectId),
                ]);
                setFlows(flowsData.flows);
                setTemplates(templateData);
                setMetaFlows(metaFlowsData);
                if (flowsData.initialFlow) {
                    setCurrentFlow(flowsData.initialFlow);
                    setNodes(flowsData.initialFlow.nodes || []);
                    setEdges(flowsData.initialFlow.edges || []);
                    setSelectedNodeId(null);
                } else {
                    handleCreateNewFlow();
                }
            });
        }
    }, [projectId]);

    useEffect(() => {
        if (isClient && projectId) {
            loadInitialData();
        }
    }, [isClient, projectId, loadInitialData]);

    const loadFlowsList = useCallback(async () => {
        if (projectId) {
           const fetchedFlows = await getFlowsForProject(projectId);
           setFlows(fetchedFlows);
        }
   }, [projectId]);

    const handleSelectFlow = useCallback(async (flowId: string) => {
        startLoadingTransition(async () => {
            const fullFlow = await getFlowById(flowId);
            if (fullFlow) {
                setCurrentFlow(fullFlow);
                setNodes(fullFlow.nodes || []);
                setEdges(fullFlow.edges || []);
                setSelectedNodeId(null);
                setIsBlocksSheetOpen(false);
            }
        });
    }, []);
    
    const handleDeleteFlow = (flowId: string) => {
        startDeleteTransition(async () => {
            const result = await deleteFlow(flowId);
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.message });
                loadInitialData();
            }
        });
    };

    const addNode = (type: NodeType) => {
        const centerOfViewX = viewportRef.current ? (viewportRef.current.clientWidth / 2 - pan.x) / zoom : 300;
        const centerOfViewY = viewportRef.current ? (viewportRef.current.clientHeight / 2 - pan.y) / zoom : 150;
    
        const newNode: FlowNode = {
            id: `node-${type}-${Date.now()}`,
            type,
            data: { 
                label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                apiRequest: { method: 'GET', url: '', headers: '', body: '', responseMappings: [] },
                mode: 'automatic',
            },
            position: { x: centerOfViewX, y: centerOfViewY },
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
        setIsBlocksSheetOpen(false);
    };
    
    const updateNodeData = (id: string, data: Partial<any>) => {
        setNodes(prev => prev.map(node => 
            node.id === id ? { ...node, data: { ...node.data, ...data } } : node
        ));
    };
    
    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(node => node.id !== id));
        setEdges(prev => prev.filter(edge => edge.source !== id && edge.target !== id));
        setSelectedNodeId(null);
        setIsPropsSheetOpen(false);
    };

    const handleSaveFlow = () => {
        const flowName = (document.getElementById('flow-name-input') as HTMLInputElement)?.value;
        if (!projectId || !flowName) {
            toast({ title: "Cannot Save", description: "Flow name and project are required.", variant: 'destructive' });
            return;
        }

        const startNode = nodes.find(n => n.type === 'start');
        const triggerKeywords = startNode?.data.triggerKeywords?.split(',').map((k: string) => k.trim()).filter(Boolean) || [];
        
        startSaveTransition(async () => {
            const result = await saveFlow({
                flowId: currentFlow?._id.toString(),
                projectId,
                name: flowName,
                nodes,
                edges,
                triggerKeywords
            });
            if (result.error) {
                toast({ title: "Error Saving Flow", description: result.error, variant: 'destructive' });
            } else {
                toast({ title: "Flow Saved!", description: result.message });
                if (result.flowId && !currentFlow?._id) {
                    await handleSelectFlow(result.flowId);
                }
                loadFlowsList();
            }
        });
    };

    const handleCopyJson = () => {
        const flowName = (document.getElementById('flow-name-input') as HTMLInputElement)?.value;
        const flowStructure = {
            name: flowName,
            nodes,
            edges,
        };
        const jsonString = JSON.stringify(flowStructure, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
            toast({ title: 'Success', description: 'Flow JSON copied to clipboard.' });
        }).catch(err => {
            console.error("Failed to copy JSON:", err);
            toast({ title: 'Error', description: 'Failed to copy JSON to clipboard.', variant: 'destructive' });
        });
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingNode(nodeId);
    };
    
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            e.preventDefault();
            setIsPanning(true);
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        } else if (draggingNode) {
            setNodes(prev => prev.map(n => 
                n.id === draggingNode
                    ? { ...n, position: { x: n.position.x + e.movementX / zoom, y: n.position.y + e.movementY / zoom } } 
                    : n
            ));
        }
        
        if (connecting && viewportRef.current) {
            const rect = viewportRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            setMousePosition({ x: (mouseX - pan.x) / zoom, y: (mouseY - pan.y) / zoom });
        }
    };

    const handleCanvasMouseUp = () => {
        setIsPanning(false);
        setDraggingNode(null);
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            if (connecting) {
                setConnecting(null);
            } else {
                setSelectedNodeId(null);
            }
        }
    }

    const handleHandleClick = (e: React.MouseEvent, nodeId: string, handleId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!viewportRef.current) return;
        
        const isOutputHandle = handleId.includes('output') || handleId.includes('-btn-');

        if (isOutputHandle) {
            const sourceNode = nodes.find(n => n.id === nodeId);
            if(sourceNode){
                const handlePos = getNodeHandlePosition(sourceNode, handleId);
                if (handlePos) {
                    setConnecting({ sourceNodeId: nodeId, sourceHandleId: handleId, startPos: handlePos });
                }
            }
        } else if (connecting && !isOutputHandle) {
            if (connecting.sourceNodeId === nodeId) {
                setConnecting(null);
                return;
            }

            const edgesWithoutExistingTarget = edges.filter(edge => edge.targetHandle !== handleId);

            const newEdge: FlowEdge = {
                id: `edge-${connecting.sourceNodeId}-${nodeId}-${connecting.sourceHandleId}-${handleId}`,
                source: connecting.sourceNodeId,
                target: nodeId,
                sourceHandle: connecting.sourceHandleId,
                targetHandle: handleId
            };
            
            setEdges([...edgesWithoutExistingTarget, newEdge]);
            setConnecting(null);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (!viewportRef.current) return;
    
        const rect = viewportRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
    
        const zoomFactor = -0.001;
        const newZoom = Math.max(0.2, Math.min(2, zoom + e.deltaY * zoomFactor));
        
        const worldX = (mouseX - pan.x) / zoom;
        const worldY = (mouseY - pan.y) / zoom;
        
        const newPanX = mouseX - worldX * newZoom;
        const newPanY = mouseY - worldY * newZoom;
    
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
    };

    useEffect(() => {
        if (selectedNodeId) {
            setIsPropsSheetOpen(true);
        }
    }, [selectedNodeId]);
    
    const handleZoom = (direction: 'in' | 'out') => {
        setZoom(prevZoom => {
            const newZoom = direction === 'in' ? prevZoom * 1.2 : prevZoom / 1.2;
            return Math.max(0.2, Math.min(2, newZoom));
        });
    };

    const handleResetView = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const handleToggleFullScreen = () => {
        if (!viewportRef.current) return;

        if (!document.fullscreenElement) {
            viewportRef.current.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    useEffect(() => {
        const handleFullScreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);


    const selectedNode = nodes.find(node => node.id === selectedNodeId) || null;

    if (!isClient) return <div className="h-full w-full"><Skeleton className="h-full w-full"/></div>
    if (!projectId) {
        return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No Project Selected</AlertTitle><AlertDescription>Please select a project from the main dashboard before using the Flow Builder.</AlertDescription></Alert>
    }

    return (
        <>
            <TestFlowDialog
                open={isTestFlowOpen}
                onOpenChange={setIsTestFlowOpen}
                nodes={nodes}
                edges={edges}
            />
            <div className="flex flex-col h-full gap-4">
                <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4">
                    <div>
                         <Input 
                            id="flow-name-input"
                            key={currentFlow?._id.toString() || 'new-flow'}
                            defaultValue={currentFlow?.name || 'New Flow'} 
                            className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-3xl font-bold font-headline"
                            disabled={!isClient}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex md:hidden items-center gap-2">
                            <Button variant="outline" onClick={() => setIsBlocksSheetOpen(true)}>
                                <PanelLeft className="mr-2 h-4 w-4"/>
                                Flows & Blocks
                            </Button>
                            <Button variant="outline" onClick={() => setIsPropsSheetOpen(true)} disabled={!selectedNode}>
                                <Settings2 className="mr-2 h-4 w-4"/>
                                Properties
                            </Button>
                        </div>
                        <Button asChild variant="outline">
                            <Link href="/dashboard/flow-builder/docs">
                                <BookOpen className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">View Docs</span>
                            </Link>
                        </Button>
                        <Button variant="outline" onClick={() => setIsTestFlowOpen(true)}>
                            <Play className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Test Flow</span>
                        </Button>
                        <Button variant="outline" onClick={handleCopyJson}>
                            <Copy className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Copy JSON</span>
                        </Button>
                        <Button onClick={handleSaveFlow} disabled={isSaving}>
                            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            <span className="hidden sm:inline">Save & Publish</span>
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
                    {/* DESKTOP Left Panel */}
                    <div className="hidden md:flex md:col-span-3 lg:col-span-2 flex-col gap-4">
                        <FlowsAndBlocksPanel {...{ isLoading, isDeleting, flows, currentFlow, handleSelectFlow, handleDeleteFlow, handleCreateNewFlow, addNode }} />
                    </div>

                    {/* MOBILE Left Panel Sheet */}
                    <Sheet open={isBlocksSheetOpen} onOpenChange={setIsBlocksSheetOpen}>
                        <SheetContent side="left" className="p-2 flex flex-col gap-4 w-full max-w-xs">
                            <SheetTitle className="sr-only">Flows and Blocks</SheetTitle>
                            <SheetDescription className="sr-only">A list of flows and draggable blocks to build your automation.</SheetDescription>
                             <FlowsAndBlocksPanel {...{ isLoading, isDeleting, flows, currentFlow, handleSelectFlow, handleDeleteFlow, handleCreateNewFlow, addNode }} />
                        </SheetContent>
                    </Sheet>

                    <div className="md:col-span-6 lg:col-span-7">
                        <Card
                            ref={viewportRef}
                            className="h-full w-full overflow-hidden relative cursor-grab active:cursor-grabbing"
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={handleCanvasMouseUp}
                            onWheel={handleWheel}
                            onClick={handleCanvasClick}
                        >
                            <div
                                className="absolute inset-0"
                                style={{
                                    backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.4) 1px, transparent 0)',
                                    backgroundSize: '20px 20px',
                                    backgroundPosition: `${pan.x}px ${pan.y}px`,
                                }}
                            />
                            <div 
                                className="relative w-full h-full"
                                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}
                            >
                                {isLoading ? (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : (
                                    <>
                                        {nodes.map(node => (
                                            <NodeComponent 
                                                key={node.id} 
                                                node={node}
                                                onSelectNode={setSelectedNodeId}
                                                isSelected={selectedNodeId === node.id}
                                                onNodeMouseDown={handleNodeMouseDown}
                                                onHandleClick={handleHandleClick}
                                            />
                                        ))}
                                        <svg 
                                            className="absolute top-0 left-0 pointer-events-none"
                                            style={{ width: '5000px', height: '5000px', transformOrigin: 'top left' }}
                                        >
                                            {edges.map(edge => {
                                                const sourceNode = nodes.find(n => n.id === edge.source);
                                                const targetNode = nodes.find(n => n.id === edge.target);
                                                if(!sourceNode || !targetNode) return null;
                                                
                                                const sourcePos = getNodeHandlePosition(sourceNode, edge.sourceHandle);
                                                const targetPos = getNodeHandlePosition(targetNode, edge.targetHandle);
                                                if (!sourcePos || !targetPos) return null;

                                                const path = getEdgePath(sourcePos, targetPos)
                                                return <path key={edge.id} d={path} stroke="hsl(var(--border))" strokeWidth="2" fill="none" />
                                            })}
                                            {connecting && (
                                                <ConnectionLine from={connecting.startPos} to={mousePosition} />
                                            )}
                                        </svg>
                                    </>
                                )}
                            </div>
                            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleZoom('out')}><ZoomOut className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" onClick={() => handleZoom('in')}><ZoomIn className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" onClick={handleResetView}><Frame className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" onClick={handleToggleFullScreen}>
                                    {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                </Button>
                            </div>
                        </Card>
                    </div>

                    {/* Right Panel */}
                    <div className="hidden md:block md:col-span-3">
                        <PropertiesPanel 
                            selectedNode={selectedNode}
                            updateNodeData={updateNodeData}
                            deleteNode={deleteNode}
                            templates={templates}
                            metaFlows={metaFlows}
                        />
                    </div>
                    {/* Right Panel Sheet for Mobile */}
                    <Sheet open={isPropsSheetOpen} onOpenChange={setIsPropsSheetOpen}>
                        <SheetContent side="right" className="p-0 flex flex-col w-full max-w-md">
                            <SheetTitle className="sr-only">Block Properties</SheetTitle>
                            <SheetDescription className="sr-only">Configure the selected block's properties.</SheetDescription>
                            <PropertiesPanel 
                                selectedNode={selectedNode}
                                updateNodeData={updateNodeData}
                                deleteNode={deleteNode}
                                templates={templates}
                                metaFlows={metaFlows}
                            />
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </>
    );
}
