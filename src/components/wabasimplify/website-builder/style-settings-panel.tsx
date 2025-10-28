
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as LucideIcons from 'lucide-react';

const iconNames = Object.keys(LucideIcons).filter(key => typeof (LucideIcons as any)[key] === 'object' && /^[A-Z]/.test(key));

const hoverAnimationOptions = [
    { value: 'none', label: 'None' }, { value: 'grow', label: 'Grow' }, { value: 'shrink', label: 'Shrink' },
    { value: 'pulse', label: 'Pulse' }, { value: 'bob', label: 'Bob' }, { value: 'wobbleHorizontal', label: 'Wobble Horizontal' },
];


export function StyleSettingsPanel({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
    };
    
    return (
        <Accordion type="multiple" className="w-full" defaultValue={['style_form', 'style_fields', 'style_button']}>
            <AccordionItem value="style_form">
                <AccordionTrigger>Form</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <Label>Form Width (px)</Label>
                        <Input type="number" value={settings.formWidth || '480'} onChange={e => handleUpdate('formWidth', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Rows Gap (px)</Label>
                        <Input type="number" value={settings.fieldSpacing || '24'} onChange={e => handleUpdate('fieldSpacing', e.target.value)} />
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="style_fields">
                <AccordionTrigger>Fields</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                     <div className="space-y-2"><Label>Typography</Label><Select value={settings.fieldTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('fieldTypography', 'fontFamily', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Default</SelectItem><SelectItem value="sans-serif">Sans-serif</SelectItem><SelectItem value="serif">Serif</SelectItem></SelectContent></Select></div>
                     <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.fieldColor || '#333333'} onChange={e => handleUpdate('fieldColor', e.target.value)} /></div><div className="space-y-2"><Label>Background</Label><Input type="color" value={settings.fieldBgColor || '#FFFFFF'} onChange={e => handleUpdate('fieldBgColor', e.target.value)} /></div></div>
                     <div className="space-y-2"><Label>Border Type</Label><Select value={settings.fieldBorderType || 'solid'} onValueChange={v => handleUpdate('fieldBorderType', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem><SelectItem value="dotted">Dotted</SelectItem></SelectContent></Select></div>
                     <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Border Width (px)</Label><Input type="number" value={settings.fieldBorderWidth || '1'} onChange={e => handleUpdate('fieldBorderWidth', e.target.value)} /></div><div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" value={settings.fieldBorderRadius || '8'} onChange={e => handleUpdate('fieldBorderRadius', e.target.value)} /></div></div>
                     <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Border Color</Label><Input type="color" value={settings.fieldBorderColor || '#e5e7eb'} onChange={e => handleUpdate('fieldBorderColor', e.target.value)} /></div><div className="space-y-2"><Label>Focus Border</Label><Input type="color" value={settings.fieldFocusBorderColor || '#2563eb'} onChange={e => handleUpdate('fieldFocusBorderColor', e.target.value)} /></div></div>
                     <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" value={settings.fieldPadding || '12'} onChange={e => handleUpdate('fieldPadding', e.target.value)} /></div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="style_labels">
                <AccordionTrigger>Labels</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.labelColor || '#111827'} onChange={e => handleUpdate('labelColor', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Spacing below label (px)</Label><Input type="number" value={settings.labelSpacing || '8'} onChange={e => handleUpdate('labelSpacing', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Typography</Label><Select value={settings.labelTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('labelTypography', 'fontFamily', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inherit">Default</SelectItem><SelectItem value="sans-serif">Sans-serif</SelectItem><SelectItem value="serif">Serif</SelectItem></SelectContent></Select></div>
                </AccordionContent>
            </AccordionItem>
             <AccordionItem value="style_description">
                <AccordionTrigger>Field Description</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.descriptionColor || '#64748b'} onChange={e => handleUpdate('descriptionColor', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Typography</Label><Select value={settings.descriptionTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('descriptionTypography', 'fontFamily', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inherit">Default</SelectItem><SelectItem value="sans-serif">Sans-serif</SelectItem><SelectItem value="serif">Serif</SelectItem></SelectContent></Select></div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="style_button">
                <AccordionTrigger>Submit Button</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                     <div className="space-y-2"><Label>Typography</Label><Select value={settings.buttonTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('buttonTypography', 'fontFamily', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inherit">Default</SelectItem><SelectItem value="sans-serif">Sans-serif</SelectItem><SelectItem value="serif">Serif</SelectItem></SelectContent></Select></div>
                     <Tabs defaultValue="normal">
                        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="normal">Normal</TabsTrigger><TabsTrigger value="hover">Hover</TabsTrigger></TabsList>
                        <TabsContent value="normal" className="pt-4 space-y-4">
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.buttonColor || '#FFFFFF'} onChange={e => handleUpdate('buttonColor', e.target.value)} /></div><div className="space-y-2"><Label>Background</Label><Input type="color" value={settings.buttonBgColor || '#16a34a'} onChange={e => handleUpdate('buttonBgColor', e.target.value)} /></div></div>
                        </TabsContent>
                        <TabsContent value="hover" className="pt-4 space-y-4">
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Hover Text</Label><Input type="color" value={settings.buttonHoverColor || '#FFFFFF'} onChange={e => handleUpdate('buttonHoverColor', e.target.value)} /></div><div className="space-y-2"><Label>Hover BG</Label><Input type="color" value={settings.buttonHoverBgColor || '#15803d'} onChange={e => handleUpdate('buttonHoverBgColor', e.target.value)} /></div></div>
                        </TabsContent>
                     </Tabs>
                     <div className="space-y-2"><Label>Border Type</Label><Select value={settings.buttonBorderType || 'none'} onValueChange={v => handleUpdate('buttonBorderType', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem><SelectItem value="dotted">Dotted</SelectItem></SelectContent></Select></div>
                     <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" value={settings.buttonBorderRadius || '8'} onChange={e => handleUpdate('buttonBorderRadius', e.target.value)} /></div>
                     <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" value={settings.buttonPadding || '16'} onChange={e => handleUpdate('buttonPadding', e.target.value)} /></div>
                     <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.buttonBoxShadow || 'none'} onValueChange={v => handleUpdate('buttonBoxShadow', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem></SelectContent></Select></div>
                     <div className="space-y-2"><Label>Icon Size (px)</Label><Input type="number" value={settings.buttonIconSize || '16'} onChange={e => handleUpdate('buttonIconSize', e.target.value)} /></div>
                     <div className="space-y-2"><Label>Hover Animation</Label><Select value={settings.buttonHoverAnimation || 'none'} onValueChange={v => handleUpdate('buttonHoverAnimation', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{hoverAnimationOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}
