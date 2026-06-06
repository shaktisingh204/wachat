'use client';

import { Button, Input, Label, Switch, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Accordion, AccordionContent, AccordionItem, AccordionTrigger, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Card, Slider, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/sabcrm/20ui/compat';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter } from '@dnd-kit/core';
import { SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, ArrowLeft, Save, LoaderCircle, Eye, Code2, GripVertical, X, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { CrmFormFieldEditor } from '@/components/zoruui-domain/crm-form-field-editor';
import { SabFilePickerButton } from '@/components/sabfiles';
import { saveCrmForm } from '@/app/actions/crm-forms.actions';
import { CrmFormPreview } from '@/components/zoruui-domain/crm-form-preview';
import type { WithId,
  CrmForm,
  FormField,
  FormPage } from '@/lib/definitions';
import { useRouter } from 'next/navigation';
import { StyleSettingsPanel } from '@/components/zoruui-domain/website-builder/style-settings-panel';
import { CodeBlock } from '../code-block';

import React, { useState, useTransition, useMemo } from 'react';

type AutoCreateMapping = Partial<Record<
    'name' | 'email' | 'phone' | 'dealName' | 'description' | 'leadSource',
    string
>>;

interface ThemeSettings {
    primaryColor?: string;
    fontFamily?: 'system' | 'inter' | 'roboto' | 'serif';
    borderRadius?: number;
    logoFileId?: string;
    logoFileUrl?: string;
    backgroundFileId?: string;
    backgroundFileUrl?: string;
}

interface PostSubmitSettings {
    successMessage?: string;
    redirectUrl?: string;
    emailNotifications?: {
        enabled: boolean;
        toEmails: string[];
        subject: string;
        bodyTemplate: string;
    };
    webhook?: {
        enabled: boolean;
        url: string;
        secret: string;
    };
    autoCreate?: {
        lead: boolean;
        contact: boolean;
        mapping: AutoCreateMapping;
    };
}

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

const availableFieldTypes: { type: FormField['type']; label: string }[] = [
    { type: 'text', label: 'Text' },
    { type: 'email', label: 'Email' },
    { type: 'phone', label: 'Phone' },
    { type: 'textarea', label: 'Text Area' },
    { type: 'number', label: 'Number' },
    { type: 'select', label: 'Select' },
    { type: 'checkbox', label: 'Checkbox' },
    { type: 'radio', label: 'Radio Group' },
    { type: 'date', label: 'Date' },
    { type: 'file', label: 'File Upload' },
    { type: 'address', label: 'Address' },
    { type: 'rating', label: 'Rating (Stars)' },
    { type: 'signature', label: 'Signature' },
    { type: 'acceptance', label: 'Acceptance' },
    { type: 'hidden', label: 'Hidden' },
    { type: 'html', label: 'HTML' },
];

function SortableFieldItem({ field, isSelected, onClick, onMove, canMove }: {
    field: FormField;
    isSelected: boolean;
    onClick: () => void;
    onMove?: () => void;
    canMove?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Card
                variant="soft"
                padded={false}
                className={`p-3 cursor-pointer hover:bg-[var(--st-bg-muted)] flex items-center gap-2 ${isSelected ? 'ring-2 ring-primary' : ''}`}
                onClick={onClick}
            >
                <button
                    type="button"
                    className="cursor-grab touch-none text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                    {...attributes}
                    {...listeners}
                    aria-label="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[var(--st-text)] truncate">
                        {field.label || 'Untitled Field'} {field.required && '*'}
                    </p>
                    <p className="text-xs text-[var(--st-text-secondary)]">{field.type}</p>
                </div>
                {canMove && onMove && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMove(); }}
                        className="text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                        aria-label="Move to next page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                )}
            </Card>
        </div>
    );
}

// Flat shape from legacy forms (no pages). Builds a single-page wrapper around it.
function buildInitialPages(initial?: WithId<CrmForm>): FormPage[] {
    const settings = initial?.settings || {};
    if (Array.isArray(settings.pages) && settings.pages.length > 0) {
        return settings.pages as FormPage[];
    }
    const legacyFields: FormField[] = Array.isArray(settings.fields)
        ? settings.fields
        : defaultFields;
    return [{ id: uuidv4(), title: 'Page 1', fields: legacyFields }];
}

