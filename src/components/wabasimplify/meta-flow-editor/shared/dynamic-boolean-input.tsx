'use client';

import { Label, RadioGroup, ZoruRadioGroupItem, Input } from '@/components/zoruui';
export const DynamicBooleanInput = ({ label, description, value, onChange, placeholder = "e.g. ${data.is_visible}" }: { label: string, description?: string, value: any, onChange: (newValue: any) => void, placeholder?: string }) => {
    const currentMode = typeof value === 'boolean' ? 'boolean' : (value === undefined || value === null) ? 'boolean' : 'dynamic';

    return (
        <div className="space-y-2 rounded-lg border p-4">
            <ZoruLabel className="font-semibold">{label}</ZoruLabel>
            {description && <p className="text-xs text-muted-foreground pb-2">{description}</p>}
            <ZoruRadioGroup
                value={currentMode}
                onValueChange={(newMode) => {
                    if (newMode === 'boolean') {
                        onChange(true); // default to true
                    } else {
                        onChange(''); // clear for dynamic input
                    }
                }}
                className="flex gap-4"
            >
                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="boolean" id={`${label}-bool`} /><ZoruLabel htmlFor={`${label}-bool`} className="font-normal">Set Value</ZoruLabel></div>
                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="dynamic" id={`${label}-dyn`} /><ZoruLabel htmlFor={`${label}-dyn`} className="font-normal">Dynamic</ZoruLabel></div>
            </ZoruRadioGroup>
            {currentMode === 'boolean' ? (
                <ZoruRadioGroup value={String(value ?? true)} onValueChange={(val) => onChange(val === 'true')} className="flex gap-4 pt-2">
                    <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="true" id={`${label}-true`} /><ZoruLabel htmlFor={`${label}-true`} className="font-normal">True</ZoruLabel></div>
                    <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="false" id={`${label}-false`} /><ZoruLabel htmlFor={`${label}-false`} className="font-normal">False</ZoruLabel></div>
                </ZoruRadioGroup>
            ) : (
                <ZoruInput value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2" />
            )}
        </div>
    );
};
