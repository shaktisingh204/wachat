'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { WithId, CrmEmailTemplate, Template, MetaFlow } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ArrowLeft, Key, CaseSensitive, AtSign } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useProject } from '@/context/project-context';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { AppConnectionSetup } from './connections/app-connection-setup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PropertiesPanelProps {
    user: any;
    selectedNode: any;
    onNodeChange: (id: string, data: any) => void;
    onNodeRemove: (id: string) => void;
    onConnectionSaved: () => void;
    params: any;
}

const triggers = [
    { id: 'webhook', name: 'Webhook' },
    { id: 'manual', name: 'Manual' },
    { id: 'schedule', name: 'Schedule' },
    { id: 'app', name: 'App Trigger' },
];

function NodeInput({ input, value, onChange }: { input: any, value: any, onChange: (val: any) => void }) {
    switch (input.type) {
        case 'textarea':
            return <Textarea placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
        default:
            return <Input type={input.type || 'text'} placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
    }
}

const KeyValueEditor = ({ items, onItemsChange }: { items: { key: string, value: string, enabled: boolean }[], onItemsChange: (items: any[]) => void }) => {
    const handleItemChange = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        onItemsChange(newItems);
    };

    const handleAddItem = () => {
        onItemsChange([...items, { key: '', value: '', enabled: true }]);
    };

    const handleRemoveItem = (index: number) => {
        onItemsChange(items.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                    <Input placeholder="Key" value={item.key} onChange={(e) => handleItemChange(index, 'key', e.target.value)} className="h-8"/>
                    <Input placeholder="Value" value={item.value} onChange={(e) => handleItemChange(index, 'value', e.target.value)} className="h-8"/>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRemoveItem(index)}><Trash2 className="h-4 w-4"/></Button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>Add</Button>
        </div>
    );
};

const ApiRequestEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => {
    const apiRequest = data.apiRequest || {};

    const handleApiChange = (field: string, value: any) => {
        onUpdate({ ...data, apiRequest: { ...apiRequest, [field]: value }});
    };

    const handleAuthChange = (type: string, details: any) => {
        handleApiChange('auth', { type, ...details });
    }
    
    const handleBodyChange = (type: string, content: any) => {
        handleApiChange('body', { type, [type === 'json' ? 'json' : 'formData']: content });
    }

    const handleMappingChange = (index: number, field: 'variable' | 'path', value: string) => {
        const mappings = [...(apiRequest.responseMappings || [])];
        mappings[index] = { ...mappings[index], [field]: value };
        handleApiChange('responseMappings', mappings);
    };

    const addMapping = () => {
        const mappings = [...(apiRequest.responseMappings || []), { variable: '', path: '' }];
        handleApiChange('responseMappings', mappings);
    };

    const removeMapping = (index: number) => {
        const mappings = (apiRequest.responseMappings || []).filter((_: any, i: number) => i !== index);
        handleApiChange('responseMappings', mappings);
    };
    
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Select value={apiRequest.method || 'GET'} onValueChange={val => handleApiChange('method', val)}>
                    <SelectTrigger className="w-[100px] font-semibold"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                </Select>
                <Input placeholder="https://api.example.com/data" value={apiRequest.url || ''} onChange={e => handleApiChange('url', e.target.value)} />
            </div>

            <Tabs defaultValue="params">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="params">Params</TabsTrigger>
                    <TabsTrigger value="auth">Auth</TabsTrigger>
                    <TabsTrigger value="headers">Headers</TabsTrigger>
                    <TabsTrigger value="body">Body</TabsTrigger>
                </TabsList>
                <TabsContent value="params" className="pt-4">
                    <KeyValueEditor items={apiRequest.params || []} onItemsChange={items => handleApiChange('params', items)} />
                </TabsContent>
                <TabsContent value="auth" className="pt-4 space-y-4">
                     <Select value={apiRequest.auth?.type || 'none'} onValueChange={type => handleAuthChange(type, {})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No Auth</SelectItem>
                            <SelectItem value="bearer">Bearer Token</SelectItem>
                            <SelectItem value="api_key">API Key</SelectItem>
                            <SelectItem value="basic">Basic Auth</SelectItem>
                        </SelectContent>
                     </Select>
                     {apiRequest.auth?.type === 'bearer' && (
                         <Input placeholder="Token" value={apiRequest.auth?.token || ''} onChange={e => handleAuthChange('bearer', { token: e.target.value })} />
                     )}
                     {apiRequest.auth?.type === 'api_key' && (
                         <div className="space-y-2">
                             <Input placeholder="Key" value={apiRequest.auth?.key || ''} onChange={e => handleAuthChange('api_key', { ...apiRequest.auth, key: e.target.value })} />
                             <Input placeholder="Value" value={apiRequest.auth?.value || ''} onChange={e => handleAuthChange('api_key', { ...apiRequest.auth, value: e.target.value })} />
                              <RadioGroup value={apiRequest.auth?.in || 'header'} onValueChange={val => handleAuthChange('api_key', {...apiRequest.auth, in: val})} className="flex gap-4">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="header" id="in-header"/><Label htmlFor="in-header">Header</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="query" id="in-query"/><Label htmlFor="in-query">Query Params</Label></div>
                            </RadioGroup>
                         </div>
                     )}
                      {apiRequest.auth?.type === 'basic' && (
                         <div className="space-y-2">
                             <Input placeholder="Username" value={apiRequest.auth?.username || ''} onChange={e => handleAuthChange('basic', { ...apiRequest.auth, username: e.target.value })} />
                             <Input type="password" placeholder="Password" value={apiRequest.auth?.password || ''} onChange={e => handleAuthChange('basic', { ...apiRequest.auth, password: e.target.value })} />
                         </div>
                     )}
                </TabsContent>
                <TabsContent value="headers" className="pt-4">
                    <KeyValueEditor items={apiRequest.headers || []} onItemsChange={items => handleApiChange('headers', items)} />
                </TabsContent>
                <TabsContent value="body" className="pt-4 space-y-4">
                     <RadioGroup value={apiRequest.body?.type || 'none'} onValueChange={type => handleBodyChange(type, apiRequest.body?.[type === 'json' ? 'json' : 'formData'] || (type === 'form_data' ? [] : ''))} className="flex gap-4">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="body-none"/><Label htmlFor="body-none">None</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="form_data" id="body-form"/><Label htmlFor="body-form">Form Data</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="json" id="body-json"/><Label htmlFor="body-json">JSON</Label></div>
                    </RadioGroup>
                    {apiRequest.body?.type === 'form_data' && (
                        <KeyValueEditor items={apiRequest.body?.formData || []} onItemsChange={items => handleBodyChange('form_data', items)} />
                    )}
                    {apiRequest.body?.type === 'json' && (
                        <Textarea placeholder='{ "key": "value" }' className="font-mono text-xs h-32" value={apiRequest.body?.json || ''} onChange={e => handleBodyChange('json', e.target.value)} />
                    )}
                </TabsContent>
            </Tabs>
            
            <Separator />
            
             <div className="space-y-2">
                <Label>Response Mapping</Label>
                <p className="text-xs text-muted-foreground">Save parts of the API response to variables for use in later steps.</p>
                <div className="space-y-3">
                    {(apiRequest?.responseMappings || []).map((mapping: any, index: number) => (
                        <div key={index} className="p-2 border rounded-md space-y-2 relative">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeMapping(index)}><Trash2 className="h-3 w-3" /></Button>
                            <Input placeholder="Save to variable..." value={mapping.variable || ''} onChange={(e) => handleMappingChange(index, 'variable', e.target.value)} />
                            <Input placeholder="Response path (e.g., data.id)" value={mapping.path || ''} onChange={(e) => handleMappingChange(index, 'path', e.target.value)} />
                        </div>
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addMapping}><Plus className="mr-2 h-4 w-4" />Add Mapping</Button>
            </div>
        </div>
    );
}

export function PropertiesPanel({ user, selectedNode, onNodeChange, onNodeRemove, onConnectionSaved, params }: PropertiesPanelProps) {
    if (!selectedNode) return null;
    
    const handleDataChange = (data: any) => {
        onNodeChange(selectedNode.id, { ...selectedNode.data, ...data });
    };

    const selectedApp = sabnodeAppActions.find(app => app.appId === selectedNode.data.appId);
    const selectedAction = selectedApp?.actions.find(a => a.name === selectedNode.data.actionName);
    const Icon = selectedApp?.icon || Zap;

    const renderEditorContent = () => {
        const isAction = selectedNode.type === 'action';
        const isTrigger = selectedNode.type === 'trigger';

        if (isAction) {
            if (selectedNode.data.actionName === 'apiRequest') {
                return <ApiRequestEditor data={selectedNode.data} onUpdate={handleDataChange} />;
            }
             if (!selectedNode.data.appId) {
                const connectedAppIds = new Set(user?.sabFlowConnections?.map((c: any) => c.appId));
                const groupedApps = Object.entries(sabnodeAppActions.reduce((acc, app) => {
                    const category = app.category || 'SabNode Apps';
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(app);
                    return acc;
                }, {} as Record<string, any[]>));

                return (
                    <Accordion type="multiple" defaultValue={['SabNode Apps', 'Core Apps']} className="w-full">
                        {groupedApps.map(([category, apps]: [string, any[]]) => (
                            <AccordionItem key={category} value={category}>
                                <AccordionTrigger>{category}</AccordionTrigger>
                                <AccordionContent className="p-2">
                                    <div className="grid grid-cols-4 gap-2">
                                        {apps.map(app => {
                                            const AppIcon = app.icon || Zap;
                                            return (
                                                <button type="button" key={app.appId} className="p-2 text-center cursor-pointer hover:bg-accent rounded-lg flex flex-col items-center gap-1" onClick={()={() => handleDataChange({ appId: app.appId })}>
                                                    <AppIcon className={cn("h-6 w-6", app.iconColor)}/>
                                                    <p className="text-xs text-foreground break-words">{app.name}</p>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                );
            } else if (selectedNode.data.appId && !selectedNode.data.connectionId) {
                 return <AppConnectionSetup app={selectedApp} onConnectionSaved={onConnectionSaved} flowId={params.flowId} />;
            } else {
                const actionOptions = selectedApp?.actions || [];
                return (
                    <>
                        <div className="space-y-2">
                            <Label>Action</Label>
                            <Select value={selectedNode.data.actionName} onValueChange={val => handleDataChange({ actionName: val, inputs: {} })}>
                                <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                                <SelectContent>{actionOptions.map((action: any) => (<SelectItem key={action.name} value={action.name}>{action.label}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        {selectedAction && (
                             <div className="space-y-4 pt-4 border-t">
                                <p className="text-sm text-muted-foreground">{selectedAction.description}</p>
                                {selectedAction.inputs.map((input: any) => (<div key={input.name} className="space-y-2"><Label>{input.label}</Label><NodeInput input={input} value={selectedNode.data.inputs[input.name] || ''} onChange={val => handleDataChange({ inputs: {...selectedNode.data.inputs, [input.name]: val} })}/></div>))}
                            </div>
                        )}
                    </>
                );
            }
        }

        if (isTrigger) {
             const selectedTrigger = triggers.find(t => t.id === selectedNode.data.triggerType);
             return (
                <div className="space-y-2">
                    <Label>Trigger Type</Label>
                    <Select value={selectedNode.data.triggerType} onValueChange={val => handleDataChange({ triggerType: val, connectionId: '', appId: '', actionName: '', inputs: {} })}>
                        <SelectTrigger><SelectValue placeholder="Select a trigger"/></SelectTrigger>
                        <SelectContent>{triggers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {selectedTrigger && <p className="text-xs text-muted-foreground">{selectedTrigger.description}</p>}
                    {selectedTrigger?.id === 'webhook' && (
                        <div className="pt-4"><Label>Webhook URL</Label><CodeBlock code={`${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${params.flowId}`} /></div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full flex flex-col" style={{ minWidth: '25%', background: 'white' }}>
            <div className="p-4 border-b flex-shrink-0">
                <h3 className="text-lg font-semibold">Properties</h3>
                <p className="text-sm text-muted-foreground">Configure the selected step.</p>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    <div className="space-y-2"><Label>Step Name</Label><Input value={selectedNode.data.name} onChange={e => handleDataChange({ name: e.target.value })}/></div>
                    <Separator />
                    {selectedApp && selectedNode.type === 'action' && (
                        <div className="flex items-center gap-2">
                             <Button variant="ghost" size="sm" onClick={() => handleDataChange({ connectionId: '', appId: '', actionName: '', inputs: {} })}><ArrowLeft className="mr-2 h-4 w-4"/> Change App</Button>
                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm"><Icon className={cn("h-5 w-5", selectedApp.iconColor)} /><span className="font-semibold">{selectedApp.name}</span></div>
                        </div>
                    )}
                    {renderEditorContent()}
                </div>
            </ScrollArea>
            {selectedNode?.type !== 'trigger' && (
                <div className="p-4 border-t flex-shrink-0">
                    <Button variant="destructive" className="w-full" onClick={() => onNodeRemove(selectedNode.id)}><Trash2 className="mr-2 h-4 w-4" />Delete Step</Button>
                </div>
            )}
        </div>
    );
};
