'use client';

import { Label, Button, Input, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/sabcrm/20ui';
import type { FormField, FormFieldValidation } from '@/lib/definitions';

interface CrmFormFieldEditorProps {
    field: FormField;
    onUpdate: (updatedField: Partial<FormField>) => void;
    onRemove: () => void;
    otherFields?: FormField[];
}

const FIELD_TYPE_OPTIONS: { value: FormField['type']; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number' },
    { value: 'select', label: 'Select' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'radio', label: 'Radio Group' },
    { value: 'date', label: 'Date' },
    { value: 'file', label: 'File Upload' },
    { value: 'address', label: 'Address' },
    { value: 'rating', label: 'Rating (Stars)' },
    { value: 'signature', label: 'Signature' },
    { value: 'acceptance', label: 'Acceptance' },
    { value: 'hidden', label: 'Hidden' },
    { value: 'html', label: 'HTML' },
];

// String types where minLength/maxLength make sense.
const STRING_TYPES = new Set<FormField['type']>([
    'text',
    'email',
    'phone',
    'tel',
    'url',
    'password',
    'textarea',
]);

const NUMERIC_TYPES = new Set<FormField['type']>(['number', 'rating']);

export function CrmFormFieldEditor({ field, onUpdate, onRemove, otherFields = [] }: CrmFormFieldEditorProps) {
    const handleUpdate = <K extends keyof FormField>(prop: K, value: FormField[K]) => {
        onUpdate({ [prop]: value } as Partial<FormField>);
    };

    const validation: FormFieldValidation = field.validation || {};
    const updateValidation = (patch: Partial<FormFieldValidation>) => {
        onUpdate({ validation: { ...validation, ...patch } });
    };

    const isStringy = STRING_TYPES.has(field.type);
    const isNumeric = NUMERIC_TYPES.has(field.type);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Field Type</Label>
                <Select value={field.type} onValueChange={(val) => handleUpdate('type', val as FormField['type'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {FIELD_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="field-label">Label</Label>
                <Input id="field-label" value={field.label} onChange={(e) => handleUpdate('label', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="field-id">Field ID</Label>
                <Input id="field-id" value={field.fieldId || ''} onChange={(e) => handleUpdate('fieldId', e.target.value)} placeholder="e.g., user_name"/>
                <p className="text-xs text-[var(--st-text-secondary)]">A unique ID used for the form data (no spaces).</p>
            </div>
            {field.type !== 'html' && field.type !== 'hidden' && (
                <div className="space-y-2">
                    <Label htmlFor="field-placeholder">Placeholder</Label>
                    <Input id="field-placeholder" value={field.placeholder || ''} onChange={(e) => handleUpdate('placeholder', e.target.value)} />
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="field-description">Description</Label>
                <Input id="field-description" value={field.description || ''} onChange={(e) => handleUpdate('description', e.target.value)} />
            </div>

            {(field.type === 'select' || field.type === 'radio') && (
                <div className="space-y-2">
                    <Label htmlFor="field-options">Options (one per line)</Label>
                    <Textarea id="field-options" value={field.options || ''} onChange={(e) => handleUpdate('options', e.target.value)} />
                </div>
            )}

            {field.type === 'rating' && (
                <div className="space-y-2">
                    <Label htmlFor="field-max-rating">Max stars</Label>
                    <Input
                        id="field-max-rating"
                        type="number"
                        min={3}
                        max={10}
                        value={field.maxRating ?? 5}
                        onChange={(e) => handleUpdate('maxRating', Number(e.target.value) || 5)}
                    />
                </div>
            )}

            <div className="flex items-center space-x-2">
                <Switch id="field-required" checked={!!field.required} onCheckedChange={(val) => handleUpdate('required', val)} />
                <Label htmlFor="field-required">Required</Label>
            </div>

            <Accordion type="single" collapsible>
                <AccordionItem value="validation">
                    <AccordionTrigger>Validation rules</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        {isStringy && (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label>Min length</Label>
                                    <Input
                                        type="number"
                                        value={validation.minLength ?? ''}
                                        onChange={(e) => updateValidation({ minLength: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Max length</Label>
                                    <Input
                                        type="number"
                                        value={validation.maxLength ?? ''}
                                        onChange={(e) => updateValidation({ maxLength: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                        )}
                        {isNumeric && (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label>Min</Label>
                                    <Input
                                        type="number"
                                        value={validation.min ?? ''}
                                        onChange={(e) => updateValidation({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Max</Label>
                                    <Input
                                        type="number"
                                        value={validation.max ?? ''}
                                        onChange={(e) => updateValidation({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                        )}
                        {isStringy && (
                            <>
                                <div className="space-y-1">
                                    <Label>Pattern (regex)</Label>
                                    <Input
                                        value={validation.pattern ?? ''}
                                        onChange={(e) => updateValidation({ pattern: e.target.value || undefined })}
                                        placeholder="e.g. ^[A-Z]{2}\\d{4}$"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Error message</Label>
                                    <Input
                                        value={validation.errorMessage ?? ''}
                                        onChange={(e) => updateValidation({ errorMessage: e.target.value || undefined })}
                                    />
                                </div>
                            </>
                        )}
                        <div className="space-y-2 pt-2 border-t border-[var(--st-border)]">
                            <Label>Require only if (cross-field)</Label>
                            <Select
                                value={validation.requireIf?.fieldId || '__none__'}
                                onValueChange={(val) => updateValidation({
                                    requireIf: val === '__none__'
                                        ? undefined
                                        : { fieldId: val, operator: validation.requireIf?.operator ?? 'isFilled', value: validation.requireIf?.value }
                                })}
                            >
                                <SelectTrigger><SelectValue placeholder="No conditional rule"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">-- None --</SelectItem>
                                    {otherFields.filter(f => f.id !== field.id && f.type !== 'html').map(f => (
                                        <SelectItem key={f.id} value={f.fieldId || f.id}>{f.label || f.fieldId || f.id}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {validation.requireIf && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Select
                                        value={validation.requireIf.operator}
                                        onValueChange={(val) => updateValidation({ requireIf: { ...validation.requireIf!, operator: val as 'equals' | 'notEquals' | 'isFilled' } })}
                                    >
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="isFilled">is filled</SelectItem>
                                            <SelectItem value="equals">equals</SelectItem>
                                            <SelectItem value="notEquals">not equals</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {validation.requireIf.operator !== 'isFilled' && (
                                        <Input
                                            placeholder="value"
                                            value={validation.requireIf.value ?? ''}
                                            onChange={(e) => updateValidation({ requireIf: { ...validation.requireIf!, value: e.target.value } })}
                                        />
                                    )}
                                </div>
                            )}

                            <div className="pt-2"></div>
                            <Label>Show only if (cross-field)</Label>
                            <Select
                                value={(validation as any).showIf?.fieldId || '__none__'}
                                onValueChange={(val) => updateValidation({
                                    showIf: val === '__none__'
                                        ? undefined
                                        : { fieldId: val, operator: (validation as any).showIf?.operator ?? 'isFilled', value: (validation as any).showIf?.value }
                                } as any)}
                            >
                                <SelectTrigger><SelectValue placeholder="Always show"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">-- Always show --</SelectItem>
                                    {otherFields.filter(f => f.id !== field.id && f.type !== 'html').map(f => (
                                        <SelectItem key={f.id} value={f.fieldId || f.id}>{f.label || f.fieldId || f.id}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {(validation as any).showIf && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Select
                                        value={(validation as any).showIf.operator}
                                        onValueChange={(val) => updateValidation({ showIf: { ...(validation as any).showIf!, operator: val as 'equals' | 'notEquals' | 'isFilled' } } as any)}
                                    >
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="isFilled">is filled</SelectItem>
                                            <SelectItem value="equals">equals</SelectItem>
                                            <SelectItem value="notEquals">not equals</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {(validation as any).showIf.operator !== 'isFilled' && (
                                        <Input
                                            placeholder="value"
                                            value={(validation as any).showIf.value ?? ''}
                                            onChange={(e) => updateValidation({ showIf: { ...(validation as any).showIf!, value: e.target.value } } as any)}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <Button variant="destructive" onClick={onRemove} className="w-full">
                Delete Field
            </Button>
        </div>
    );
}
