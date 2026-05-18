'use client';

import { ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';

interface TextInputEditorProps {
    component: any;
    updateField: (key: string, value: any) => void;
}

export function TextInputEditor({ component, updateField }: TextInputEditorProps) {
    const isTextAreaComponent = component.type === 'TextArea';
    const isTextInputComponent = component.type === 'TextInput';

    // Note: Parameter 'init-value' is not a standard property multiple documentation sources. 
    // Data is pre-filled if the 'name' matches a key in the input data.

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <ZoruLabel htmlFor="name">Name (ID)</ZoruLabel>
                <ZoruInput
                    id="name"
                    value={component.name || ''}
                    onChange={(e) => updateField('name', e.target.value)}
                    required
                    className="font-mono bg-muted/50"
                    placeholder="field_name"
                />
                <p className="text-[10px] text-muted-foreground">Unique ID for data binding.</p>
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="label">ZoruLabel</ZoruLabel>
                <ZoruInput id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="placeholder">Placeholder</ZoruLabel>
                <ZoruInput id="placeholder" value={component.placeholder || ''} onChange={(e) => updateField('placeholder', e.target.value)} />
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="helper-text">Helper Text</ZoruLabel>
                <ZoruInput id="helper-text" value={component['helper-text'] || ''} onChange={(e) => updateField('helper-text', e.target.value)} />
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="error-message">Error Message</ZoruLabel>
                <ZoruInput id="error-message" value={component['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
            </div>

            {isTextInputComponent && (
                <div className="space-y-2">
                    <ZoruLabel htmlFor="input-type">ZoruInput Type</ZoruLabel>
                    <ZoruSelect value={component['input-type'] || 'text'} onValueChange={(v) => updateField('input-type', v)}>
                        <ZoruSelectTrigger id="input-type"><ZoruSelectValue /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="text">Text</ZoruSelectItem>
                            <ZoruSelectItem value="number">Number</ZoruSelectItem>
                            <ZoruSelectItem value="email">Email</ZoruSelectItem>
                            <ZoruSelectItem value="password">Password</ZoruSelectItem>
                            {/* 'phone' is sometimes supported but usually 'text' with regex is better or use PhoneNumber component if strictly needed, keeping standard types */}
                            <ZoruSelectItem value="phone">Phone</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>
            )}

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="min-chars">Min Chars</ZoruLabel>
                    <ZoruInput id="min-chars" type="number" value={component['min-chars'] ?? ''} onChange={e => updateField('min-chars', e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="max-chars">Max Chars</ZoruLabel>
                    <ZoruInput id="max-chars" type="number" value={component['max-chars'] ?? ''} onChange={e => updateField('max-chars', e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <DynamicBooleanInput label="Required" value={component.required} onChange={v => updateField('required', v)} />
                <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
            </div>

            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
        </div>
    );
}
