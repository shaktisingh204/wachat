
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SpacerBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };
    
    const handleSubFieldUpdate = (mainField: string, subField: string, value: any) => {
        onUpdate({
            ...settings,
            [mainField]: {
                ...(settings[mainField] || {}),
                [subField]: value
            }
        });
    }

    const type = settings.type || 'spacer';

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Type</Label>
                <RadioGroup value={type} onValueChange={(val) => handleUpdate('type', val)} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="spacer" id="type-spacer"/><Label htmlFor="type-spacer" className="font-normal">Spacer</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="divider" id="type-divider"/><Label htmlFor="type-divider" className="font-normal">Divider</Label></div>
                </RadioGroup>
            </div>
            
            {type === 'spacer' ? (
                <div className="space-y-2">
                    <Label htmlFor="height">Height (px)</Label>
                    <Input id="height" type="number" value={settings.height || 24} onChange={e => handleUpdate('height', e.target.value)} />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Style</Label>
                            <Select value={settings.style || 'solid'} onValueChange={(val) => handleUpdate('style', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="solid">Solid</SelectItem>
                                    <SelectItem value="dashed">Dashed</SelectItem>
                                    <SelectItem value="dotted">Dotted</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Color</Label>
                            <Input type="color" value={settings.color || '#e5e7eb'} onChange={(e) => handleUpdate('color', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Width</Label>
                            <Input placeholder="e.g. 100% or 200px" value={settings.width || '100%'} onChange={e => handleUpdate('width', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Thickness (px)</Label>
                            <Input type="number" value={settings.thickness || '1'} onChange={e => handleUpdate('thickness', e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Alignment</Label>
                        <Select value={settings.alignment || 'center'} onValueChange={(val) => handleUpdate('alignment', val)}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
            
            <div className="space-y-2">
                <Label>Margin (Top, Bottom) in px</Label>
                <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="Top" value={settings.margin?.top || '16'} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value)} />
                    <Input type="number" placeholder="Bottom" value={settings.margin?.bottom || '16'} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value)} />
                </div>
            </div>
        </div>
    );
}
