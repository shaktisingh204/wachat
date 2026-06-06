'use client';

import {
  Label,
  Button,
  Input,
  Textarea,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Separator,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Checkbox,
  RadioGroup,
  ZoruRadioGroupItem,
  Card,
} from '@/components/sabcrm/20ui/compat';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Tabs, ZoruTabsList as TabsList, ZoruTabsTrigger as TabsTrigger, ZoruTabsContent as TabsContent } from '@/components/sabcrm/20ui/compat';
import { Lightbulb } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { FormField } from '@/lib/definitions';

const iconNames = Object.keys(LucideIcons).filter(key => typeof (LucideIcons as any)[key] === 'object' && /^[A-Z]/.test(key));

const hoverAnimationOptions = [
    { value: 'none', label: 'None' }, { value: 'grow', label: 'Grow' }, { value: 'shrink', label: 'Shrink' },
    { value: 'pulse', label: 'Pulse' }, { value: 'bob', label: 'Bob' }, { value: 'wobbleHorizontal', label: 'Wobble Horizontal' },
];

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
        const newFields = [...fields, { id: uuidv4(), type: 'text', label: 'New Field', required: false, columnWidth: '100%', size: 'md', labelPosition: 'above' }];
        handleUpdate('fields', newFields);
    };

    const removeField = (index: number) => {
        const newFields = fields.filter((_: any, i: number) => i !== index);
        handleUpdate('fields', newFields);
    };
    
    const handleSubFieldUpdate = (mainField: string, subField: string, value: any, isNumber = false) => {
        const parsedValue = isNumber ? (value === '' ? undefined : Number(value)) : value;
        onUpdate({
            ...settings,
            [mainField]: {
                ...(settings[mainField] || {}),
                [subField]: parsedValue
            }
        });
    }
    
    const handleAttributeChange = (index: number, field: 'key' | 'value', value: string) => {
        const newAttributes = [...(settings.customAttributes || [])];
        newAttributes[index] = {...newAttributes[index], [field]: value};
        handleUpdate('customAttributes', newAttributes);
    }
    
    const addAttribute = () => {
        const newAttributes = [...(settings.customAttributes || []), {id: uuidv4(), key: '', value: ''}];
        handleUpdate('customAttributes', newAttributes);
    }

    const removeAttribute = (index: number) => {
        const newAttributes = (settings.customAttributes || []).filter((_: any, i:number) => i !== index);
        handleUpdate('customAttributes', newAttributes);
    }

    return (
        <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['general', 'fields', 'actions']}>
                    <ZoruAccordionItem value="general">
                        <ZoruAccordionTrigger>General</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Form Title</Label><Input value={settings.title || 'Contact Form'} onChange={(e) => handleUpdate('title', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Description</Label><Textarea value={settings.description || ''} onChange={(e) => handleUpdate('description', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Button ID</Label><Input value={settings.buttonId || ''} onChange={(e) => handleUpdate('buttonId', e.target.value)} placeholder="e.g. my-form-submit"/></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                     <ZoruAccordionItem value="fields">
                        <ZoruAccordionTrigger>Form Fields</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            {fields.map((field: FormField, index: number) => (
                                <Card key={field.id} className="relative bg-zoru-surface">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeField(index)}><Trash2 className="h-4 w-4 text-zoru-ink" /></Button>
                                    <Accordion type="single" collapsible className="w-full">
                                        <ZoruAccordionItem value="field-content" className="border-b-0">
                                            <ZoruAccordionTrigger className="p-3 text-sm">{field.label || `Field ${index+1}`}</ZoruAccordionTrigger>
                                            <ZoruAccordionContent className="px-3 pb-3 space-y-4">
                                                <div className="space-y-2"><Label>Type</Label><Select value={field.type} onValueChange={(val) => handleFieldChange(index, 'type', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="text">Text</ZoruSelectItem><ZoruSelectItem value="email">Email</ZoruSelectItem><ZoruSelectItem value="textarea">Text Area</ZoruSelectItem><ZoruSelectItem value="url">URL</ZoruSelectItem><ZoruSelectItem value="tel">Tel</ZoruSelectItem><ZoruSelectItem value="radio">Radio</ZoruSelectItem><ZoruSelectItem value="checkbox">Checkbox</ZoruSelectItem><ZoruSelectItem value="select">Select</ZoruSelectItem><ZoruSelectItem value="number">Number</ZoruSelectItem><ZoruSelectItem value="date">Date</ZoruSelectItem><ZoruSelectItem value="time">Time</ZoruSelectItem><ZoruSelectItem value="file">File Upload</ZoruSelectItem><ZoruSelectItem value="password">Password</ZoruSelectItem><ZoruSelectItem value="hidden">Hidden</ZoruSelectItem><ZoruSelectItem value="html">HTML</ZoruSelectItem><ZoruSelectItem value="acceptance">Acceptance</ZoruSelectItem></ZoruSelectContent></Select></div>
                                                <div className="space-y-2"><Label>Label</Label><Input value={field.label} onChange={(e) => handleFieldChange(index, 'label', e.target.value)} placeholder="e.g., Your Name" /></div>
                                                <div className="space-y-2"><Label>Field ID (for `name` attribute)</Label><Input value={field.fieldId || ''} onChange={(e) => handleFieldChange(index, 'fieldId', e.target.value)} placeholder="e.g., user_name"/></div>
                                                <div className="space-y-2"><Label>Placeholder</Label><Input value={field.placeholder || ''} onChange={(e) => handleFieldChange(index, 'placeholder', e.target.value)} /></div>
                                                <div className="space-y-2"><Label>Default Value</Label><Input value={field.defaultValue || ''} onChange={(e) => handleFieldChange(index, 'defaultValue', e.target.value)} /></div>
                                                <div className="space-y-2"><Label>Description</Label><Input value={field.description || ''} onChange={(e) => handleFieldChange(index, 'description', e.target.value)} /></div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Label Position</Label><Select value={field.labelPosition || 'above'} onValueChange={(val) => handleFieldChange(index, 'labelPosition', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="above">Above</ZoruSelectItem><ZoruSelectItem value="inline">Inline</ZoruSelectItem><ZoruSelectItem value="hidden">Hidden</ZoruSelectItem></ZoruSelectContent></Select></div>
                                                    <div className="space-y-2"><Label>Field Size</Label><Select value={field.size || 'md'} onValueChange={(val) => handleFieldChange(index, 'size', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></Select></div>
                                                </div>
                                                <div className="space-y-2"><Label>Column Width</Label><Select value={field.columnWidth || '100%'} onValueChange={(val) => handleFieldChange(index, 'columnWidth', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="100%">100%</ZoruSelectItem><ZoruSelectItem value="50%">50%</ZoruSelectItem><ZoruSelectItem value="33.33%">33%</ZoruSelectItem><ZoruSelectItem value="25%">25%</ZoruSelectItem></ZoruSelectContent></Select></div>
                                                <div className="flex items-center space-x-2 pt-2"><Switch id={`required-${field.id}`} checked={field.required} onCheckedChange={(val) => handleFieldChange(index, 'required', val)} /><Label htmlFor={`required-${field.id}`}>Required</Label></div>
                                                {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && <div className="space-y-2"><Label>Options (one per line)</Label><Textarea value={field.options || ''} onChange={(e) => handleFieldChange(index, 'options', e.target.value)} /></div>}
                                                {field.type === 'select' && <div className="flex items-center space-x-2 pt-2"><Switch id={`multiple-${field.id}`} checked={field.multiple} onCheckedChange={(val) => handleFieldChange(index, 'multiple', val)} /><Label htmlFor={`multiple-${field.id}`}>Multiple Selection</Label></div>}
                                                {field.type === 'file' && <><div className="space-y-2"><Label>Max File Size (MB)</Label><Input type="number" value={field.maxFileSize || 5} onChange={(e) => handleFieldChange(index, 'maxFileSize', Number(e.target.value))} /></div><div className="space-y-2"><Label>Allowed File Types</Label><Input value={field.allowedFileTypes || ''} onChange={(e) => handleFieldChange(index, 'allowedFileTypes', e.target.value)} placeholder="e.g. jpg, png, pdf" /></div><div className="flex items-center space-x-2 pt-2"><Switch id={`multiple-files-${field.id}`} checked={field.multiple} onCheckedChange={(val) => handleFieldChange(index, 'multiple', val)} /><Label htmlFor={`multiple-files-${field.id}`}>Allow Multiple Files</Label></div></>}
                                                {field.type === 'html' && <div className="space-y-2"><Label>HTML Content</Label><Textarea value={field.htmlContent || ''} onChange={(e) => handleFieldChange(index, 'htmlContent', e.target.value)} /></div>}
                                                {field.type === 'acceptance' && <div className="space-y-2"><Label>Acceptance Text</Label><Input value={field.defaultValue || 'I agree to the terms and conditions'} onChange={(e) => handleFieldChange(index, 'defaultValue', e.target.value)} /></div>}
                                            </ZoruAccordionContent>
                                        </ZoruAccordionItem>
                                    </Accordion>
                                </Card>
                            ))}
                            <Button type="button" variant="outline" onClick={addField}><Plus className="mr-2 h-4 w-4" /> Add Field</Button>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="submit_button">
                        <ZoruAccordionTrigger>Submit Button</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Text</Label><Input value={settings.submitButtonText || 'Submit'} onChange={(e) => handleUpdate('submitButtonText', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Size</Label><Select value={settings.buttonSize || 'md'} onValueChange={v => handleUpdate('buttonSize', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></Select></div>
                            <div className="space-y-2"><Label>Icon</Label><Select value={settings.buttonIcon || ''} onValueChange={(val) => handleUpdate('buttonIcon', val)}><ZoruSelectTrigger><ZoruSelectValue placeholder="No Icon"/></ZoruSelectTrigger><ZoruSelectContent>{iconNames.map(iconName => (<ZoruSelectItem key={iconName} value={iconName}>{iconName}</ZoruSelectItem>))}</ZoruSelectContent></Select></div>
                            <div className="space-y-2"><Label>Icon Position</Label><Select value={settings.buttonIconPosition || 'left'} onValueChange={(val) => handleUpdate('buttonIconPosition', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="left">Before</ZoruSelectItem><ZoruSelectItem value="right">After</ZoruSelectItem></ZoruSelectContent></Select></div>
                             <div className="space-y-2"><Label>Icon Spacing (px)</Label><Input type="number" value={settings.buttonIconSpacing || 8} onChange={e => handleUpdate('buttonIconSpacing', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Alignment</Label><Select value={settings.buttonAlign || 'flex-start'} onValueChange={v => handleUpdate('buttonAlign', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="flex-start">Left</ZoruSelectItem><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="flex-end">Right</ZoruSelectItem><ZoruSelectItem value="stretch">Justify (full width)</ZoruSelectItem></ZoruSelectContent></Select></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="actions">
                        <ZoruAccordionTrigger>Actions After Submit</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <Alert><Lightbulb className="h-4 w-4"/><ZoruAlertTitle>Note</ZoruAlertTitle><ZoruAlertDescription>Form submissions automatically create/update CRM contacts. Additional actions can be configured here.</ZoruAlertDescription></Alert>
                            <div className="space-y-2"><Label>Webhook URL</Label><Input type="url" value={settings.webhookUrl || ''} onChange={(e) => handleUpdate('webhookUrl', e.target.value)} placeholder="https://api.example.com/form" /></div>
                            <div className="space-y-2"><Label>Success Message</Label><Textarea value={settings.successMessage || 'Thank you! Your submission has been received.'} onChange={(e) => handleUpdate('successMessage', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Redirect URL (Optional)</Label><Input type="url" value={settings.redirectUrl || ''} onChange={(e) => handleUpdate('redirectUrl', e.target.value)} placeholder="https://example.com/thank-you" /></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                 </Accordion>
            </TabsContent>

             <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_fields', 'style_button']}>
                    <ZoruAccordionItem value="style_fields">
                        <ZoruAccordionTrigger>Form Fields</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Spacing between fields (px)</Label><Input type="number" value={settings.fieldSpacing || '24'} onChange={e => handleUpdate('fieldSpacing', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Typography</Label><Select value={settings.fieldTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('fieldTypography', 'fontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="sans-serif">Sans-serif</ZoruSelectItem><ZoruSelectItem value="serif">Serif</ZoruSelectItem></ZoruSelectContent></Select></div>
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.fieldColor || '#333333'} onChange={e => handleUpdate('fieldColor', e.target.value)} /></div><div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.fieldBgColor || '#FFFFFF'} onChange={e => handleUpdate('fieldBgColor', e.target.value)} /></div></div>
                             <div className="space-y-2"><Label>Border Type</Label><Select value={settings.fieldBorderType || 'solid'} onValueChange={v => handleUpdate('fieldBorderType', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem><ZoruSelectItem value="dotted">Dotted</ZoruSelectItem></ZoruSelectContent></Select></div>
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Border Width (px)</Label><Input type="number" value={settings.fieldBorderWidth || '1'} onChange={e => handleUpdate('fieldBorderWidth', e.target.value)} /></div><div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" value={settings.fieldBorderRadius || '8'} onChange={e => handleUpdate('fieldBorderRadius', e.target.value)} /></div></div>
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Border Color</Label><Input type="color" value={settings.fieldBorderColor || '#e5e7eb'} onChange={e => handleUpdate('fieldBorderColor', e.target.value)} /></div><div className="space-y-2"><Label>Focus Border Color</Label><Input type="color" value={settings.fieldFocusBorderColor || '#2563eb'} onChange={e => handleUpdate('fieldFocusBorderColor', e.target.value)} /></div></div>
                             <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" value={settings.fieldPadding || '12'} onChange={e => handleUpdate('fieldPadding', e.target.value)} /></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_labels">
                        <ZoruAccordionTrigger>Labels</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.labelColor || '#111827'} onChange={e => handleUpdate('labelColor', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Spacing below label (px)</Label><Input type="number" value={settings.labelSpacing || '8'} onChange={e => handleUpdate('labelSpacing', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Typography</Label><Select value={settings.labelTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('labelTypography', 'fontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="sans-serif">Sans-serif</ZoruSelectItem><ZoruSelectItem value="serif">Serif</ZoruSelectItem></ZoruSelectContent></Select></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_description">
                        <ZoruAccordionTrigger>Field Description</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.descriptionColor || '#64748b'} onChange={e => handleUpdate('descriptionColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Typography</Label><Select value={settings.descriptionTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('descriptionTypography', 'fontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="sans-serif">Sans-serif</ZoruSelectItem><ZoruSelectItem value="serif">Serif</ZoruSelectItem></ZoruSelectContent></Select></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_button">
                        <ZoruAccordionTrigger>Submit Button</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Typography</Label><Select value={settings.buttonTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('buttonTypography', 'fontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="sans-serif">Sans-serif</ZoruSelectItem><ZoruSelectItem value="serif">Serif</ZoruSelectItem></ZoruSelectContent></Select></div>
                             <Tabs defaultValue="normal">
                                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="normal">Normal</TabsTrigger><TabsTrigger value="hover">Hover</TabsTrigger></TabsList>
                                <TabsContent value="normal" className="pt-4 space-y-4">
                                     <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.buttonColor || '#FFFFFF'} onChange={e => handleUpdate('buttonColor', e.target.value)} /></div><div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.buttonBgColor || '#16a34a'} onChange={e => handleUpdate('buttonBgColor', e.target.value)} /></div></div>
                                </TabsContent>
                                <TabsContent value="hover" className="pt-4 space-y-4">
                                     <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Hover Text</Label><Input type="color" value={settings.buttonHoverColor || '#FFFFFF'} onChange={e => handleUpdate('buttonHoverColor', e.target.value)} /></div><div className="space-y-2"><Label>Hover Background</Label><Input type="color" value={settings.buttonHoverBgColor || '#15803d'} onChange={e => handleUpdate('buttonHoverBgColor', e.target.value)} /></div></div>
                                </TabsContent>
                             </Tabs>
                             <div className="space-y-2"><Label>Border Type</Label><Select value={settings.buttonBorderType || 'none'} onValueChange={v => handleUpdate('buttonBorderType', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem><ZoruSelectItem value="dotted">Dotted</ZoruSelectItem></ZoruSelectContent></Select></div>
                             <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" value={settings.buttonBorderRadius || '8'} onChange={e => handleUpdate('buttonBorderRadius', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" value={settings.buttonPadding || '16'} onChange={e => handleUpdate('buttonPadding', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.buttonBoxShadow || 'none'} onValueChange={v => handleUpdate('buttonBoxShadow', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></Select></div>
                             <div className="space-y-2"><Label>Icon Size (px)</Label><Input type="number" value={settings.buttonIconSize || '16'} onChange={e => handleUpdate('buttonIconSize', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Hover Animation</Label><Select value={settings.buttonHoverAnimation || 'none'} onValueChange={v => handleUpdate('buttonHoverAnimation', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent>{hoverAnimationOptions.map(opt => <ZoruSelectItem key={opt.value} value={opt.value}>{opt.label}</ZoruSelectItem>)}</ZoruSelectContent></Select></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </Accordion>
            </TabsContent>
            
            <TabsContent value="advanced" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['advanced_spacing']}>
                    <ZoruAccordionItem value="advanced_spacing">
                        <ZoruAccordionTrigger>Spacing</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Margin (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><Input type="number" placeholder="R" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} /><Input type="number" placeholder="B" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /><Input type="number" placeholder="L" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} /></div></div>
                             <div className="space-y-2"><Label>Padding (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.padding?.top ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><Input type="number" placeholder="R" value={settings.padding?.right ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><Input type="number" placeholder="B" value={settings.padding?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><Input type="number" placeholder="L" value={settings.padding?.left ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_motion">
                        <ZoruAccordionTrigger>Motion Effects</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="fadeIn">Fade In</ZoruSelectItem><ZoruSelectItem value="fadeInUp">Fade In Up</ZoruSelectItem></ZoruSelectContent></Select></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_responsive">
                        <ZoruAccordionTrigger>Responsive</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <Label>Visibility</Label>
                            <div className="flex flex-col gap-2 rounded-md border p-3">
                                <div className="flex items-center justify-between"><Label htmlFor="showOnDesktop" className="font-normal">Show on Desktop</Label><Switch id="showOnDesktop" checked={settings.responsiveVisibility?.desktop !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'desktop', val)} /></div>
                                <div className="flex items-center justify-between"><Label htmlFor="showOnTablet" className="font-normal">Show on Tablet</Label><Switch id="showOnTablet" checked={settings.responsiveVisibility?.tablet !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'tablet', val)} /></div>
                                <div className="flex items-center justify-between"><Label htmlFor="showOnMobile" className="font-normal">Show on Mobile</Label><Switch id="showOnMobile" checked={settings.responsiveVisibility?.mobile !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'mobile', val)} /></div>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_attributes">
                        <ZoruAccordionTrigger>Attributes</ZoruAccordionTrigger>
                         <ZoruAccordionContent className="space-y-4 pt-2">
                             {(settings.customAttributes || []).map((attr: any, index: number) => (
                                 <div key={attr.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center"><Input placeholder="Key" value={attr.key} onChange={e => handleAttributeChange(index, 'key', e.target.value)} /><Input placeholder="Value" value={attr.value} onChange={e => handleAttributeChange(index, 'value', e.target.value)} /><Button type="button" variant="ghost" size="icon" onClick={() => removeAttribute(index)}><Trash2 className="h-4 w-4 text-zoru-ink"/></Button></div>
                             ))}
                             <Button type="button" variant="outline" className="w-full" onClick={addAttribute}><Plus className="mr-2 h-4 w-4"/>Add Attribute</Button>
                         </ZoruAccordionContent>
                    </ZoruAccordionItem>
                     <ZoruAccordionItem value="advanced_custom">
                        <ZoruAccordionTrigger>Custom CSS</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>CSS ID</Label><Input value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div>
                            <div className="space-y-2"><Label>CSS Classes</Label><Input value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Custom CSS</Label><Textarea value={settings.customCss || ''} onChange={e => handleUpdate('customCss', e.target.value)} className="font-mono" placeholder={`selector {\n  color: red;\n}`}/></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </Accordion>
             </TabsContent>
        </Tabs>
    );
}

    