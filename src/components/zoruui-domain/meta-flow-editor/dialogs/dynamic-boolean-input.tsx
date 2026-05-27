'use client';

import { Label, RadioGroup, ZoruRadioGroupItem, Input } from '@/components/zoruui';
export const DynamicBooleanInput = ({ label, value, onChange, placeholder = "e.g. ${data.is_visible}" }: { label: string, value: any, onChange: (newValue: any) => void, placeholder?: string }) => {
    const currentMode = typeof value === 'boolean' ? 'boolean' : 'dynamic';
    
    return (
        <div className="space-y-2 rounded-lg border p-4">
            <Label className="font-semibold">{label}</Label>
            <RadioGroup 
                value={currentMode} 
                onValueChange={(newMode) => {
                    if (newMode === 'boolean') {
                        onChange(true); // default to true
                    } else {
                        onChange(undefined); // clear for dynamic input
                    }
                }} 
                className="flex gap-4"
            >
                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="boolean" id={`${label}-bool`} /><Label htmlFor={`${label}-bool`} className="font-normal">Set Value</Label></div>
                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="dynamic" id={`${label}-dyn`} /><Label htmlFor={`${label}-dyn`} className="font-normal">Dynamic</Label></div>
            </RadioGroup>
            {currentMode === 'boolean' ? (
                 <RadioGroup value={String(value)} onValueChange={(val) => onChange(val === 'true')} className="flex gap-4 pt-2">
                    <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="true" id={`${label}-true`} /><Label htmlFor={`${label}-true`} className="font-normal">True</Label></div>
                    <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="false" id={`${label}-false`} /><Label htmlFor={`${label}-false`} className="font-normal">False</Label></div>
                 </RadioGroup>
            ) : (
                <Input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2" />
            )}
        </div>
    );
};
