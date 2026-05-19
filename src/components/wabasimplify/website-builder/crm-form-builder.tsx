'use client';

import {
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruSwitch,
  ZoruTextarea,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruAccordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
} from '@/components/zoruui';
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
import { ClayCard } from '@/components/clay';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Plus, ArrowLeft, Save, LoaderCircle, Eye, Code2, GripVertical, X, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { CrmFormFieldEditor } from '@/components/wabasimplify/crm-form-field-editor';
import { SabFilePickerButton } from '@/components/sabfiles';
import { saveCrmForm } from '@/app/actions/crm-forms.actions';
import { CrmFormPreview } from '@/components/wabasimplify/crm-form-preview';
import type { WithId,
  CrmForm,
  FormField,
  FormPage } from '@/lib/definitions';
import { useRouter } from 'next/navigation';
import { StyleSettingsPanel } from '@/components/wabasimplify/website-builder/style-settings-panel';
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
            <ClayCard
                variant="soft"
                padded={false}
                className={`p-3 cursor-pointer hover:bg-secondary flex items-center gap-2 ${isSelected ? 'ring-2 ring-primary' : ''}`}
                onClick={onClick}
            >
                <button
                    type="button"
                    className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
                    {...attributes}
                    {...listeners}
                    aria-label="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                        {field.label || 'Untitled Field'} {field.required && '*'}
                    </p>
                    <p className="text-xs text-muted-foreground">{field.type}</p>
                </div>
                {canMove && onMove && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMove(); }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                        aria-label="Move to next page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                )}
            </ClayCard>
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
                        {/* Pages strip */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-foreground">Pages</h2>
                                <ZoruButton variant="ghost" size="sm" onClick={addPage}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </ZoruButton>
                            </div>
                            <div className="space-y-1">
                                {pages.map((p, i) => (
                                    <div
                                        key={p.id}
                                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer ${i === activePageIndex ? 'border-primary bg-secondary' : 'border-border hover:bg-secondary/50'}`}
                                        onClick={() => { setActivePageIndex(i); setSelectedFieldId(null); }}
                                    >
                                        <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
                                        <ZoruInput
                                            value={p.title}
                                            onChange={(e) => updatePage(i, { title: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-7 text-xs flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent p-0"
                                        />
                                        <span className="text-xs text-muted-foreground">{p.fields.length}</span>
                                        {pages.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removePage(i); }}
                                                aria-label="Remove page"
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-border" />

                        <h2 className="text-sm font-semibold text-foreground">Fields on this page</h2>
                        <p className="text-xs text-muted-foreground">Drag to reorder. Use the chevron to push a field to the next page.</p>
                         <ZoruDropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <ZoruButton variant="outline" size="sm" className="w-full">
                                    <Plus className="mr-2 h-4 w-4"/>Add Field
                                </ZoruButton>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent>
                                {availableFieldTypes.map(field => (
                                     <ZoruDropdownMenuItem key={field.type} onSelect={() => addField(field.type)}>
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
                                            onMove={() => moveFieldToPage(field.id, activePageIndex + 1)}
                                            canMove={activePageIndex < pages.length - 1}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
                <main className="col-span-6 bg-secondary overflow-y-auto p-4 md:p-8">
                    {pages.length > 1 && (
                        <div className="mb-4 flex items-center justify-center gap-2">
                            {pages.map((p, i) => (
                                <div key={p.id} className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded-full ${i === activePageIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                        {i + 1}. {p.title}
                                    </span>
                                    {i < pages.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                </div>
                            ))}
                        </div>
                    )}
                    <CrmFormPreview settings={{ ...settings, fields }} />
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
                                <ZoruAccordion type="multiple" className="w-full" defaultValue={['general_settings']}>
                                    <ZoruAccordionItem value="general_settings">
                                        <ZoruAccordionTrigger>General Settings</ZoruAccordionTrigger>
                                        <ZoruAccordionContent className="space-y-4 pt-2">
                                            <div className="space-y-2"><ZoruLabel>Form Title</ZoruLabel><ZoruInput value={(settings.title as string) || 'Contact Us'} onChange={(e) => setSettings({...settings, title: e.target.value})} /></div>
                                            <div className="space-y-2"><ZoruLabel>Form Description</ZoruLabel><ZoruTextarea value={(settings.description as string) || ''} onChange={(e) => setSettings({...settings, description: e.target.value})} /></div>
                                            <div className="space-y-2"><ZoruLabel>Submit Button Text</ZoruLabel><ZoruInput value={(settings.submitButtonText as string) || 'Send Message'} onChange={(e) => setSettings({...settings, submitButtonText: e.target.value})} /></div>
                                            <div className="space-y-2"><ZoruLabel>Footer Text (HTML allowed)</ZoruLabel><ZoruTextarea value={(settings.footerText as string) || ''} onChange={(e) => setSettings({...settings, footerText: e.target.value})} /></div>
                                        </ZoruAccordionContent>
                                    </ZoruAccordionItem>
                                </ZoruAccordion>
                            </TabsContent>
                            <TabsContent value="style" className="mt-4">
                                 <StyleSettingsPanel settings={settings} onUpdate={setSettings} />
                            </TabsContent>
                            <TabsContent value="theme" className="mt-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <ZoruLabel>Primary color</ZoruLabel>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={theme.primaryColor || '#2563eb'}
                                                onChange={(e) => setTheme({ primaryColor: e.target.value })}
                                                className="h-9 w-12 rounded border border-border bg-transparent"
                                                aria-label="Primary color"
                                            />
                                            <ZoruInput
                                                value={theme.primaryColor || ''}
                                                onChange={(e) => setTheme({ primaryColor: e.target.value })}
                                                placeholder="#2563eb"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel>Font family</ZoruLabel>
                                        <ZoruSelect
                                            value={theme.fontFamily || 'system'}
                                            onValueChange={(v) => setTheme({ fontFamily: v as ThemeSettings['fontFamily'] })}
                                        >
                                            <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="system">System</ZoruSelectItem>
                                                <ZoruSelectItem value="inter">Inter</ZoruSelectItem>
                                                <ZoruSelectItem value="roboto">Roboto</ZoruSelectItem>
                                                <ZoruSelectItem value="serif">Serif</ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </ZoruSelect>
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel>Border radius ({theme.borderRadius ?? 8}px)</ZoruLabel>
                                        <Slider
                                            min={0}
                                            max={24}
                                            step={1}
                                            value={[theme.borderRadius ?? 8]}
                                            onValueChange={(v: number[]) => setTheme({ borderRadius: v[0] })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel>Logo</ZoruLabel>
                                        {theme.logoFileUrl && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="truncate">{theme.logoFileUrl}</span>
                                                <ZoruButton variant="ghost" size="sm" onClick={() => setTheme({ logoFileId: undefined, logoFileUrl: undefined })}>Remove</ZoruButton>
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
                                        <ZoruLabel>Background</ZoruLabel>
                                        {theme.backgroundFileUrl && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="truncate">{theme.backgroundFileUrl}</span>
                                                <ZoruButton variant="ghost" size="sm" onClick={() => setTheme({ backgroundFileId: undefined, backgroundFileUrl: undefined })}>Remove</ZoruButton>
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
                                        <ZoruLabel>Success message</ZoruLabel>
                                        <ZoruTextarea
                                            value={postSubmit.successMessage || (settings.successMessage as string) || 'Thank you! Your submission has been received.'}
                                            onChange={(e) => setPostSubmit({ successMessage: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel>Redirect URL (optional)</ZoruLabel>
                                        <ZoruInput
                                            value={postSubmit.redirectUrl || ''}
                                            onChange={(e) => setPostSubmit({ redirectUrl: e.target.value })}
                                            placeholder="https://example.com/thanks"
                                        />
                                    </div>

                                    <ZoruAccordion type="multiple">
                                        <ZoruAccordionItem value="email">
                                            <ZoruAccordionTrigger>Email notifications</ZoruAccordionTrigger>
                                            <ZoruAccordionContent className="space-y-3 pt-2">
                                                <div className="flex items-center gap-2">
                                                    <ZoruSwitch
                                                        checked={emailNotifications.enabled}
                                                        onCheckedChange={(v) => setPostSubmit({ emailNotifications: { ...emailNotifications, enabled: v } })}
                                                    />
                                                    <ZoruLabel>Send email on submit</ZoruLabel>
                                                </div>
                                                <div className="space-y-1">
                                                    <ZoruLabel>To (comma-separated)</ZoruLabel>
                                                    <ZoruInput
                                                        value={emailNotifications.toEmails.join(', ')}
                                                        onChange={(e) => setPostSubmit({ emailNotifications: { ...emailNotifications, toEmails: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <ZoruLabel>Subject</ZoruLabel>
                                                    <ZoruInput
                                                        value={emailNotifications.subject}
                                                        onChange={(e) => setPostSubmit({ emailNotifications: { ...emailNotifications, subject: e.target.value } })}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <ZoruLabel>Body template</ZoruLabel>
                                                    <ZoruTextarea
                                                        value={emailNotifications.bodyTemplate}
                                                        onChange={(e) => setPostSubmit({ emailNotifications: { ...emailNotifications, bodyTemplate: e.target.value } })}
                                                        placeholder="Use {{fieldId}} for placeholders, e.g. New lead from {{name}} ({{email}})"
                                                    />
                                                </div>
                                            </ZoruAccordionContent>
                                        </ZoruAccordionItem>
                                        <ZoruAccordionItem value="webhook">
                                            <ZoruAccordionTrigger>Webhook</ZoruAccordionTrigger>
                                            <ZoruAccordionContent className="space-y-3 pt-2">
                                                <div className="flex items-center gap-2">
                                                    <ZoruSwitch
                                                        checked={webhook.enabled}
                                                        onCheckedChange={(v) => setPostSubmit({ webhook: { ...webhook, enabled: v } })}
                                                    />
                                                    <ZoruLabel>POST on submit</ZoruLabel>
                                                </div>
                                                <div className="space-y-1">
                                                    <ZoruLabel>URL</ZoruLabel>
                                                    <ZoruInput
                                                        value={webhook.url}
                                                        onChange={(e) => setPostSubmit({ webhook: { ...webhook, url: e.target.value } })}
                                                        placeholder="https://your-app.com/hook"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <ZoruLabel>Signing secret</ZoruLabel>
                                                    <ZoruInput
                                                        value={webhook.secret}
                                                        onChange={(e) => setPostSubmit({ webhook: { ...webhook, secret: e.target.value } })}
                                                        placeholder="Used for HMAC-SHA256 in X-Form-Webhook-Signature"
                                                    />
                                                </div>
                                            </ZoruAccordionContent>
                                        </ZoruAccordionItem>
                                        <ZoruAccordionItem value="auto">
                                            <ZoruAccordionTrigger>Auto-create in CRM</ZoruAccordionTrigger>
                                            <ZoruAccordionContent className="space-y-3 pt-2">
                                                <div className="flex items-center gap-2">
                                                    <ZoruSwitch
                                                        checked={autoCreate.lead}
                                                        onCheckedChange={(v) => setPostSubmit({ autoCreate: { ...autoCreate, lead: v } })}
                                                    />
                                                    <ZoruLabel>Create lead/deal</ZoruLabel>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <ZoruSwitch
                                                        checked={autoCreate.contact}
                                                        onCheckedChange={(v) => setPostSubmit({ autoCreate: { ...autoCreate, contact: v } })}
                                                    />
                                                    <ZoruLabel>Create contact</ZoruLabel>
                                                </div>
                                                <div className="space-y-2 pt-2 border-t border-border">
                                                    <p className="text-xs text-muted-foreground">Field mapping (CRM field → form field ID)</p>
                                                    {mappingTargets.map(target => (
                                                        <div key={target} className="grid grid-cols-2 gap-2 items-center">
                                                            <span className="text-xs font-mono">{target}</span>
                                                            <ZoruSelect
                                                                value={autoCreate.mapping[target] || '__auto__'}
                                                                onValueChange={(val) => setPostSubmit({
                                                                    autoCreate: {
                                                                        ...autoCreate,
                                                                        mapping: { ...autoCreate.mapping, [target]: val === '__auto__' ? undefined : val },
                                                                    },
                                                                })}
                                                            >
                                                                <ZoruSelectTrigger className="h-8"><ZoruSelectValue placeholder="Auto"/></ZoruSelectTrigger>
                                                                <ZoruSelectContent>
                                                                    <ZoruSelectItem value="__auto__">Auto (use same name)</ZoruSelectItem>
                                                                    {flatFields.map(f => (
                                                                        <ZoruSelectItem key={f.id} value={f.fieldId || f.id}>{f.label}</ZoruSelectItem>
                                                                    ))}
                                                                </ZoruSelectContent>
                                                            </ZoruSelect>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ZoruAccordionContent>
                                        </ZoruAccordionItem>
                                    </ZoruAccordion>
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </aside>
            </div>
        </div>
    );
}
