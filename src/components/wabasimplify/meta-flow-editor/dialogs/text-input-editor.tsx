
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
                <Label htmlFor="name">Name (ID)</Label>
                <Input
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
                <Label htmlFor="label">Label</Label>
                <Input id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="placeholder">Placeholder</Label>
                <Input id="placeholder" value={component.placeholder || ''} onChange={(e) => updateField('placeholder', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="helper-text">Helper Text</Label>
                <Input id="helper-text" value={component['helper-text'] || ''} onChange={(e) => updateField('helper-text', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="error-message">Error Message</Label>
                <Input id="error-message" value={component['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
            </div>

            {isTextInputComponent && (
                <div className="space-y-2">
                    <Label htmlFor="input-type">Input Type</Label>
                    <Select value={component['input-type'] || 'text'} onValueChange={(v) => updateField('input-type', v)}>
                        <SelectTrigger id="input-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="password">Password</SelectItem>
                            {/* 'phone' is sometimes supported but usually 'text' with regex is better or use PhoneNumber component if strictly needed, keeping standard types */}
                            <SelectItem value="phone">Phone</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="min-chars">Min Chars</Label>
                    <Input id="min-chars" type="number" value={component['min-chars'] ?? ''} onChange={e => updateField('min-chars', e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="max-chars">Max Chars</Label>
                    <Input id="max-chars" type="number" value={component['max-chars'] ?? ''} onChange={e => updateField('max-chars', e.target.value ? parseInt(e.target.value) : undefined)} />
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
