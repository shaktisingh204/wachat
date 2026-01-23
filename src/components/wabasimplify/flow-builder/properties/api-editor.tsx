
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function ApiEditor({ node, onUpdate }: EditorProps) {
    const apiRequest = node.data.apiRequest || {};

    const handleApiChange = (field: string, value: any) => {
        onUpdate({ ...node.data, apiRequest: { ...apiRequest, [field]: value }});
    };

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
            <h3 className="font-semibold">Request</h3>
            <div className="space-y-4 pt-2 border-t">
                <Select value={apiRequest.method || 'GET'} onValueChange={(val) => handleApiChange('method', val)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                    </SelectContent>
                </Select>
                <Input placeholder="https://api.example.com" value={apiRequest.url || ''} onChange={(e) => handleApiChange('url', e.target.value)} />
                <Textarea placeholder='Headers (JSON format)\n{\n  "Authorization": "Bearer ..."\n}' className="font-mono text-xs h-24" value={apiRequest.headers || ''} onChange={(e) => handleApiChange('headers', e.target.value)} />
                <Textarea placeholder="Request Body (JSON)" className="font-mono text-xs h-32" value={apiRequest.body || ''} onChange={(e) => handleApiChange('body', e.target.value)} />
            </div>
            <Separator />
            <h3 className="font-semibold">Response</h3>
            <div className="space-y-4 pt-2">
                <Label>Save Response to Variables</Label>
                <div className="space-y-3">
                    {(apiRequest.responseMappings || []).map((mapping: any, index: number) => (
                        <div key={index} className="p-2 border rounded-md space-y-2 relative">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeMapping(index)}><Trash2 className="h-3 w-3" /></Button>
                            <Input placeholder="Variable Name (e.g. user_email)" value={mapping.variable || ''} onChange={(e) => handleMappingChange(index, 'variable', e.target.value)} />
                            <Input placeholder="Response Path (e.g. data.email)" value={mapping.path || ''} onChange={(e) => handleMappingChange(index, 'path', e.target.value)} />
                        </div>
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addMapping}><Plus className="mr-2 h-4 w-4" />Add Mapping</Button>
            </div>
        </div>
    );
}
