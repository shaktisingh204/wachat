
'use client';

import React, { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ZoruButton, ZoruButton, ZoruButton } from '@/components/zoruui';
import { ClayCard } from '@/components/clay';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruSwitch } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ZoruScrollArea } from '@/components/zoruui';
import { ZoruSeparator } from '@/components/zoruui';
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
import { ZoruDialog, ZoruDialogContent, ZoruDialogDescription, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogTrigger } from '@/components/zoruui';
import { ZoruDropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger } from '@/components/zoruui';


const defaultFields: FormField[] = [
    { id: uuidv4(), type: 'text', label: 'Name', required: true, columnWidth: '50%', fieldId: 'name' },
    { id: uuidv4(), type: 'email', label: 'Email', required: true, columnWidth: '50%', fieldId: 'email' },
    { id: uuidv4(), type: 'textarea', label: 'Message', required: false, columnWidth: '100%', fieldId: 'description' },
];

function CodeEmbedDialog({ embedScript }: { embedScript: string }) {
    return (
        <ZoruDialog>
            <ZoruDialogTrigger asChild>
                <ZoruButton variant="outline"><Code2 className="mr-2 h-4 w-4"/> Embed</ZoruButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-2xl overflow-hidden">
                 <ZoruDialogHeader>
                    <ZoruDialogTitle>Embed Form on Your Website</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Copy and paste this code snippet where you want the form to appear on your website.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                 <div className="py-4">
                    <CodeBlock code={embedScript} language="html" />
                </div>
            </ZoruDialogContent>
        </ZoruDialog>
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
    { type: 'select', label: 'ZoruSelect' },
    { type: 'checkbox', label: 'ZoruCheckbox' },
    { type: 'radio', label: 'Radio Group' },
    { type: 'date', label: 'Date' },
    { type: 'file', label: 'File Upload' },
    { type: 'acceptance', label: 'Acceptance' },
    { type: 'hidden', label: 'Hidden' },
    { type: 'html', label: 'HTML' },
];

function SortableFieldItem({ field, isSelected, onClick }: { field: FormField; isSelected: boolean; onClick: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
            <ClayCard variant="soft" padded={false} className={`p-3 cursor-pointer hover:bg-secondary ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                <p className="font-semibold text-sm text-foreground">{field.label || 'Untitled Field'} {field.required && '*'}</p>
                <p className="text-xs text-muted-foreground">{field.type}</p>
            </ClayCard>
        </div>
    );
}

export function CrmFormBuilder({ initialForm }: { initialForm?: WithId<CrmForm> }) {
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, startSaving] = useTransition();

    const [formName, setFormName] = useState(initialForm?.name || 'New Form');
    const [fields, setFields] = useState<FormField[]>(initialForm?.settings.fields || defaultFields);
    const [settings, setSettings] = useState(initialForm?.settings || { title: 'Contact Us', submitButtonText: 'Send Message' });
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = fields.findIndex(f => f.id === active.id);
        const newIndex = fields.findIndex(f => f.id === over.id);
        setFields(arrayMove(fields, oldIndex, newIndex));
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
            <header className="flex-shrink-0 flex items-center justify-between p-3 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                    <ZoruButton variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </ZoruButton>
                    <ZoruInput value={formName} onChange={e => setFormName(e.target.value)} className="text-lg font-semibold text-foreground border-none shadow-none focus-visible:ring-0 p-1 h-auto" />
                </div>
                <div className="flex items-center gap-2">
                    {initialForm?._id && (
                        <>
                            <ZoruButton variant="outline" asChild>
                                <a href={`/embed/crm-form/${initialForm._id.toString()}`} target="_blank" rel="noopener noreferrer"><Eye className="mr-2 h-4 w-4"/> Preview</a>
                            </ZoruButton>
                            <CodeEmbedDialog embedScript={embedScript} />
                        </>
                    )}
                    <ZoruButton
                        variant="obsidian"
                        onClick={handleSave}
                        disabled={isSaving}
                        leading={isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    >
                        Save Form
                    </ZoruButton>
                </div>
            </header>
            <div className="flex-1 grid grid-cols-12 min-h-0">
                 <div className="col-span-3 border-r border-border p-4 overflow-y-auto">
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-foreground">Form Fields</h2>
                        <p className="text-sm text-muted-foreground">Drag to reorder fields.</p>
                         <ZoruDropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <ZoruButton variant="outline" size="sm" className="w-full">
                                    <Plus className="mr-2 h-4 w-4"/>Add Field
                                </ZoruButton>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent>
                                {availableFieldTypes.map(field => (
                                     <ZoruDropdownMenuItem key={field.type} onSelect={() => addField(field.type as FormField['type'])}>
                                        {field.label}
                                     </ZoruDropdownMenuItem>
                                ))}
                            </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                            <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                    {fields.map((field) => (
                                        <SortableFieldItem
                                            key={field.id}
                                            field={field}
                                            isSelected={selectedFieldId === field.id}
                                            onClick={() => setSelectedFieldId(field.id)}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
                <main className="col-span-6 bg-secondary overflow-y-auto p-4 md:p-8">
                     <CrmFormPreview settings={{...settings, fields}} />
                </main>
                 <aside className="col-span-3 border-l border-border p-4 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-foreground">Properties</h2>
                         {selectedFieldId && (
                            <ZoruButton variant="ghost" size="sm" onClick={() => setSelectedFieldId(null)}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Form Settings
                            </ZoruButton>
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
                                <ZoruAccordion type="multiple" className="w-full" defaultValue={['general_settings']}>
                                    <ZoruAccordionItem value="general_settings">
                                        <ZoruAccordionTrigger>General Settings</ZoruAccordionTrigger>
                                        <ZoruAccordionContent className="space-y-4 pt-2">
                                            <div className="space-y-2"><ZoruLabel>Form Title</ZoruLabel><ZoruInput value={settings.title || 'Contact Us'} onChange={(e) => setSettings({...settings, title: e.target.value})} /></div>
                                            <div className="space-y-2"><ZoruLabel>Form Description</ZoruLabel><ZoruTextarea value={settings.description || ''} onChange={(e) => setSettings({...settings, description: e.target.value})} /></div>
                                            <div className="space-y-2"><ZoruLabel>Submit ZoruButton Text</ZoruLabel><ZoruInput value={settings.submitButtonText || 'Send Message'} onChange={(e) => setSettings({...settings, submitButtonText: e.target.value})} /></div>
                                            <div className="space-y-2"><ZoruLabel>Success Message</ZoruLabel><ZoruTextarea value={settings.successMessage || 'Thank you! Your submission has been received.'} onChange={(e) => setSettings({...settings, successMessage: e.target.value})} /></div>
                                            <div className="space-y-2"><ZoruLabel>Logo URL</ZoruLabel><ZoruInput value={settings.logoUrl || ''} onChange={(e) => setSettings({...settings, logoUrl: e.target.value})} /></div>
                                            <div className="space-y-2"><ZoruLabel>Footer Text (HTML allowed)</ZoruLabel><ZoruTextarea value={settings.footerText || ''} onChange={(e) => setSettings({...settings, footerText: e.target.value})} /></div>
                                        </ZoruAccordionContent>
                                    </ZoruAccordionItem>
                                </ZoruAccordion>
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
