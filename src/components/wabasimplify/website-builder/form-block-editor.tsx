
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

type FormField = {
  id: string;
  type: 'text' | 'email' | 'textarea' | 'dropdown' | 'checkbox';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string; // Comma-separated for dropdown/checkbox
};

export function FormBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const fields = settings.fields || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleFieldChange = (index: number, field: keyof FormField, value: any) => {
        const newFields = [...fields];
        (newFields[index] as any)[field] = value;
        handleUpdate('fields', newFields);
    };

    const addField = () => {
        const newFields = [...fields, { id: uuidv4(), type: 'text', label: 'New Field', required: false }];
        handleUpdate('fields', newFields);
    };

    const removeField = (index: number) => {
        const newFields = fields.filter((_: any, i: number) => i !== index);
        handleUpdate('fields', newFields);
    };

    const handleSubFieldUpdate = (mainField: string, subField: string, value: any) => {
        onUpdate({
            ...settings,
            [mainField]: {
                ...(settings[mainField] || {}),
                [subField]: value
            }
        });
    }
    
    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['general', 'fields']}>
                <AccordionItem value="general">
                    <AccordionTrigger>General Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Form Title</Label>
                            <Input value={settings.title || 'Contact Us'} onChange={(e) => handleUpdate('title', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea value={settings.description || ''} onChange={(e) => handleUpdate('description', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label>Submit Button Text</Label>
                            <Input value={settings.submitButtonText || 'Submit'} onChange={(e) => handleUpdate('submitButtonText', e.target.value)} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="fields">
                    <AccordionTrigger>Form Fields</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        {fields.map((field: FormField, index: number) => (
                            <div key={field.id} className="p-3 border rounded-md space-y-3 relative bg-background">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeField(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <Label>Field Type</Label>
                                        <Select value={field.type} onValueChange={(val) => handleFieldChange(index, 'type', val)}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text">Text</SelectItem>
                                                <SelectItem value="email">Email</SelectItem>
                                                <SelectItem value="textarea">Text Area</SelectItem>
                                                <SelectItem value="dropdown">Dropdown</SelectItem>
                                                <SelectItem value="checkbox">Checkbox</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center space-x-2 pt-6">
                                        <Switch id={`required-${field.id}`} checked={field.required} onCheckedChange={(val) => handleFieldChange(index, 'required', val)} />
                                        <Label htmlFor={`required-${field.id}`}>Required</Label>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Label</Label>
                                    <Input value={field.label} onChange={(e) => handleFieldChange(index, 'label', e.target.value)} placeholder="e.g., Your Name" />
                                </div>
                                {(field.type === 'dropdown' || field.type === 'checkbox') && (
                                    <div className="space-y-2">
                                        <Label>Options (comma-separated)</Label>
                                        <Input value={field.options || ''} onChange={(e) => handleFieldChange(index, 'options', e.target.value)} placeholder="Option 1, Option 2" />
                                    </div>
                                )}
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addField}><Plus className="mr-2 h-4 w-4" /> Add Field</Button>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="actions">
                    <AccordionTrigger>Submission</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <Input type="url" value={settings.webhookUrl || ''} onChange={(e) => handleUpdate('webhookUrl', e.target.value)} placeholder="https://api.example.com/form" />
                            <p className="text-xs text-muted-foreground">The URL where form data will be sent via a POST request.</p>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <Label>Success Message</Label>
                            <Textarea value={settings.successMessage || 'Thank you! Your submission has been received.'} onChange={(e) => handleUpdate('successMessage', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label>Redirect URL (Optional)</Label>
                            <Input type="url" value={settings.redirectUrl || ''} onChange={(e) => handleUpdate('redirectUrl', e.target.value)} placeholder="https://example.com/thank-you" />
                             <p className="text-xs text-muted-foreground">Redirect the user to this URL after a successful submission.</p>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="layout">
                    <AccordionTrigger>Sizing &amp; Layout</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Width</Label>
                                <Input value={settings.layout?.width || '100%'} onChange={e => handleSubFieldUpdate('layout', 'width', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Height</Label>
                                <Input value={settings.layout?.height || 'auto'} onChange={e => handleSubFieldUpdate('layout', 'height', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Max Width</Label>
                                <Input value={settings.layout?.maxWidth || ''} placeholder="e.g. 1200px" onChange={e => handleSubFieldUpdate('layout', 'maxWidth', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Min Height</Label>
                                <Input value={settings.layout?.minHeight || ''} placeholder="e.g. 200px" onChange={e => handleSubFieldUpdate('layout', 'minHeight', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Overflow</Label>
                            <Select value={settings.layout?.overflow || 'visible'} onValueChange={(val) => handleSubFieldUpdate('layout', 'overflow', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="visible">Visible</SelectItem>
                                    <SelectItem value="hidden">Hidden</SelectItem>
                                    <SelectItem value="scroll">Scroll</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

    