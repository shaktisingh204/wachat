
'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { useParams } from 'next/navigation';
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
    Play,
    Trash2,
    Save,
    Plus,
    Type,
    LoaderCircle,
    BookOpen,
    PanelLeft,
    Settings2,
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
    ArrowRightLeft
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  getEcommFlows,
  getEcommFlowById,
  saveEcommFlow,
  deleteEcommFlow,
} from '@/app/actions/custom-ecommerce-flow.actions';
import { getEcommShopById } from '@/app/actions/custom-ecommerce.actions';
import type { EcommFlow, EcommFlowNode, EcommFlowEdge, EcommShop } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type NodeType = 'start' | 'text' | 'buttons' | 'input' | 'image' | 'delay' | 'condition' | 'carousel' | 'addToCart' | 'orderConfirmation' | 'api';

type ButtonConfig = {
    id: string;
    text: string;
};

type CarouselElementButton = {
  type: 'web_url' | 'postback';
  title: string;
  url?: string;
  payload?: string;
  webview_height_ratio?: 'compact' | 'tall' | 'full';
  messenger_extensions?: boolean;
};


type CarouselElement = {
    id: string;
    title: string;
    subtitle?: string;
    image_url?: string;
    buttons?: CarouselElementButton[];
};


const blockTypes = [
    { type: 'text', label: 'Send Message', icon: MessageSquare },
    { type: 'image', label: 'Send Image', icon: ImageIcon },
    { type: 'buttons', label: 'Add Quick Replies', icon: ToggleRight },
    { type: 'carousel', label: 'Product Carousel', icon: View },
    { type: 'input', label: 'Get User Input', icon: Type },
    { type: 'delay', label: 'Add Delay', icon: Clock },
    { type: 'condition', label: 'Add Condition', icon: GitFork },
    { type: 'api', label: 'Call API', icon: ArrowRightLeft },
    { type: 'addToCart', label: 'Add to Cart', icon: ShoppingCart },
    { type: 'orderConfirmation', label: 'Order Confirmation', icon: PackageCheck },
];

const NodePreview = ({ node }: { node: EcommFlowNode }) => {
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
            case 'orderConfirmation':
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
            case 'carousel':
                 const elementCount = node.data.elements?.length || 0;
                return <p className="text-xs text-muted-foreground italic">Sends a carousel with {elementCount} card(s).</p>;
            case 'addToCart':
                return <p className="text-xs text-muted-foreground italic">Adds "{node.data.productName || 'product'}" to cart.</p>;
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
    node: EcommFlowNode; 
    onSelectNode: (id: string) => void; 
    isSelected: boolean;
    onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    onHandleClick: (e: React.MouseEvent, nodeId: string, handleId: string) => void;
}) => {
    const BlockIcon = [...blockTypes, {type: 'start', label: 'Start', icon: Play}].find(b => b.type === node.type)?.icon || MessageSquare;

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
                <NodePreview node={node} />
                 {node.type === 'condition' && (
                    <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center"><span>Yes</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between items-center"><span>No</span></div>
                    </CardContent>
                )}
            </Card>

            {node.type !== 'start' && <Handle position="left" id={`${node.id}-input`} style={{top: '50%', transform: 'translateY(-50%)'}} />}
            
            {node.type === 'condition' ? (
                <>
                    <Handle position="right" id={`${node.id}-output-yes`} style={{ top: '33.33%', transform: 'translateY(-50%)' }} />
                    <Handle position="right" id={`${node.id}-output-no`} style={{ top: '66.67%', transform: 'translateY(-50%)' }} />
                </>
            ) : node.type === 'buttons' ? (
                (node.data.buttons || []).map((btn: ButtonConfig, index: number) => {
                    const totalButtons = (node.data.buttons || []).length;
                    const topPosition = totalButtons > 1 ? `${(100 / (totalButtons + 1)) * (index + 1)}%` : '50%';
                    return <Handle key={btn.id || index} position="right" id={`${node.id}-btn-${index}`} style={{ top: topPosition, transform: 'translateY(-50%)' }} />;
                })
            ) : (
                 <Handle position="right" id={`${node.id}-output-main`} style={{top: '50%', transform: 'translateY(-50%)'}} />
            )}
        </div>
    );
};