export function CrmFormBuilder({ initialForm }: { initialForm?: WithId<CrmForm> }) {
    const router = useRouter();
    const { toast } = useToast();
    const [isSaving, startSaving] = useTransition();

    const [formName, setFormName] = useState(initialForm?.name || 'New Form');
    const [pages, setPages] = useState<FormPage[]>(() => buildInitialPages(initialForm));
    const [activePageIndex, setActivePageIndex] = useState(0);
    const [settings, setSettings] = useState<Record<string, unknown>>(() => {
        const base = (initialForm?.settings as Record<string, unknown>) || {};
        return {
            title: 'Contact Us',
            submitButtonText: 'Send Message',
            ...base,
        };
    });
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const activePage = pages[activePageIndex] ?? pages[0];
    const fields = activePage?.fields ?? [];
    // Flat view across all pages so submit/preview legacy code keeps working.
    const flatFields = useMemo(() => pages.flatMap(p => p.fields), [pages]);

    const updatePage = (idx: number, patch: Partial<FormPage>) => {
        setPages(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = fields.findIndex(f => f.id === active.id);
        const newIndex = fields.findIndex(f => f.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        updatePage(activePageIndex, { fields: arrayMove(fields, oldIndex, newIndex) });
    };

    const addField = (type: FormField['type']) => {
        const newField: FormField = {
            id: uuidv4(),
            type,
            label: `New ${type} field`,
            required: false,
            columnWidth: '100%',
            size: 'md',
            labelPosition: 'above',
        };

        const existingFieldIds = flatFields.map(f => f.fieldId).filter(Boolean);
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
        } else if (type === 'phone' && !existingFieldIds.includes('phone')) {
            newField.label = 'Phone';
            newField.fieldId = 'phone';
            newField.placeholder = '+1 555 123 4567';
        } else if (type === 'text' && !existingFieldIds.includes('name')) {
             newField.label = 'Name';
             newField.fieldId = 'name';
             newField.placeholder = 'Enter your name';
             newField.required = true;
        } else if (type === 'rating') {
            newField.maxRating = 5;
        }

        updatePage(activePageIndex, { fields: [...fields, newField] });
    };

    const removeField = (id: string) => {
        const newFields = fields.filter(f => f.id !== id);
        updatePage(activePageIndex, { fields: newFields });
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

    const updateField = (id: string, updatedField: Partial<FormField>) => {
        updatePage(activePageIndex, { fields: fields.map(f => (f.id === id ? { ...f, ...updatedField } : f)) });
    };

    const moveFieldToPage = (fieldId: string, targetPageIndex: number) => {
        if (targetPageIndex < 0 || targetPageIndex >= pages.length) return;
        const field = fields.find(f => f.id === fieldId);
        if (!field) return;
        setPages(prev => prev.map((p, i) => {
            if (i === activePageIndex) return { ...p, fields: p.fields.filter(f => f.id !== fieldId) };
            if (i === targetPageIndex) return { ...p, fields: [...p.fields, field] };
            return p;
        }));
    };

    const addPage = () => {
        const newPage: FormPage = { id: uuidv4(), title: `Page ${pages.length + 1}`, fields: [] };
        setPages(prev => [...prev, newPage]);
        setActivePageIndex(pages.length);
    };

    const removePage = (idx: number) => {
        if (pages.length <= 1) {
            toast({ title: 'Cannot remove', description: 'A form must have at least one page.', variant: 'destructive' });
            return;
        }
        setPages(prev => {
            const removed = prev[idx];
            const next = prev.filter((_, i) => i !== idx);
            // Salvage fields by appending to the first remaining page.
            if (removed?.fields.length && next[0]) {
                next[0] = { ...next[0], fields: [...next[0].fields, ...removed.fields] };
            }
            return next;
        });
        setActivePageIndex(0);
    };

    const handleSave = () => {
        if (!formName || !formName.trim()) {
            toast({ title: 'Validation Error', description: 'Form name cannot be empty.', variant: 'destructive' });
            return;
        }

        const usedFieldIds = new Set<string>();
        for (const page of pages) {
            for (const field of page.fields) {
                if (field.type !== 'html' && field.type !== 'hidden' && (!field.label || !field.label.trim())) {
                    toast({ title: 'Validation Error', description: 'All visible fields must have a label.', variant: 'destructive' });
                    return;
                }
                if (field.fieldId) {
                    if (usedFieldIds.has(field.fieldId)) {
                        toast({ title: 'Validation Error', description: `Duplicate Field ID found: ${field.fieldId}. Field IDs must be unique.`, variant: 'destructive' });
                        return;
                    }
                    usedFieldIds.add(field.fieldId);
                }
            }
        }

        startSaving(async () => {
            // Persist BOTH `pages` and `fields` (flat) so legacy renderers keep working.
            const result = await saveCrmForm({
                formId: initialForm?._id.toString(),
                name: formName,
                settings: { ...settings, pages, fields: flatFields },
            });
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'Form saved successfully!' });
                const isNewForm = !initialForm || initialForm._id.toString().startsWith('temp_');
                if (result.formId && isNewForm) {
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

    const theme = (settings.theme as ThemeSettings | undefined) || {};
    const postSubmit = (settings.postSubmit as PostSubmitSettings | undefined) || {};

    const setTheme = (patch: Partial<ThemeSettings>) => {
        setSettings(s => ({ ...s, theme: { ...theme, ...patch } }));
    };
    const setPostSubmit = (patch: Partial<PostSubmitSettings>) => {
        setSettings(s => ({ ...s, postSubmit: { ...postSubmit, ...patch } }));
    };

    const emailNotifications = postSubmit.emailNotifications || {
        enabled: false, toEmails: [], subject: '', bodyTemplate: '',
    };
    const webhook = postSubmit.webhook || { enabled: false, url: '', secret: '' };
    const autoCreate = postSubmit.autoCreate || {
        lead: true,
        contact: true,
        mapping: {} as AutoCreateMapping,
    };

    const mappingTargets: (keyof AutoCreateMapping)[] = ['name', 'email', 'phone', 'dealName', 'description', 'leadSource'];

    return (
        <div className="h-full flex flex-col">
            <header className="flex-shrink-0 flex items-center justify-between p-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Input value={formName} onChange={e => setFormName(e.target.value)} className="text-lg font-semibold text-[var(--st-text)] border-none shadow-none focus-visible:ring-0 p-1 h-auto" />
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
                    <Button
                        variant="obsidian"
                        onClick={handleSave}
                        disabled={isSaving}
                        leading={isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    >
                        Save Form
                    </Button>
                </div>
            </header>
            <div className="flex-1 grid grid-cols-12 min-h-0">
                <div className="col-span-3 border-r border-[var(--st-border)] p-4 overflow-y-auto">
                    <div className="space-y-4">
                        {/* Pages strip */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-[var(--st-text)]">Pages</h2>
                                <Button variant="ghost" size="sm" onClick={addPage}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                            </div>
                            <div className="space-y-1">
                                {pages.map((p, i) => (
                                    <div
                                        key={p.id}
                                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer ${i === activePageIndex ? 'border-primary bg-[var(--st-bg-muted)]' : 'border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]/50'}`}
                                        onClick={() => { setActivePageIndex(i); setSelectedFieldId(null); }}
                                    >
                                        <span className="text-xs font-mono text-[var(--st-text-secondary)]">{i + 1}</span>
                                        <Input
                                            value={p.title}
                                            onChange={(e) => updatePage(i, { title: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-7 text-xs flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent p-0"
                                        />
                                        <span className="text-xs text-[var(--st-text-secondary)]">{p.fields.length}</span>
                                        {pages.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removePage(i); }}
                                                aria-label="Remove page"
                                                className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        <h2 className="text-sm font-semibold text-[var(--st-text)]">Fields on this page</h2>
                        <p className="text-xs text-[var(--st-text-secondary)]">Drag to reorder. Use the chevron to push a field to the next page.</p>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full">
                                    <Plus className="mr-2 h-4 w-4"/>Add Field
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {availableFieldTypes.map(field => (
                                     <DropdownMenuItem key={field.type} onSelect={() => addField(field.type)}>
                                        {field.label}
                                     </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                            <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-2">
                                    {fields.map((field) => (
                                        <SortableFieldItem
                                            key={field.id}
                                            field={field}
                                            isSelected={selectedFieldId === field.id}
                                            onClick={() => setSelectedFieldId(field.id)}
                                            onMove={() => moveFieldToPage(field.id, activePageIndex + 1)}
                                            canMove={activePageIndex < pages.length - 1}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
                <main className="col-span-6 bg-[var(--st-bg-muted)] overflow-y-auto p-4 md:p-8">
                    {pages.length > 1 && (
                        <div className="mb-4 flex items-center justify-center gap-2">
                            {pages.map((p, i) => (
                                <div key={p.id} className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded-full ${i === activePageIndex ? 'bg-[var(--st-text)] text-white' : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]'}`}>
                                        {i + 1}. {p.title}
                                    </span>
                                    {i < pages.length - 1 && <ChevronRight className="h-3 w-3 text-[var(--st-text-secondary)]" />}
                                </div>
                            ))}
                        </div>
                    )}
                    <CrmFormPreview settings={{ ...settings, fields }} />
                </main>
                 <aside className="col-span-3 border-l border-[var(--st-border)] p-4 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-[var(--st-text)]">Properties</h2>
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
                            otherFields={flatFields}
                        />
                    ) : (
                         <Tabs defaultValue="general">
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="style">Style</TabsTrigger>
                                <TabsTrigger value="theme">Theme</TabsTrigger>
                                <TabsTrigger value="post">After</TabsTrigger>
                            </TabsList>
                            <TabsContent value="general" className="mt-4">
                                <Accordion type="multiple" className="w-full" defaultValue={['general_settings']}>
                                    <AccordionItem value="general_settings">
                                        <AccordionTrigger>General Settings</AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="space-y-2"><Label>Form Title</Label><Input value={(settings.title as string) || 'Contact Us'} onChange={(e) => setSettings({...settings, title: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Form Description</Label><Textarea value={(settings.description as string) || ''} onChange={(e) => setSettings({...settings, description: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Submit Button Text</Label><Input value={(settings.submitButtonText as string) || 'Send Message'} onChange={(e) => setSettings({...settings, submitButtonText: e.target.value})} /></div>
                                            <div className="space-y-2"><Label>Footer Text (HTML allowed)</Label><Textarea value={(settings.footerText as string) || ''} onChange={(e) => setSettings({...settings, footerText: e.target.value})} /></div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </TabsContent>
                            <TabsContent value="style" className="mt-4">
                                 <StyleSettingsPanel settings={settings} onUpdate={setSettings} />
                            </TabsContent>
                            <TabsContent value="theme" className="mt-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Primary color</Label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={theme.primaryColor || '#2563eb'}
                                                onChange={(e) => setTheme({ primaryColor: e.target.value })}
                                                className="h-9 w-12 rounded border border-[var(--st-border)] bg-transparent"
                                                aria-label="Primary color"
                                            />
                                            <Input
                                                value={theme.primaryColor || ''}
                                                onChange={(e) => setTheme({ primaryColor: e.target.value })}
                                                placeholder="#2563eb"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Font family</Label>
                                        <Select
                                            value={theme.fontFamily || 'system'}
                                            onValueChange={(v) => setTheme({ fontFamily: v as ThemeSettings['fontFamily'] })}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="system">System</SelectItem>
                                                <SelectItem value="inter">Inter</SelectItem>
                                                <SelectItem value="roboto">Roboto</SelectItem>
                                                <SelectItem value="serif">Serif</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Border radius ({theme.borderRadius ?? 8}px)</Label>
                                        <Slider
                                            min={0}
                                            max={24}
                                            step={1}
                                            value={[theme.borderRadius ?? 8]}
                                            onValueChange={(v: number[]) => setTheme({ borderRadius: v[0] })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Logo</Label>
                                        {theme.logoFileUrl && (
                                            <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                                                <span className="truncate">{theme.logoFileUrl}</span>
                                                <Button variant="ghost" size="sm" onClick={() => setTheme({ logoFileId: undefined, logoFileUrl: undefined })}>Remove</Button>
                                            </div>
                                        )}
                                        <SabFilePickerButton
                                            accept="image"
                                            onPick={(p) => setTheme({ logoFileId: p.id, logoFileUrl: p.url })}
                                        >
                                            {theme.logoFileUrl ? 'Replace logo' : 'Pick logo'}
                                        </SabFilePickerButton>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Background</Label>
                                        {theme.backgroundFileUrl && (
                                            <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                                                <span className="truncate">{theme.backgroundFileUrl}</span>
                                                <Button variant="ghost" size="sm" onClick={() => setTheme({ backgroundFileId: undefined, backgroundFileUrl: undefined })}>Remove</Button>
                                            </div>
                                        )}
                                        <SabFilePickerButton
                                            accept="image"
                                            onPick={(p) => setTheme({ backgroundFileId: p.id, backgroundFileUrl: p.url })}
                                        >
                                            {theme.backgroundFileUrl ? 'Replace background' : 'Pick background'}
                                        </SabFilePickerButton>
                                    </div>
                                </div>
                            </TabsContent>
                            <TabsContent value="post" className="mt-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Success message</Label>
                                        <Textarea
                                            value={postSubmit.successMessage || (settings.successMessage as string) || 'Thank you! Your submission has been received.'}
                                            onChange={(e) => setPostSubmit({ successMessage: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Redirect URL (optional)</Label>
                                        <Input
                                            value={postSubmit.redirectUrl || ''}
                                            onChange={(e) => setPostSubmit({ redirectUrl: e.target.value })}
                                            placeholder="https://example.com/thanks"
                                        />
                                    </div>

                                    <Accordion type="multiple">
                                        <AccordionItem value="email">
                                            <AccordionTrigger>Email notifications</AccordionTrigger>
                                            <AccordionContent className="space-y-3 pt-2">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={emailNotifications.enabled}
                                                        onCheckedChange={(v) => setPostSubmit({ emailNotifications: { ...emailNotifications, enabled: v } })}
                                                    />
                                                    <Label>Send email on submit</Label>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>To (comma-separated)</Label>
                                                    <Input
                                                        value={emailNotifications.toEmails.join(', ')}
                                                        onChange={(e) => setPostSubmit({ emailNotifications: { ...emailNotifications, toEmails: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Subject</Label>
                                                    <Input
                                                        value={emailNotifications.subject}
                                                        onChange={(e) => setPostSubmit({ emailNotifications: { ...emailNotifications, subject: e.target.value } })}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Body template</Label>
                                                    <Textarea
                                                        value={emailNotifications.bodyTemplate}
                                                        onChange={(e) => setPostSubmit({ emailNotifications: { ...emailNotifications, bodyTemplate: e.target.value } })}
                                                        placeholder="Use {{fieldId}} for placeholders, e.g. New lead from {{name}} ({{email}})"
                                                    />
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                        <AccordionItem value="webhook">
                                            <AccordionTrigger>Webhook</AccordionTrigger>
                                            <AccordionContent className="space-y-3 pt-2">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={webhook.enabled}
                                                        onCheckedChange={(v) => setPostSubmit({ webhook: { ...webhook, enabled: v } })}
                                                    />
                                                    <Label>POST on submit</Label>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>URL</Label>
                                                    <Input
                                                        value={webhook.url}
                                                        onChange={(e) => setPostSubmit({ webhook: { ...webhook, url: e.target.value } })}
                                                        placeholder="https://your-app.com/hook"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Signing secret</Label>
                                                    <Input
                                                        value={webhook.secret}
                                                        onChange={(e) => setPostSubmit({ webhook: { ...webhook, secret: e.target.value } })}
                                                        placeholder="Used for HMAC-SHA256 in X-Form-Webhook-Signature"
                                                    />
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                        <AccordionItem value="auto">
                                            <AccordionTrigger>Auto-create in CRM</AccordionTrigger>
                                            <AccordionContent className="space-y-3 pt-2">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={autoCreate.lead}
                                                        onCheckedChange={(v) => setPostSubmit({ autoCreate: { ...autoCreate, lead: v } })}
                                                    />
                                                    <Label>Create lead/deal</Label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={autoCreate.contact}
                                                        onCheckedChange={(v) => setPostSubmit({ autoCreate: { ...autoCreate, contact: v } })}
                                                    />
                                                    <Label>Create contact</Label>
                                                </div>
                                                <div className="space-y-2 pt-2 border-t border-[var(--st-border)]">
                                                    <p className="text-xs text-[var(--st-text-secondary)]">Field mapping (CRM field → form field ID)</p>
                                                    {mappingTargets.map(target => (
                                                        <div key={target} className="grid grid-cols-2 gap-2 items-center">
                                                            <span className="text-xs font-mono">{target}</span>
                                                            <Select
                                                                value={autoCreate.mapping[target] || '__auto__'}
                                                                onValueChange={(val) => setPostSubmit({
                                                                    autoCreate: {
                                                                        ...autoCreate,
                                                                        mapping: { ...autoCreate.mapping, [target]: val === '__auto__' ? undefined : val },
                                                                    },
                                                                })}
                                                            >
                                                                <SelectTrigger className="h-8"><SelectValue placeholder="Auto"/></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="__auto__">Auto (use same name)</SelectItem>
                                                                    {flatFields.map(f => (
                                                                        <SelectItem key={f.id} value={f.fieldId || f.id}>{f.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    ))}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </aside>
            </div>
        </div>
    );
}
