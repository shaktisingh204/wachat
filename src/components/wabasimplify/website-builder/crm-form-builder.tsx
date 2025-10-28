
'use client';

import React, { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, ArrowLeft, Save, LoaderCircle, Eye, Code2, ListPlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { CrmFormFieldEditor } from '@/components/wabasimplify/crm-form-field-editor';
import { saveCrmForm } from '@/app/actions/crm-forms.actions';
import { CrmFormPreview } from '@/components/wabasimplify/crm-form-preview';
import type { WithId, CrmForm, FormField } from '@/lib/definitions';
import { useRouter } from 'next/navigation';
import { StyleSettingsPanel } from '@/components/wabasimplify/website-builder/style-settings-panel';
import Image from 'next/image';
import { CodeBlock } from '../code-block';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


const defaultFields: FormField[] = [
    { id: uuidv4(), type: 'text', label: 'Name', required: true, columnWidth: '50%', fieldId: 'name' },
    { id: uuidv4(), type: 'email', label: 'Email', required: true, columnWidth: '50%', fieldId: 'email' },
    { id: uuidv4(), type: 'textarea', label: 'Message', required: false, columnWidth: '100%', fieldId: 'description' },
];

function CodeEmbedDialog({ embedScript }: { embedScript: string }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline"><Code2 className="mr-2 h-4 w-4"/> Embed</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl overflow-hidden">
                 <DialogHeader>
                    <DialogTitle>Embed Form on Your Website</DialogTitle>
                    <DialogDescription>
                        Copy and paste this code snippet where you want the form to appear on your website.
                    </DialogDescription>
                </DialogHeader>
                 <div className="py-4">
                    <CodeBlock code={embedScript} language="html" />
                </div>
            </DialogContent>
        </Dialog>
    );
}

const crmFieldMappingOptions = [
    { value: 'name', label: 'Contact Name' },
    { value: 'email', label: 'Contact Email' },
    { value: 'phone', label: 'Contact Phone' },
    { value: 'organisation', label: 'Organisation Name' },
    { value: 'designation', label: 'Designation' },
    { value: 'dealName', label: 'Lead Subject' },
    { value: 'description', label: 'Lead Description' },
    { value: 'leadSource', label: 'Lead Source' },
];

const availableFieldTypes = [
    { type: 'text', label: 'Text' },
    { type: 'email', label: 'Email' },
    { type: 'textarea', label: 'Text Area' },
    { type: 'number', label: 'Number' },
    { type: 'select', label: 'Select' },
    { type: 'checkbox', label: 'Checkbox' },
    { type: 'radio', label: 'Radio Group' },
    { type: 'date', label: 'Date' },
    { type: 'file', label: 'File Upload' },
    { type: 'acceptance', label: 'Acceptance' },
    { type: 'hidden', label: 'Hidden' },
    { type: 'html', label: 'HTML' },
];

