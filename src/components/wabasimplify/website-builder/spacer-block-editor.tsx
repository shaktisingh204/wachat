
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SpacerBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
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

    const type = settings.type || 'spacer';

    return (
        <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="content">Layout</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            <TabsContent value="content" className="pt-4">
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
                </div>
            </TabsContent>
            <TabsContent value="advanced" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['advanced_spacing']}>
                    <AccordionItem value="advanced_spacing">
                        <AccordionTrigger>Spacing</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Margin (Top, Bottom) in px</Label><div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="Top" value={settings.margin?.top ?? '16'} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><Input type="number" placeholder="Bottom" value={settings.margin?.bottom ?? '16'} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /></div></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="advanced_responsive">
                        <AccordionTrigger>Responsive</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <Label>Visibility</Label>
                            <div className="flex flex-col gap-2 rounded-md border p-3">
                                <div className="flex items-center justify-between"><Label htmlFor="showOnDesktop" className="font-normal">Show on Desktop</Label><Switch id="showOnDesktop" checked={settings.responsiveVisibility?.desktop !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'desktop', val)} /></div>
                                <div className="flex items-center justify-between"><Label htmlFor="showOnTablet" className="font-normal">Show on Tablet</Label><Switch id="showOnTablet" checked={settings.responsiveVisibility?.tablet !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'tablet', val)} /></div>
                                <div className="flex items-center justify-between"><Label htmlFor="showOnMobile" className="font-normal">Show on Mobile</Label><Switch id="showOnMobile" checked={settings.responsiveVisibility?.mobile !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'mobile', val)} /></div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>
        </Tabs>
    );
}
