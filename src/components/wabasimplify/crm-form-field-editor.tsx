'use client';

import {
    ZoruLabel,
    ZoruButton,
    ZoruInput,
    ZoruTextarea,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSwitch,
    ZoruAccordion,
    ZoruAccordionContent,
    ZoruAccordionItem,
    ZoruAccordionTrigger,
} from '@/components/zoruui';
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
                <ZoruLabel>Field Type</ZoruLabel>
                <ZoruSelect value={field.type} onValueChange={(val) => handleUpdate('type', val as FormField['type'])}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {FIELD_TYPE_OPTIONS.map(opt => (
                            <ZoruSelectItem key={opt.value} value={opt.value}>{opt.label}</ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="field-label">Label</ZoruLabel>
                <ZoruInput id="field-label" value={field.label} onChange={(e) => handleUpdate('label', e.target.value)} />
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="field-id">Field ID</ZoruLabel>
                <ZoruInput id="field-id" value={field.fieldId || ''} onChange={(e) => handleUpdate('fieldId', e.target.value)} placeholder="e.g., user_name"/>
                <p className="text-xs text-muted-foreground">A unique ID used for the form data (no spaces).</p>
            </div>
            {field.type !== 'html' && field.type !== 'hidden' && (
                <div className="space-y-2">
                    <ZoruLabel htmlFor="field-placeholder">Placeholder</ZoruLabel>
                    <ZoruInput id="field-placeholder" value={field.placeholder || ''} onChange={(e) => handleUpdate('placeholder', e.target.value)} />
                </div>
            )}
            <div className="space-y-2">
                <ZoruLabel htmlFor="field-description">Description</ZoruLabel>
                <ZoruInput id="field-description" value={field.description || ''} onChange={(e) => handleUpdate('description', e.target.value)} />
            </div>

            {(field.type === 'select' || field.type === 'radio') && (
                <div className="space-y-2">
                    <ZoruLabel htmlFor="field-options">Options (one per line)</ZoruLabel>
                    <ZoruTextarea id="field-options" value={field.options || ''} onChange={(e) => handleUpdate('options', e.target.value)} />
                </div>
            )}

            {field.type === 'rating' && (
                <div className="space-y-2">
                    <ZoruLabel htmlFor="field-max-rating">Max stars</ZoruLabel>
                    <ZoruInput
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
                <ZoruSwitch id="field-required" checked={!!field.required} onCheckedChange={(val) => handleUpdate('required', val)} />
                <ZoruLabel htmlFor="field-required">Required</ZoruLabel>
            </div>

            <ZoruAccordion type="single" collapsible>
                <ZoruAccordionItem value="validation">
                    <ZoruAccordionTrigger>Validation rules</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-3 pt-2">
                        {isStringy && (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <ZoruLabel>Min length</ZoruLabel>
                                    <ZoruInput
                                        type="number"
                                        value={validation.minLength ?? ''}
                                        onChange={(e) => updateValidation({ minLength: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <ZoruLabel>Max length</ZoruLabel>
                                    <ZoruInput
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
                                    <ZoruLabel>Min</ZoruLabel>
                                    <ZoruInput
                                        type="number"
                                        value={validation.min ?? ''}
                                        onChange={(e) => updateValidation({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <ZoruLabel>Max</ZoruLabel>
                                    <ZoruInput
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
                                    <ZoruLabel>Pattern (regex)</ZoruLabel>
                                    <ZoruInput
                                        value={validation.pattern ?? ''}
                                        onChange={(e) => updateValidation({ pattern: e.target.value || undefined })}
                                        placeholder="e.g. ^[A-Z]{2}\\d{4}$"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <ZoruLabel>Error message</ZoruLabel>
                                    <ZoruInput
                                        value={validation.errorMessage ?? ''}
                                        onChange={(e) => updateValidation({ errorMessage: e.target.value || undefined })}
                                    />
                                </div>
                            </>
                        )}
                        <div className="space-y-2 pt-2 border-t border-border">
                            <ZoruLabel>Require only if (cross-field)</ZoruLabel>
                            <ZoruSelect
                                value={validation.requireIf?.fieldId || '__none__'}
                                onValueChange={(val) => updateValidation({
                                    requireIf: val === '__none__'
                                        ? undefined
                                        : { fieldId: val, operator: validation.requireIf?.operator ?? 'isFilled', value: validation.requireIf?.value }
                                })}
                            >
                                <ZoruSelectTrigger><ZoruSelectValue placeholder="No conditional rule"/></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="__none__">-- None --</ZoruSelectItem>
                                    {otherFields.filter(f => f.id !== field.id && f.type !== 'html').map(f => (
                                        <ZoruSelectItem key={f.id} value={f.fieldId || f.id}>{f.label || f.fieldId || f.id}</ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            {validation.requireIf && (
                                <div className="grid grid-cols-2 gap-2">
                                    <ZoruSelect
                                        value={validation.requireIf.operator}
                                        onValueChange={(val) => updateValidation({ requireIf: { ...validation.requireIf!, operator: val as 'equals' | 'notEquals' | 'isFilled' } })}
                                    >
                                        <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="isFilled">is filled</ZoruSelectItem>
                                            <ZoruSelectItem value="equals">equals</ZoruSelectItem>
                                            <ZoruSelectItem value="notEquals">not equals</ZoruSelectItem>
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                    {validation.requireIf.operator !== 'isFilled' && (
                                        <ZoruInput
                                            placeholder="value"
                                            value={validation.requireIf.value ?? ''}
                                            onChange={(e) => updateValidation({ requireIf: { ...validation.requireIf!, value: e.target.value } })}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </ZoruAccordion>

            <ZoruButton variant="destructive" onClick={onRemove} className="w-full">
                Delete Field
            </ZoruButton>
        </div>
    );
}