export function CrmFormBuilder({ initialForm }: { initialForm?: WithId<CrmForm> }) {
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, startSaving] = useTransition();

    const [formName, setFormName] = useState(initialForm?.name || 'New Form');
    const [fields, setFields] = useState<FormField[]>(initialForm?.settings.fields || defaultFields);
    const [settings, setSettings] = useState(initialForm?.settings || { title: 'Contact Us', submitButtonText: 'Send Message' });
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const items = JSON.parse(JSON.stringify(fields));
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setFields(items);
    };

    const addField = (type: FormField['type']) => {
        const newField: Partial<FormField> = {
            id: uuidv4(),
            type,
            label: `New ${type} field`,
            required: false,
            columnWidth: '100%',
            size: 'md',
            labelPosition: 'above'
        };

        const existingFieldIds = fields.map(f => f.fieldId).filter(Boolean);
        const mappedOption = crmFieldMappingOptions.find(opt => opt.value.toLowerCase() === type);

        if (mappedOption && existingFieldIds.includes(mappedOption.value)) {
            toast({ title: 'Field already exists', description: `Your form already contains a field mapped to "${mappedOption.label}".`, variant: 'destructive'});
            return;
        }

        if (type === 'email') {
            newField.label = 'Email';
            newField.fieldId = 'email';
            newField.placeholder = 'Enter your email';
            newField.required = true;
        } else if (type === 'text' && !existingFieldIds.includes('name')) {
             newField.label = 'Name';
             newField.fieldId = 'name';
             newField.placeholder = 'Enter your name';
             newField.required = true;
        }

        setFields([...fields, newField as FormField]);
    };
    
    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

    const updateField = (id: string, updatedField: Partial<FormField>) => {
        setFields(fields.map(f => (f.id === id ? { ...f, ...updatedField } : f)));
    };

    const handleSave = () => {
        startSaving(async () => {
            const result = await saveCrmForm({
                formId: initialForm?._id.toString(),
                name: formName,
                settings: { ...settings, fields }
            });
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'Form saved successfully!' });
                if (result.formId && !initialForm) {
                    router.push(`/dashboard/crm/sales-crm/forms/${result.formId}/edit`);
                } else {
                     router.refresh();
                }
            }
        });
    };
    
    const selectedField = fields.find(f => f.id === selectedFieldId);
    
    const embedScript = initialForm?._id 
        ? `<div data-sabnode-form-id="${initialForm._id.toString()}"></div>\n<script src="${process.env.NEXT_PUBLIC_APP_URL || ''}/api/crm/forms/embed/${initialForm._id.toString()}.js" async defer></script>`
        : 'Save the form to get the embed code.';

    return (
        <div className="h-full flex flex-col">
            <header className="flex-shrink-0 flex items-center justify-between p-3 border-b bg-card">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Input value={formName} onChange={e => setFormName(e.target.value)} className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 p-1 h-auto" />
                </div>
                <div className="flex items-center gap-2">
                    {initialForm?._id && (
                        <>
                            <Button variant="outline" asChild>
                                <a href={`/embed/crm-form/${initialForm._id.toString()}`} target="_blank" rel="noopener noreferrer"><Eye className="mr-2 h-4 w-4"/> Preview</a>
                            </Button>
                            <CodeEmbedDialog embedScript={embedScript} />
                        </>
                    )}
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Form
                    </Button>
                </div>
            </header>
            <div className="flex-1 grid grid-cols-12 min-h-0">
                 <div className="col-span-3 border-r p-4 overflow-y-auto">
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold">Form Fields</h2>
                        <p className="text-sm text-muted-foreground">Drag to reorder fields.</p>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full">
                                    <Plus className="mr-2 h-4 w-4"/>Add Field
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {availableFieldTypes.map(field => (
                                     <DropdownMenuItem key={field.type} onSelect={() => addField(field.type as FormField['type'])}>
                                        {field.label}
                                     </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="form-fields">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                        {fields.map((field, index) => (
                                            <Draggable key={field.id} draggableId={field.id} index={index}>
                                                {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        onClick={() => setSelectedFieldId(field.id)}
                                                    >
                                                        <Card className={`p-3 cursor-pointer hover:bg-muted ${selectedFieldId === field.id ? 'ring-2 ring-primary' : ''}`}>
                                                            <p className="font-semibold text-sm">{field.label || 'Untitled Field'} {field.required && '*'}</p>
                                                            <p className="text-xs text-muted-foreground">{field.type}</p>
                                                        </Card>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </div>
                </div>
                <main className="col-span-6 bg-muted/50 overflow-y-auto p-4 md:p-8">
                     <CrmFormPreview settings={{...settings, fields}} />
                </main>
                 <aside className="col-span-3 border-l p-4 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Properties</h2>
                         {selectedFieldId && (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedFieldId(null)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Form Settings
                            </Button>
                        )}
                    </div>
                    {selectedField ? (
                        <CrmFormFieldEditor
                            field={selectedField}
                            onUpdate={(updatedField) => updateField(selectedFieldId!, updatedField)}
                            onRemove={() => removeField(selectedFieldId!)}
                        />
                    ) : (
                         <Tabs defaultValue="general">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="style">Style</TabsTrigger>
                            </TabsList>
                            <TabsContent value="general" className="mt-4">
                                <Accordion type="multiple" className="w-full" defaultValue={['general_settings']}>
                                    <AccordionItem value="general_settings">
                                        <AccordionTrigger>General Settings</AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="space-y-2"><Label>Form Title</Label><Input value={settings.title || 'Contact Us'} onChange={(e) => setSettings({...settings, title: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Form Description</Label><Textarea value={settings.description || ''} onChange={(e) => setSettings({...settings, description: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Submit Button Text</Label><Input value={settings.submitButtonText || 'Send Message'} onChange={(e) => setSettings({...settings, submitButtonText: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Success Message</Label><Textarea value={settings.successMessage || 'Thank you! Your submission has been received.'} onChange={(e) => setSettings({...settings, successMessage: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Logo URL</Label><Input value={settings.logoUrl || ''} onChange={(e) => setSettings({...settings, logoUrl: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Footer Text (HTML allowed)</Label><Textarea value={settings.footerText || ''} onChange={(e) => setSettings({...settings, footerText: e.target.value})} /></div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </TabsContent>
                            <TabsContent value="style" className="mt-4">
                                 <StyleSettingsPanel settings={settings} onUpdate={setSettings} />
                            </TabsContent>
                        </Tabs>
                    )}
                </aside>
            </div>
        </div>
    );
}
