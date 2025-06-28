

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
    ArrowRightLeft,
    ShoppingCart,
    View,
    Server,
    Variable,
    File,
    LoaderCircle,
    BookOpen,
    Languages,
    BrainCircuit,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFlowsForProject, saveFlow, deleteFlow, getFlowById } from '@/app/actions';
import type { Flow, FlowNode, FlowEdge } from '@/app/actions';
import type { WithId } from 'mongodb';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { TestFlowDialog } from '@/components/wabasimplify/test-flow-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type NodeType = 'start' | 'text' | 'buttons' | 'condition' | 'webhook' | 'image' | 'input' | 'delay' | 'api' | 'carousel' | 'addToCart' | 'language';

type ButtonConfig = {
    id: string;
    type: 'QUICK_REPLY';
    text: string;
};

const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Buttons', icon: ToggleRight },
    { type: 'language', label: 'AI Translate', icon: BrainCircuit },
    { type: 'carousel', label: 'Product Carousel', icon: View },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'api', label: 'Call API', icon: ArrowRightLeft },
    { type: 'addToCart', label: 'Add to Cart', icon: ShoppingCart },
];

const NodePreview = ({ node }: { node: FlowNode }) => {
    // Helper to render text with variable highlighting
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

const PropertiesPanel = ({ selectedNode, updateNodeData, deleteNode }: { selectedNode: FlowNode | null; updateNodeData: (id: string, data: Partial<any>) => void, deleteNode: (id: string) => void }) => {
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
                            <Label>Translation Mode</Label>
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
                         <div className="space-y-2">
                            <Label htmlFor="lang-text-translate">Text to Translate</Label>
                            <Textarea id="lang-text-translate" placeholder="Enter text or {{variable}}..." value={selectedNode.data.textToTranslate || ''} onChange={(e) => handleDataChange('textToTranslate', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="lang-save-var">Save Result to Variable</Label>
                            <Input id="lang-save-var" placeholder="e.g., translated_greeting" value={selectedNode.data.saveToVariable || ''} onChange={(e) => handleDataChange('saveToVariable', e.target.value)} />
                        </div>
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
    const dx = Math.abs(sourcePos.x - targetPos.x) * 0.5;
    return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + dx} ${sourcePos.y}, ${targetPos.x - dx} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
};

export default function FlowBuilderPage() {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [flows, setFlows] = useState<WithId<Flow>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<Flow> | null>(null);
    const [nodes, setNodes] = useState<FlowNode[]>([]);
    const [edges, setEdges] = useState<FlowEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoadingFlows, startFlowsLoadingTransition] = useTransition();
    const [isTestFlowOpen, setIsTestFlowOpen] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);

    const [draggingNode, setDraggingNode] = useState<{ id: string; offset: { x: number; y: number } } | null>(null);
    const [connecting, setConnecting] = useState<{ sourceNodeId: string; sourceHandleId: string; startPos: { x: number; y: number } } | null>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    useEffect(() => {
        setIsClient(true);
        document.title = 'Flow Builder | Wachat';
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    const loadFlows = useCallback(async () => {
        if (projectId) {
            startFlowsLoadingTransition(async () => {
                const fetchedFlows = await getFlowsForProject(projectId);
                setFlows(fetchedFlows);
                if (fetchedFlows.length > 0 && !currentFlow) {
                    handleSelectFlow(fetchedFlows[0]._id.toString());
                } else if (fetchedFlows.length === 0) {
                    handleCreateNewFlow();
                }
            });
        }
    }, [projectId, currentFlow]);

    useEffect(() => {
        loadFlows();
    }, [projectId]);

    const handleSelectFlow = useCallback(async (flowId: string) => {
        const fullFlow = await getFlowById(flowId);
        if (fullFlow) {
            setCurrentFlow(fullFlow);
            setNodes(fullFlow.nodes || []);
            setEdges(fullFlow.edges || []);
            setSelectedNodeId(null);
        }
    }, []);
    
    const handleCreateNewFlow = () => {
        const startNode = { id: 'node-start', type: 'start' as NodeType, data: { label: 'Start Flow' }, position: { x: 50, y: 150 } };
        setCurrentFlow(null);
        setNodes([startNode]);
        setEdges([]);
        setSelectedNodeId(startNode.id);
    };
    
    const handleDeleteFlow = async (flowId: string) => {
        const result = await deleteFlow(flowId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.message });
            loadFlows();
        }
    };

    const addNode = (type: NodeType) => {
        const newNode: FlowNode = {
            id: `node-${type}-${Date.now()}`,
            type,
            data: { 
                label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                apiRequest: { method: 'GET', url: '', headers: '', body: '', responseMappings: [] },
                mode: 'automatic', // Default for language node
            },
            position: { x: Math.random() * 400 + 200, y: Math.random() * 200 + 50 },
        };
        setNodes(prev => [...prev, newNode]);
        setSelectedNodeId(newNode.id);
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
                    const newFlow = await getFlowById(result.flowId);
                    if(newFlow) setCurrentFlow(newFlow);
                }
                loadFlows();
            }
        });
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (node && canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const offsetX = e.clientX - canvasRect.left - node.position.x;
            const offsetY = e.clientY - canvasRect.top - node.position.y;
            setDraggingNode({ id: nodeId, offset: { x: offsetX, y: offsetY } });
        }
    };
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const currentMousePos = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
            setMousePosition(currentMousePos);

            if (draggingNode) {
                e.preventDefault();
                e.stopPropagation();
                const newX = currentMousePos.x - draggingNode.offset.x;
                const newY = currentMousePos.y - draggingNode.offset.y;
                setNodes(prevNodes => prevNodes.map(n => 
                    n.id === draggingNode.id ? { ...n, position: { x: newX, y: newY } } : n
                ));
            }
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        setDraggingNode(null);
    };

    const handleCanvasClick = () => {
        if (connecting) {
            setConnecting(null);
        } else {
            setSelectedNodeId(null);
        }
    }

    const handleHandleClick = (e: React.MouseEvent, nodeId: string, handleId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!canvasRef.current) return;
        
        const isOutputHandle = handleId.includes('output') || handleId.includes('-btn-');

        if (isOutputHandle) {
            const handleElement = document.getElementById(handleId);
            if(handleElement){
                const handleRect = handleElement.getBoundingClientRect();
                const canvasRect = canvasRef.current.getBoundingClientRect();
                const startPos = {
                    x: handleRect.left - canvasRect.left + handleRect.width / 2,
                    y: handleRect.top - canvasRect.top + handleRect.height / 2,
                };
                setConnecting({ sourceNodeId: nodeId, sourceHandleId: handleId, startPos });
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
            <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
                <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4">
                    <div>
                         <Input 
                            id="flow-name-input"
                            defaultValue={currentFlow?.name || 'New Flow'} 
                            className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-3xl font-bold font-headline"
                            disabled={!isClient}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button asChild variant="outline">
                            <Link href="/dashboard/flow-builder/docs">
                                <BookOpen className="mr-2 h-4 w-4" />
                                View Docs
                            </Link>
                        </Button>
                        <Button variant="outline" onClick={() => setIsTestFlowOpen(true)}>
                            <Play className="mr-2 h-4 w-4" />
                            Test Flow
                        </Button>
                        <Button onClick={handleSaveFlow} disabled={isSaving}>
                            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Save & Publish
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
                    <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-4">
                        <Card>
                            <CardHeader className="flex-row items-center justify-between p-3">
                                <CardTitle className="text-base">Flows</CardTitle>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCreateNewFlow}><Plus/></Button>
                            </CardHeader>
                            <CardContent className="p-2 pt-0">
                                <ScrollArea className="h-32">
                                    {isLoadingFlows ? <Skeleton className="h-full w-full"/> : 
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
                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteFlow(flow._id.toString())}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        ))
                                    }
                                </ScrollArea>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-3"><CardTitle className="text-base">Blocks</CardTitle></CardHeader>
                            <CardContent className="space-y-2 p-2 pt-0">
                                {blockTypes.map(({ type, label, icon: Icon }) => (
                                    <Button key={type} variant="outline" className="w-full justify-start" onClick={() => addNode(type as NodeType)}>
                                        <Icon className="mr-2 h-4 w-4" />
                                        {label}
                                    </Button>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                    <div className="md:col-span-6 lg:col-span-7">
                        <Card className="h-full">
                            <ScrollArea className="h-full">
                                <div 
                                    ref={canvasRef}
                                    className="relative h-[80vh] w-full overflow-hidden"
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onClick={handleCanvasClick}
                                >
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
                                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                                        {edges.map(edge => {
                                            const sourceNode = nodes.find(n => n.id === edge.source);
                                            const targetNode = nodes.find(n => n.id === edge.target);
                                            if(!sourceNode || !targetNode) return null;
                                            
                                            const sourcePos = getNodeHandlePosition(sourceNode, edge.sourceHandle);
                                            const targetPos = getNodeHandlePosition(targetNode, edge.targetHandle);
                                            if (!sourcePos || !targetPos) return null;

                                            return <path key={edge.id} d={getEdgePath(sourcePos, targetPos)} stroke="hsl(var(--border))" strokeWidth="2" fill="none" />
                                        })}
                                        {connecting && (
                                            <ConnectionLine from={connecting.startPos} to={mousePosition} />
                                        )}
                                    </svg>
                                </div>
                            </ScrollArea>
                        </Card>
                    </div>
                    <div className="md:col-span-3 lg:col-span-3">
                        <PropertiesPanel 
                            selectedNode={selectedNode}
                            updateNodeData={updateNodeData}
                            deleteNode={deleteNode}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
