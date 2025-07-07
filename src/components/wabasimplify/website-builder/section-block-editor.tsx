
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function SectionBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['layout', 'background']}>
                <AccordionItem value="layout">
                    <AccordionTrigger>Layout & Spacing</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Width</Label>
                            <Select value={settings.width || 'full'} onValueChange={(val) => handleUpdate('width', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="full">Full Width</SelectItem>
                                    <SelectItem value="boxed">Boxed (Max 1280px)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Padding (Top, Right, Bottom, Left) in px</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <Input type="number" placeholder="Top" value={settings.padding?.top || '64'} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value)} />
                                <Input type="number" placeholder="Right" value={settings.padding?.right || '16'} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value)} />
                                <Input type="number" placeholder="Bottom" value={settings.padding?.bottom || '64'} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value)} />
                                <Input type="number" placeholder="Left" value={settings.padding?.left || '16'} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Gap between items (px)</Label>
                            <Input type="number" value={settings.gap || '16'} onChange={(e) => handleUpdate('gap', e.target.value)} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="background">
                    <AccordionTrigger>Background</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Background Type</Label>
                            <Select value={settings.backgroundType || 'none'} onValueChange={(val) => handleUpdate('backgroundType', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="color">Solid Color</SelectItem>
                                    <SelectItem value="image">Image</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {settings.backgroundType === 'color' && (
                            <div className="space-y-2">
                                <Label>Background Color</Label>
                                <Input type="color" value={settings.backgroundColor || '#F9FAFB'} onChange={(e) => handleUpdate('backgroundColor', e.target.value)} />
                            </div>
                        )}
                        {settings.backgroundType === 'image' && (
                             <div className="space-y-2">
                                <Label>Background Image URL</Label>
                                <Input value={settings.backgroundImageUrl || ''} onChange={(e) => handleUpdate('backgroundImageUrl', e.target.value)} />
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
