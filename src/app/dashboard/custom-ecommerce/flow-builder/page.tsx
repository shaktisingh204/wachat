'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
import type { EcommFlow, EcommFlowNode, EcommFlowEdge } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type NodeType = 'start' | 'text' | 'buttons' | 'input' | 'image' | 'delay' | 'condition' | 'carousel' | 'addToCart';

type ButtonConfig = {
    id: string;
    text: string;
};

type CarouselElementButton = {
  type: 'web_url' | 'postback';
  title: string;
  url?: string;
  payload?: string;
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
    { type: 'addToCart', label: 'Add to Cart', icon: ShoppingCart },
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

    const handleElementButtonChange = (elementId: string, buttonIndex: number, field: keyof CarouselElementButton, value: string) => {
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
                                                     <Input placeholder="https://example.com" value={btn.url || ''} onChange={e => handleElementButtonChange(el.id, btnIndex, 'url', e.target.value)} required/>
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
    flows: WithId<EcommFlow>[];
    currentFlow: WithId<EcommFlow> | null;
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
                                    className={cn("w-full justify-start font-normal", currentFlow?._id.toString() === flow._id.toString() && "bg-muted font-semibold")}
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

const NODE_WIDTH = 256;
const NODE_HEIGHT = 100;

const getEdgePath = (sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
    if (!sourcePos || !targetPos) return '';
    const dx = Math.abs(sourcePos.x - targetPos.x) * 0.5;
    const path = `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + dx} ${sourcePos.y}, ${targetPos.x - dx} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
    return path;
};

const getNodeHandlePosition = (node: EcommFlowNode, handleId: string) => {
    if (!node || !handleId) return null;

    const x = node.position.x;
    const y = node.position.y;
    
    // Consistent height for simple nodes
    let nodeHeight = 60; 
    
    if (node.type === 'condition') nodeHeight = 80;
    if (node.type === 'buttons') {
        const buttonCount = (node.data.buttons || []).length;
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
        const totalButtons = (node.data.buttons || []).length;
        const topPosition = totalButtons > 1 ? (60 + (nodeHeight - 60) / (totalButtons + 1) * (buttonIndex + 1)) : 60 + (nodeHeight - 60) / 2;
        return { x: x + NODE_WIDTH, y: y + topPosition };
    }
    
    // Fallback for generic output handles from older data structures
    if (handleId.includes('output')) {
        return { x: x + NODE_WIDTH, y: y + 30 };
    }
    
    return null;
}

export default function EcommFlowBuilderPage() {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [flows, setFlows] = useState<WithId<EcommFlow>[]>([]);
    const [currentFlow, setCurrentFlow] = useState<WithId<EcommFlow> | null>(null);
    const [nodes, setNodes] = useState<EcommFlowNode[]>([]);
    const [edges, setEdges] = useState<EcommFlowEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSaving, startSaveTransition] = useTransition();
    const [isLoading, startLoadingTransition] = useTransition();
    
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
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    const fetchFlows = useCallback(() => {
        if(projectId) {
            startLoadingTransition(async () => {
                const flowsData = await getEcommFlows(projectId);
                setFlows(flowsData);
                if (flowsData.length > 0 && !currentFlow) {
                    handleSelectFlow(flowsData[0]._id.toString());
                } else if (flowsData.length === 0) {
                    handleCreateNewFlow();
                }
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, currentFlow]);

    useEffect(() => {
        if(isClient && projectId) {
            fetchFlows();
        }
    }, [isClient, projectId, fetchFlows]);
    
    const handleSelectFlow = async (flowId: string) => {
        const flow = await getEcommFlowById(flowId);
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

        const newNode: EcommFlowNode = {
            id: `${type}-${Date.now()}`,
            type,
            data: { label: `New ${type}` },
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
        if (selectedNodeId === id) setSelectedNodeId(null);
        setIsPropsSheetOpen(false);
    };

    const handleSaveFlow = async () => {
        const flowName = (document.getElementById('flow-name-input') as HTMLInputElement)?.value;
        if (!projectId || !flowName) return;
        const startNode = nodes.find(n => n.type === 'start');
        const triggerKeywords = startNode?.data.triggerKeywords?.split(',').map((k:string) => k.trim()).filter(Boolean) || [];
        const isWelcomeFlow = startNode?.data.isWelcomeFlow || false;

        startSaveTransition(async () => {
             const result = await saveEcommFlow({
                flowId: currentFlow?._id.toString(),
                projectId,
                name: flowName,
                nodes,
                edges,
                triggerKeywords,
                isWelcomeFlow,
            });
            if(result.error) toast({title: "Error", description: result.error, variant: 'destructive'});
            else {
                toast({title: "Success", description: result.message});
                if(result.flowId) {
                    await handleSelectFlow(result.flowId);
                }
                fetchFlows();
            }
        });
    }

    const handleDeleteFlow = async (flowId: string) => {
        const result = await deleteEcommFlow(flowId);
        if(result.error) toast({title: "Error", description: result.error, variant: 'destructive'});
        else {
            toast({title: "Success", description: result.message});
            fetchFlows();
            if(currentFlow?._id.toString() === flowId) {
                handleCreateNewFlow();
            }
        }
    }
    
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

            const newEdge: EcommFlowEdge = {
                id: `edge-${connecting.sourceNodeId}-${nodeId}-${connecting.sourceHandleId}-${handleId}`,
                source: connecting.sourceNodeId,
                target: nodeId,
                sourceHandle: connecting.sourceHandleId,
                targetHandle: handleId
            };
            
            const edgesWithoutExistingTarget = edges.filter(edge => !(edge.target === nodeId && edge.targetHandle === handleId));
            
            const sourceHasSingleOutput = !connecting.sourceHandleId.includes('btn-') && !connecting.sourceHandleId.includes('output-yes') && !connecting.sourceHandleId.includes('output-no');
            if (sourceHasSingleOutput) {
                const edgesWithoutExistingSource = edgesWithoutExistingTarget.filter(e => e.source !== connecting.sourceNodeId);
                setEdges([...edgesWithoutExistingSource, newEdge]);
            } else {
                setEdges([...edgesWithoutExistingTarget, newEdge]);
            }
            
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

    const handleZoomControls = (direction: 'in' | 'out' | 'reset') => {
        if(direction === 'reset') {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            return;
        }
        setZoom(prevZoom => {
            const newZoom = direction === 'in' ? prevZoom * 1.2 : prevZoom / 1.2;
            return Math.max(0.2, Math.min(2, newZoom));
        });
    };

    const handleToggleFullScreen = () => {
        if (!document.fullscreenElement) {
            viewportRef.current?.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen?.();
        }
    };

    useEffect(() => {
        const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    if (!isClient) {
        return <Skeleton className="h-full w-full"/>
    }
    
    if (!projectId) {
         return (
             <div className="flex flex-col gap-8">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project from the main dashboard to use the Flow Builder.</AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Input 
                        id="flow-name-input"
                        key={currentFlow?._id.toString() || 'new-flow'}
                        defaultValue={currentFlow?.name || 'New Flow'} 
                        className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-3xl font-bold font-headline"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex md:hidden items-center gap-2">
                        <Button variant="outline" onClick={() => setIsBlocksSheetOpen(true)}><PanelLeft className="mr-2 h-4 w-4"/>Flows & Blocks</Button>
                        {selectedNode && <Button variant="outline" onClick={() => setIsPropsSheetOpen(true)} disabled={!selectedNode}><Settings2 className="mr-2 h-4 w-4"/>Properties</Button>}
                    </div>
                     <Button asChild variant="outline">
                        <Link href="/dashboard/custom-ecommerce/flow-builder/docs">
                            <BookOpen className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">View Docs</span>
                        </Link>
                    </Button>
                    <Button onClick={handleSaveFlow} disabled={isSaving}>
                        {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        <span className="hidden sm:inline">Save Flow</span>
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
                <div className="hidden md:flex md:col-span-3 lg:col-span-2 flex-col gap-4">
                    <FlowsAndBlocksPanel {...{ isLoading, flows, currentFlow, handleSelectFlow, handleDeleteFlow, handleCreateNewFlow, addNode }} />
                </div>
                <Sheet open={isBlocksSheetOpen} onOpenChange={setIsBlocksSheetOpen}>
                    <SheetContent side="left" className="p-2 flex flex-col gap-4 w-full max-w-xs">
                        <SheetTitle className="sr-only">Flows and Blocks</SheetTitle>
                        <SheetDescription className="sr-only">A list of flows and draggable blocks.</SheetDescription>
                        <FlowsAndBlocksPanel {...{ isLoading, flows, currentFlow, handleSelectFlow, handleDeleteFlow, handleCreateNewFlow, addNode }} />
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
                            {isLoading && !currentFlow ? (
                                <div className="absolute inset-0 flex items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div>
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
                                    <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '5000px', height: '5000px', transformOrigin: 'top left' }}>
                                        {edges.map(edge => {
                                            const sourceNode = nodes.find(n => n.id === edge.source);
                                            const targetNode = nodes.find(n => n.id === edge.target);
                                            if(!sourceNode || !targetNode) return null;
                                            
                                            const sourcePos = getNodeHandlePosition(sourceNode, edge.sourceHandle || `${edge.source}-output-main`);
                                            const targetPos = getNodeHandlePosition(targetNode, edge.targetHandle || `${edge.target}-input`);
                                            if (!sourcePos || !targetPos) return null;

                                            return <path key={edge.id} d={getEdgePath(sourcePos, targetPos)} stroke="hsl(var(--border))" strokeWidth="2" fill="none" />
                                        })}
                                        {connecting && (
                                            <path d={getEdgePath(connecting.startPos, mousePosition)} stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeDasharray="5,5" />
                                        )}
                                    </svg>
                                </>
                            )}
                        </div>
                        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('out')}><ZoomOut className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('in')}><ZoomIn className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('reset')}><Frame className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={handleToggleFullScreen}>
                                {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                            </Button>
                        </div>
                    </Card>
                </div>
                <div className="hidden md:block md:col-span-3">
                    {selectedNode && <PropertiesPanel selectedNode={selectedNode} updateNodeData={updateNodeData} deleteNode={deleteNode} />}
                </div>
                <Sheet open={isPropsSheetOpen} onOpenChange={setIsPropsSheetOpen}>
                    <SheetContent side="right" className="p-0 flex flex-col w-full max-w-md">
                        <SheetTitle className="sr-only">Block Properties</SheetTitle>
                        <SheetDescription className="sr-only">Configure the selected block's properties.</SheetDescription>
                        {selectedNode && <PropertiesPanel selectedNode={selectedNode} updateNodeData={updateNodeData} deleteNode={deleteNode} />}
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
