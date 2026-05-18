'use client';

import {
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  ZoruSeparator,
} from '@/components/zoruui';
import {
  useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function ApiEditor({ node, onUpdate }: EditorProps) {
    const apiRequest = node.data.apiRequest || {};

    const handleApiChange = (field: string, value: any) => {
        onUpdate({ apiRequest: { ...apiRequest, [field]: value }});
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
                <ZoruSelect value={apiRequest.method || 'GET'} onValueChange={(val) => handleApiChange('method', val)}>
                    <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="GET">GET</ZoruSelectItem>
                        <ZoruSelectItem value="POST">POST</ZoruSelectItem>
                        <ZoruSelectItem value="PUT">PUT</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
                <ZoruInput placeholder="https://api.example.com" value={apiRequest.url || ''} onChange={(e) => handleApiChange('url', e.target.value)} />
                <ZoruTextarea placeholder='Headers (JSON format)\n{\n  "Authorization": "Bearer ..."\n}' className="font-mono text-xs h-24" value={apiRequest.headers || ''} onChange={(e) => handleApiChange('headers', e.target.value)} />
                <ZoruTextarea placeholder="Request Body (JSON)" className="font-mono text-xs h-32" value={apiRequest.body || ''} onChange={(e) => handleApiChange('body', e.target.value)} />
            </div>
            <ZoruSeparator />
            <h3 className="font-semibold">Response</h3>
            <div className="space-y-4 pt-2">
                <ZoruLabel>Save Response to Variables</ZoruLabel>
                <div className="space-y-3">
                    {(apiRequest.responseMappings || []).map((mapping: any, index: number) => (
                        <div key={index} className="p-2 border rounded-md space-y-2 relative">
                            <ZoruButton type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeMapping(index)}><Trash2 className="h-3 w-3" /></ZoruButton>
                            <ZoruInput placeholder="Variable Name (e.g. user_email)" value={mapping.variable || ''} onChange={(e) => handleMappingChange(index, 'variable', e.target.value)} />
                            <ZoruInput placeholder="Response Path (e.g. data.email)" value={mapping.path || ''} onChange={(e) => handleMappingChange(index, 'path', e.target.value)} />
                        </div>
                    ))}
                </div>
                <ZoruButton type="button" variant="outline" size="sm" className="w-full mt-2" onClick={addMapping}><Plus className="mr-2 h-4 w-4" />Add Mapping</ZoruButton>
            </div>
        </div>
    );
}