const PropertiesPanel = ({ selectedNode, updateNodeData, deleteNode }: { selectedNode: EcommFlowNode | null; updateNodeData: (id: string, data: Partial<any>) => void, deleteNode: (id: string) => void }) => {
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
        if (currentButtons.length >= 13) {
            toast({ title: "Limit Reached", description: "You can add a maximum of 13 Quick Replies.", variant: "destructive" });
            return;
        }
        const newButtons: ButtonConfig[] = [...currentButtons, { id: `btn-${Date.now()}`, text: '' }];
        handleDataChange('buttons', newButtons);
    };

    const removeFlowButton = (index: number) => {
        const newButtons = (selectedNode.data.buttons || []).filter((_: any, i: number) => i !== index);
        handleDataChange('buttons', newButtons);
    };

    const handleElementChange = (elementId: string, field: keyof CarouselElement, value: string) => {
        const newElements = (selectedNode.data.elements || []).map((el: CarouselElement) => 
            el.id === elementId ? { ...el, [field]: value } : el
        );
        handleDataChange('elements', newElements);
    };

    const handleElementButtonChange = (elementId: string, buttonIndex: number, field: keyof CarouselElementButton, value: any) => {
        const newElements = (selectedNode.data.elements || []).map((el: CarouselElement) => {
            if (el.id === elementId) {
                const newButtons = [...(el.buttons || [])];
                newButtons[buttonIndex] = { ...newButtons[buttonIndex], [field]: value };
                return { ...el, buttons: newButtons };
            }
            return el;
        });
        handleDataChange('elements', newElements);
    };
    
    const addElement = () => {
        const currentElements = selectedNode.data.elements || [];
        if (currentElements.length >= 10) {
            toast({ title: "Limit Reached", description: "A carousel can have a maximum of 10 cards.", variant: "destructive" });
            return;
        }
        const newElements = [...currentElements, { id: `el-${Date.now()}`, title: 'New Card', buttons: [] }];
        handleDataChange('elements', newElements);
    };
    
    const removeElement = (elementId: string) => {
        const newElements = (selectedNode.data.elements || []).filter((el: CarouselElement) => el.id !== elementId);
        handleDataChange('elements', newElements);
    };

    const addElementButton = (elementId: string, type: 'web_url' | 'postback') => {
        const newElements = (selectedNode.data.elements || []).map((el: CarouselElement) => {
            if (el.id === elementId) {
                const currentButtons = el.buttons || [];
                if (currentButtons.length >= 3) {
                    toast({ title: "Limit Reached", description: "A card can have a maximum of 3 buttons.", variant: "destructive" });
                    return el;
                }
                const newButtons = [...currentButtons, { type, title: 'New Button' }];
                return { ...el, buttons: newButtons };
            }
            return el;
        });
        handleDataChange('elements', newElements);
    };

    const removeElementButton = (elementId: string, buttonIndex: number) => {
         const newElements = (selectedNode.data.elements || []).map((el: CarouselElement) => {
            if (el.id === elementId) {
                const newButtons = (el.buttons || []).filter((_, i) => i !== buttonIndex);
                return { ...el, buttons: newButtons };
            }
            return el;
        });
        handleDataChange('elements', newElements);
    }
    
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
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="triggerKeywords">Trigger Keywords</Label>
                            <Input 
                                id="triggerKeywords"
                                placeholder="e.g., help, menu" 
                                value={selectedNode.data.triggerKeywords || ''} 
                                onChange={(e) => handleDataChange('triggerKeywords', e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Comma-separated keywords to start this flow.</p>
                        </div>
                        <div className="flex items-center space-x-2 rounded-lg border p-4">
                            <Switch id="isWelcomeFlow" name="isWelcomeFlow" checked={selectedNode.data.isWelcomeFlow} onCheckedChange={(checked) => handleDataChange('isWelcomeFlow', checked)} />
                            <Label htmlFor="isWelcomeFlow">Set as Welcome Flow</Label>
                        </div>
                         <p className="text-xs text-muted-foreground">If enabled, this flow will automatically trigger for new users.</p>
                    </div>
                );
            case 'text':
                return <Textarea id="text-content" placeholder="Enter your message here..." value={selectedNode.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} className="h-32" />;
            case 'orderConfirmation':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="confirmation-text">Confirmation Message</Label>
                        <Textarea id="confirmation-text" placeholder="Thank you for your order, {{name}}!" defaultValue={selectedNode.data.text || 'Thank you for your order, {{name}}! Your order ID is #{{order_id}}.'} onChange={(e) => handleDataChange('text', e.target.value)} className="h-32" />
                        <p className="text-xs text-muted-foreground">Use variables like `{{order_id}}` which you should get from a preceding API call block.</p>
                    </div>
                );
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
                        <div className="space-y-2">
                            <Label>Quick Replies</Label>
                            <div className="space-y-3">
                                {(selectedNode.data.buttons || []).map((btn: ButtonConfig, index: number) => (
                                    <div key={btn.id || index} className="flex items-center gap-2">
                                        <Input 
                                            placeholder="Button Text" 
                                            value={btn.text} 
                                            onChange={(e) => handleButtonChange(index, 'text', e.target.value)} 
                                            maxLength={20}
                                        />
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFlowButton(index)}><Trash2 className="h-3 w-3"/></Button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addFlowButton}><Plus className="mr-2 h-4 w-4"/>Add Quick Reply</Button>
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
                             <p className="text-xs text-muted-foreground">Use {'{{user_name}}'} in later steps.</p>
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
             case 'condition':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Condition Type</Label>
                            <RadioGroup value={selectedNode.data.conditionType || 'variable'} onValueChange={(val) => handleDataChange('conditionType', val)} className="flex gap-4 pt-1">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="variable" id="type-variable" /><Label htmlFor="type-variable" className="font-normal">Variable</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="user_response" id="type-user-response" /><Label htmlFor="type-user-response" className="font-normal">User Response</Label></div>
                            </RadioGroup>
                            <p className="text-xs text-muted-foreground">"User Response" will pause the flow and wait for the user's next message.</p>
                        </div>

                        {(selectedNode.data.conditionType === 'variable' || !selectedNode.data.conditionType) && (
                            <div className="space-y-2"><Label htmlFor="condition-variable">Variable to Check</Label><Input id="condition-variable" placeholder="e.g., {{user_name}}" value={selectedNode.data.variable || ''} onChange={(e) => handleDataChange('variable', e.target.value)} /></div>
                        )}

                        <div className="space-y-2"><Label htmlFor="condition-operator">Operator</Label><Select value={selectedNode.data.operator || 'equals'} onValueChange={(val) => handleDataChange('operator', val)}><SelectTrigger id="condition-operator"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="equals">Equals</SelectItem><SelectItem value="not_equals">Does not equal</SelectItem><SelectItem value="contains">Contains</SelectItem><SelectItem value="is_one_of">Is one of (comma-sep)</SelectItem><SelectItem value="is_not_one_of">Is not one of (comma-sep)</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label htmlFor="condition-value">Value to Compare Against</Label><Input id="condition-value" placeholder="e.g., confirmed" value={selectedNode.data.value || ''} onChange={(e) => handleDataChange('value', e.target.value)} /></div>
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
                const elements = selectedNode.data.elements || [];
                return (
                    <div className="space-y-4">
                        <Label>Carousel Cards ({elements.length}/10)</Label>
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                            {elements.map((el: CarouselElement, elIndex: number) => (
                                <div key={el.id} className="p-3 border rounded-lg space-y-3 bg-muted/50 relative">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeElement(el.id)}><Trash2 className="h-4 w-4"/></Button>
                                    <h4 className="font-medium text-sm">Card {elIndex + 1}</h4>
                                    <Input placeholder="Image URL" value={el.image_url || ''} onChange={e => handleElementChange(el.id, 'image_url', e.target.value)} />
                                    <Input placeholder="Title (80 chars max)" value={el.title} onChange={e => handleElementChange(el.id, 'title', e.target.value)} maxLength={80} required/>
                                    <Input placeholder="Subtitle (80 chars max)" value={el.subtitle || ''} onChange={e => handleElementChange(el.id, 'subtitle', e.target.value)} maxLength={80}/>
                                    <div className="space-y-2">
                                        {(el.buttons || []).map((btn, btnIndex) => (
                                            <div key={btnIndex} className="p-2 border bg-background rounded-md space-y-2 relative">
                                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeElementButton(el.id, btnIndex)}><Trash2 className="h-3 w-3"/></Button>
                                                <RadioGroup value={btn.type} onValueChange={(val) => handleElementButtonChange(el.id, btnIndex, 'type', val)} className="flex gap-4">
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="web_url" id={`btn-type-url-${el.id}-${btnIndex}`} /><Label htmlFor={`btn-type-url-${el.id}-${btnIndex}`} className="font-normal">URL</Label></div>
                                                    <div className="flex items-center space-x-2"><RadioGroupItem value="postback" id={`btn-type-postback-${el.id}-${btnIndex}`} /><Label htmlFor={`btn-type-postback-${el.id}-${btnIndex}`} className="font-normal">Postback</Label></div>
                                                </RadioGroup>
                                                <Input placeholder="Button Title (20 chars max)" value={btn.title} onChange={e => handleElementButtonChange(el.id, btnIndex, 'title', e.target.value)} maxLength={20} required/>
                                                {btn.type === 'web_url' ? (
                                                     <>
                                                        <Input placeholder="https://example.com/cart?user_id={{psid}}" value={btn.url || ''} onChange={e => handleElementButtonChange(el.id, btnIndex, 'url', e.target.value)} required/>
                                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                                            <div className="space-y-1">
                                                                <Label htmlFor={`webview-height-${el.id}-${btnIndex}`} className="text-xs">Webview Height</Label>
                                                                <Select value={btn.webview_height_ratio || 'full'} onValueChange={val => handleElementButtonChange(el.id, btnIndex, 'webview_height_ratio', val)}>
                                                                    <SelectTrigger id={`webview-height-${el.id}-${btnIndex}`} className="h-8"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="full">Full</SelectItem>
                                                                        <SelectItem value="tall">Tall</SelectItem>
                                                                        <SelectItem value="compact">Compact</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1 pt-1 flex flex-col items-center">
                                                                 <Label htmlFor={`messenger-ext-${el.id}-${btnIndex}`} className="text-xs">Extensions</Label>
                                                                <Switch id={`messenger-ext-${el.id}-${btnIndex}`} checked={btn.messenger_extensions || false} onCheckedChange={checked => handleElementButtonChange(el.id, btnIndex, 'messenger_extensions', checked)} />
                                                            </div>
                                                        </div>
                                                     </>
                                                ) : (
                                                     <Input placeholder="Payload_for_webhook" value={btn.payload || ''} onChange={e => handleElementButtonChange(el.id, btnIndex, 'payload', e.target.value)} required/>
                                                )}
                                            </div>
                                        ))}
                                        {(el.buttons?.length || 0) < 3 && (
                                            <div className="flex gap-2">
                                                <Button type="button" variant="outline" size="sm" onClick={() => addElementButton(el.id, 'web_url')}>+ URL Button</Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => addElementButton(el.id, 'postback')}>+ Postback Button</Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="outline" className="w-full" onClick={addElement}><Plus className="mr-2 h-4 w-4"/>Add Card</Button>
                    </div>
                );
            case 'addToCart':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="productId">Product ID / SKU</Label>
                            <Input id="productId" value={selectedNode.data.productId || ''} onChange={e => handleDataChange('productId', e.target.value)} placeholder="e.g., TSHIRT-001 or {{selected_sku}}"/>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="productName">Product Name</Label>
                            <Input id="productName" value={selectedNode.data.productName || ''} onChange={e => handleDataChange('productName', e.target.value)} placeholder="e.g., Cool T-Shirt or {{product_name}}"/>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="quantity">Quantity</Label>
                                <Input id="quantity" type="number" value={selectedNode.data.quantity || 1} onChange={e => handleDataChange('quantity', parseInt(e.target.value, 10) || 1)} placeholder="1"/>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="price">Price</Label>
                                <Input id="price" type="number" value={selectedNode.data.price || ''} onChange={e => handleDataChange('price', parseFloat(e.target.value) || 0)} placeholder="e.g., 25.00 or {{product_price}}"/>
                            </div>
                        </div>
                    </div>
                );
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
