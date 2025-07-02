
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';

interface TextInputEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

export function TextInputEditor({ component, updateField }: TextInputEditorProps) {
    const isTextAreaComponent = component.type === 'TextArea';
    const isTextInputComponent = component.type === 'TextInput';
    
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name (unique identifier)</Label>
                <Input id="name" value={component.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="label">Label (shown to user)</Label>
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
                            <SelectItem value="phone">Phone</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="min-length">Min Length</Label>
                    <Input id="min-length" type="number" value={component['min-length'] ?? ''} onChange={e => updateField('min-length', e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="max-length">Max Length</Label>
                    <Input id="max-length" type="number" value={component['max-length'] ?? ''} onChange={e => updateField('max-length', e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
            </div>
            <DynamicBooleanInput label="Required" value={component.required} onChange={v => updateField('required', v)} />
            <div className="space-y-2">
                <Label htmlFor="init-value">Initial Value (optional)</Label>
                <Input id="init-value" value={component['init-value'] || ''} onChange={(e) => updateField('init-value', e.target.value)} />
            </div>
            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
            <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
        </div>
    );
}
