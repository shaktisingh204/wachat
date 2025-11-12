
'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

const KeyValueEditor: React.FC<{ items: { key: string, value: string, enabled: boolean }[], onItemsChange: (items: any[]) => void }> = ({ items, onItemsChange }) => {
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

export function ApiRequestEditor({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) {
    const apiRequest = data.apiRequest || {};

    const handleApiChange = (field: string, value: any) => {
        onUpdate({ ...data, apiRequest: { ...apiRequest, [field]: value }});
    };

    const handleAuthChange = (type: string, details?: any) => {
        handleApiChange('auth', { type, ...(details || {}) });
    }
    
    const handleBodyChange = (type: string, content?: any) => {
        const bodyContent = content || (type === 'form_data' ? [] : '');
        handleApiChange('body', { type, [type === 'json' ? 'json' : 'formData']: bodyContent });
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
                     <Select value={apiRequest.auth?.type || 'none'} onValueChange={type => handleAuthChange(type)}>
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
                     <RadioGroup value={apiRequest.body?.type || 'none'} onValueChange={type => handleBodyChange(type, apiRequest.body?.[type === 'json' ? 'json' : 'formData'])} className="flex gap-4">
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
             <div className="space-y-2 pt-4">
                <Label>Save Full Response To</Label>
                <Input placeholder="Variable name for full response..." value={data.responseVariableName || ''} onChange={e => onUpdate({ ...data, responseVariableName: e.target.value })} />
                <p className="text-xs text-muted-foreground">The entire response object (status, headers, data) will be saved to this variable. e.g. `{{Api_Request.response.data.some_field}}`</p>
            </div>
        </div>
    );
}
