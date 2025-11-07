
'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { WithId } from 'mongodb';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface PropertiesPanelProps {
    node: any;
    onUpdate: (data: any) => void;
    deleteNode: (id: string) => void;
}

export function PropertiesPanel({ node, onUpdate, deleteNode }: PropertiesPanelProps) {
    if (!node) return <div className="p-4 text-center text-sm text-muted-foreground">Select a block to see its properties.</div>;
    
    const handleDataChange = (field: keyof any, value: any) => {
        onUpdate({ ...node.data, [field]: value });
    };

    const handleApiChange = (field: keyof any, value: any) => {
        const currentApiRequest = node.data.apiRequest || {};
        const newApiRequest = { ...currentApiRequest, [field]: value };
        handleDataChange('apiRequest', newApiRequest);
    };

    const handleMappingChange = (index: number, field: 'variable' | 'path', value: string) => {
        const mappings = [...(node.data.apiRequest?.responseMappings || [])];
        mappings[index] = { ...mappings[index], [field]: value };
        handleApiChange('responseMappings', mappings);
    };

    const addMapping = () => {
        const mappings = [...(node.data.apiRequest?.responseMappings || []), { variable: '', path: '' }];
        handleApiChange('responseMappings', mappings);
    };

    const removeMapping = (index: number) => {
        const mappings = (node.data.apiRequest?.responseMappings || []).filter((_: any, i: number) => i !== index);
        handleApiChange('responseMappings', mappings);
    };


    const renderProperties = () => {
        switch (node.type) {
            case 'start':
                return (
                    <div className="space-y-2">
                        <Label htmlFor="triggerKeywords">Trigger Keywords</Label>
                        <Input 
                            id="triggerKeywords"
                            placeholder="e.g., help, menu" 
                            value={node.data.triggerKeywords || ''} 
                            onChange={(e) => handleDataChange('triggerKeywords', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Comma-separated keywords to start this flow.</p>
                    </div>
                );
            case 'text':
                return <Textarea id="text-content" placeholder="Enter your message here..." value={node.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} className="h-32" />;
             case 'image':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="image-url">Image URL</Label>
                            <Input id="image-url" placeholder="https://example.com/image.png" value={node.data.imageUrl || ''} onChange={(e) => handleDataChange('imageUrl', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="image-caption">Caption (Optional)</Label>
                            <Textarea id="image-caption" placeholder="A caption for your image..." value={node.data.caption || ''} onChange={(e) => handleDataChange('caption', e.target.value)} />
                        </div>
                    </div>
                );
            case 'buttons':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="buttons-text">Message Text</Label>
                            <Textarea id="buttons-text" placeholder="Choose an option:" value={node.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Buttons</Label>
                             <p className="text-xs text-muted-foreground">Add up to 3 quick reply buttons.</p>
                            <div className="space-y-3">
                                {(node.data.buttons || []).map((btn: any, index: number) => (
                                    <div key={btn.id || index} className="flex items-center gap-2">
                                        <Input placeholder="Button Text" value={btn.text} onChange={(e) => {
                                            const newButtons = [...node.data.buttons];
                                            newButtons[index] = {...newButtons[index], text: e.target.value};
                                            handleDataChange('buttons', newButtons);
                                        }} maxLength={20} />
                                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                            const newButtons = node.data.buttons.filter((_: any, i: number) => i !== index);
                                            handleDataChange('buttons', newButtons);
                                        }}><Trash2 className="h-3 w-3"/></Button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => {
                                const currentButtons = node.data.buttons || [];
                                if(currentButtons.length < 3) handleDataChange('buttons', [...currentButtons, {id: `btn-${Date.now()}`, text: '', type: 'QUICK_REPLY'}]);
                            }}><Plus className="mr-2 h-4 w-4"/>Add Button</Button>
                        </div>
                    </div>
                );
            case 'input':
                 return (
                    <div className="space-y-4">
                        <div className="space-y-2"><Label htmlFor="input-text">Question to Ask</Label><Textarea id="input-text" placeholder="e.g., What is your name?" value={node.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} /></div>
                         <div className="space-y-2"><Label htmlFor="input-variable">Save Answer to Variable</Label><Input id="input-variable" placeholder="e.g., user_name" value={node.data.variableToSave || ''} onChange={(e) => handleDataChange('variableToSave', e.target.value)} /><p className="text-xs text-muted-foreground">Use {'{{user_name}}'} in later steps.</p></div>
                    </div>
                 );
            case 'delay':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2"><Label htmlFor="delay-seconds">Delay (seconds)</Label><Input id="delay-seconds" type="number" min="1" value={node.data.delaySeconds || 1} onChange={(e) => handleDataChange('delaySeconds', parseFloat(e.target.value))} /></div>
                    </div>
                );
            case 'condition':
                return (
                    <div className="space-y-4">
                        <div className="space-y-2"><Label>Condition Type</Label><RadioGroup value={node.data.conditionType || 'variable'} onValueChange={(val) => handleDataChange('conditionType', val)} className="flex gap-4 pt-1"><div className="flex items-center space-x-2"><RadioGroupItem value="variable" id="type-variable" /><Label htmlFor="type-variable" className="font-normal">Variable</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="user_response" id="type-user-response" /><Label htmlFor="type-user-response" className="font-normal">User Response</Label></div></RadioGroup><p className="text-xs text-muted-foreground">"User Response" will pause the flow and wait for the user's next message.</p></div>
                        {(node.data.conditionType === 'variable' || !node.data.conditionType) && (<div className="space-y-2"><Label htmlFor="condition-variable">Variable to Check</Label><Input id="condition-variable" placeholder="e.g., {{user_name}}" value={node.data.variable || ''} onChange={(e) => handleDataChange('variable', e.target.value)} /></div>)}
                        <div className="space-y-2"><Label htmlFor="condition-operator">Operator</Label><Select value={node.data.operator || 'equals'} onValueChange={(val) => handleDataChange('operator', val)}><SelectTrigger id="condition-operator"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="equals">Equals</SelectItem><SelectItem value="not_equals">Does not equal</SelectItem><SelectItem value="contains">Contains</SelectItem><SelectItem value="is_one_of">Is one of (comma-sep)</SelectItem><SelectItem value="is_not_one_of">Is not one of (comma-sep)</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label htmlFor="condition-value">Value to Compare Against</Label><Input id="condition-value" placeholder="e.g., confirmed" value={node.data.value || ''} onChange={(e) => handleDataChange('value', e.target.value)} /></div>
                    </div>
                );
            case 'api':
                return (
                    <Tabs defaultValue="request">
                        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="request">Request</TabsTrigger><TabsTrigger value="response">Response</TabsTrigger></TabsList>
                        <TabsContent value="request" className="space-y-4 pt-2"><Select value={node.data.apiRequest?.method || 'GET'} onValueChange={(val) => handleApiChange('method', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem><SelectItem value="PUT">PUT</SelectItem></SelectContent></Select><Input placeholder="https://api.example.com" value={node.data.apiRequest?.url || ''} onChange={(e) => handleApiChange('url', e.target.value)} /><Textarea placeholder='Headers (JSON format)\n{\n  "Authorization": "Bearer ..."\n}' className="font-mono text-xs h-24" value={node.data.apiRequest?.headers || ''} onChange={(e) => handleApiChange('headers', e.target.value)} /><Textarea placeholder="Request Body (JSON)" className="font-mono text-xs h-32" value={node.data.apiRequest?.body || ''} onChange={(e) => handleApiChange('body', e.target.value)} /></TabsContent>
                        <TabsContent value="response" className="space-y-4 pt-2"><Label>Save Response to Variables</Label><div className="space-y-3">{(node.data.apiRequest?.responseMappings || []).map((mapping: any, index: number) => (<div key={index} className="p-2 border rounded-md space-y-2 relative"><Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeMapping(index)}><Trash2 className="h-3 w-3" /></Button><Input placeholder="Variable Name (e.g. user_email)" value={mapping.variable || ''} onChange={(e) => handleMappingChange(index, 'variable', e.target.value)} /><Input placeholder="Response Path (e.g. data.email)" value={mapping.path || ''} onChange={(e) => handleMappingChange(index, 'path', e.target.value)} /></div>))}<Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addMapping}><Plus className="mr-2 h-4 w-4" />Add Mapping</Button><p className="text-xs text-muted-foreground">e.g., to access a field, use {'{{variable_name}}'}</p></TabsContent>
                    </Tabs>
                );
            case 'sendSms':
                return (<div className="space-y-2"><Label htmlFor="sms-text">SMS Text</Label><Textarea id="sms-text" placeholder="Enter SMS text..." value={node.data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} className="h-32" /></div>);
            case 'sendEmail':
                return (<div className="space-y-4"><div className="space-y-2"><Label htmlFor="email-subject">Email Subject</Label><Input id="email-subject" placeholder="Enter email subject" value={node.data.subject || ''} onChange={(e) => handleDataChange('subject', e.target.value)} /></div><div className="space-y-2"><Label htmlFor="email-body">Email Body (HTML)</Label><Textarea id="email-body" placeholder="Enter email body..." value={node.data.body || ''} onChange={(e) => handleDataChange('body', e.target.value)} className="h-32" /></div></div>);
            default:
                return <p className="text-sm text-muted-foreground italic">No properties to configure for this block type.</p>;
        }
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold">Properties</h3>
             <div className="space-y-2">
                <Label>Block Label</Label>
                <Input value={node.data.label} onChange={(e) => handleDataChange('label', e.target.value)} />
            </div>
            <Separator />
            <div className="flex-1">
                {renderProperties()}
            </div>
            {node.type !== 'start' && (
                <Button variant="destructive" className="w-full" onClick={() => deleteNode(node.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Block
                </Button>
            )}
        </div>
    );
}

    