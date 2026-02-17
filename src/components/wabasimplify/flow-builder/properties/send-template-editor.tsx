
'use client';

import { Label } from '@/components/ui/label';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';
import { getTemplates } from '@/app/actions';
import { useProject } from '@/context/project-context';
import type { Template } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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

        const varNumbers: number[] = [];
        const regex = /{{\s*(\d+)\s*}}/g;

        // Helper to extract matches
        const extract = (str: string) => {
            if (!str) return;
            const matches = str.match(regex);
            if (matches) {
                matches.forEach(m => {
                    varNumbers.push(parseInt(m.replace(/{{\s*|\s*}}/g, '')));
                });
            }
        };

        if (template.components) {
            template.components.forEach(c => {
                if (c.type === 'HEADER' && c.format === 'TEXT') extract(c.text);
                if (c.type === 'BODY') extract(c.text);
                if (c.type === 'BUTTONS' && c.buttons) {
                    c.buttons.forEach((b: any) => {
                        if (b.type === 'URL') extract(b.url);
                    });
                }
            });
        }

        return [...new Set(varNumbers)].sort((a, b) => a - b);
    };


    const variables = getTemplateVariables(selectedTemplate);

    const headerComponent = selectedTemplate?.components?.find(c => c.type === 'HEADER');
    const hasMediaHeader = headerComponent?.format === 'IMAGE' || headerComponent?.format === 'VIDEO' || headerComponent?.format === 'DOCUMENT';
    const mediaType = headerComponent?.format?.toLowerCase();

    const [mediaSource, setMediaSource] = useState<'url' | 'upload'>('url');

    useEffect(() => {
        if (node.data.headerMedia?.base64) {
            setMediaSource('upload');
        } else {
            setMediaSource('url');
        }
    }, [node.data.headerMedia]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onUpdate({
                    headerMedia: {
                        type: mediaType,
                        url: '',
                        base64: reader.result as string
                    }
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUrlChange = (url: string) => {
        onUpdate({
            headerMedia: {
                type: mediaType,
                url: url,
                base64: ''
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Template</Label>
                <SmartCombobox
                    value={node.data.templateId || ''}
                    onSelect={handleTemplateChange}
                    options={templates.map(t => ({ label: t.name, value: t._id.toString() }))}
                    placeholder="Select a template..."
                    searchPlaceholder="Search templates..."
                />
            </div>

            {selectedTemplate && hasMediaHeader && (
                <div className="space-y-4 pt-2 border-t">
                    <Label>Header Media ({mediaType})</Label>
                    <RadioGroup value={mediaSource} onValueChange={(v) => setMediaSource(v as any)} className="flex gap-4">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="url" id="t-media-url" /><Label htmlFor="t-media-url">From URL</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="upload" id="t-media-upload" /><Label htmlFor="t-media-upload">Upload</Label></div>
                    </RadioGroup>

                    {mediaSource === 'url' ? (
                        <div className="space-y-2">
                            <Label htmlFor="t-media-url-input">Media URL</Label>
                            <Input
                                id="t-media-url-input"
                                placeholder={`https://example.com/media.${mediaType === 'image' ? 'png' : 'mp4'}`}
                                value={node.data.headerMedia?.url || ''}
                                onChange={(e) => handleUrlChange(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="t-media-file">Upload Media</Label>
                            <Input
                                id="t-media-file"
                                type="file"
                                accept={mediaType === 'image' ? "image/*" : mediaType === 'video' ? "video/*" : "*/*"}
                                onChange={handleFileChange}
                            />
                            {node.data.headerMedia?.base64 && (
                                <p className="text-xs text-green-600 truncate">Media uploaded</p>
                            )}
                        </div>
                    )}
                </div>
            )}

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
