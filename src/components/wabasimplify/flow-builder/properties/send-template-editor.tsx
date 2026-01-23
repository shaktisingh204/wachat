
'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTemplates } from '@/app/actions';
import { useProject } from '@/context/project-context';
import type { Template } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function SendTemplateEditor({ node, onUpdate }: EditorProps) {
    const { activeProjectId } = useProject();
    const [templates, setTemplates] = useState<WithId<Template>[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<WithId<Template> | null>(null);

    useEffect(() => {
        if (activeProjectId) {
            getTemplates(activeProjectId).then(data => setTemplates(data.filter(t => t.status === 'APPROVED')));
        }
    }, [activeProjectId]);

    useEffect(() => {
        if (node.data.templateId) {
            const found = templates.find(t => t._id.toString() === node.data.templateId);
            setSelectedTemplate(found || null);
        } else {
            setSelectedTemplate(null);
        }
    }, [node.data.templateId, templates]);

    const handleTemplateChange = (templateId: string) => {
        onUpdate({ templateId: templateId, inputs: {} });
    };

    const handleVariableChange = (varName: string, value: string) => {
        const newInputs = { ...node.data.inputs, [varName]: value };
        onUpdate({ inputs: newInputs });
    };

    const getTemplateVariables = (template: WithId<Template> | null) => {
        if (!template) return [];
        
        let allText = template.body || '';
        if (template.components) {
            allText += template.components.map(c => c.text || '').join(' ');
        }
        
        const regex = /{{\s*(\d+)\s*}}/g;
        const matches = allText.match(regex);
        if (!matches) return [];
        
        const varNumbers = matches.map(v => parseInt(v.replace(/{{\s*|\s*}}/g, '')));
        return [...new Set(varNumbers)].sort((a, b) => a - b);
    };

    const variables = getTemplateVariables(selectedTemplate);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Template</Label>
                <Select value={node.data.templateId || ''} onValueChange={handleTemplateChange}>
                    <SelectTrigger><SelectValue placeholder="Select a template..."/></SelectTrigger>
                    <SelectContent>
                        {templates.map(t => <SelectItem key={t._id.toString()} value={t._id.toString()}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {selectedTemplate && variables.length > 0 && (
                <div className="space-y-3 pt-2 border-t">
                    <Label>Template Variables</Label>
                    {variables.map(varNum => (
                        <div key={varNum} className="space-y-1">
                            <Label htmlFor={`var-${varNum}`} className="text-xs text-muted-foreground">Variable {'{{'}{varNum}{'}}'}</Label>
                            <Input
                                id={`var-${varNum}`}
                                placeholder="Enter value or a variable like {{name}}"
                                value={node.data.inputs?.[`variable${varNum}`] || ''}
                                onChange={(e) => handleVariableChange(`variable${varNum}`, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
