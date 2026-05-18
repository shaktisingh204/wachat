
'use client';

import { ZoruLabel } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
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
        <ZoruAccordion type="multiple" className="w-full" defaultValue={['style_form', 'style_fields', 'style_button']}>
            <ZoruAccordionItem value="style_form">
                <ZoruAccordionTrigger>Form</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <ZoruLabel>Form Width (px)</ZoruLabel>
                        <ZoruInput type="number" value={settings.formWidth || '480'} onChange={e => handleUpdate('formWidth', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel>Rows Gap (px)</ZoruLabel>
                        <ZoruInput type="number" value={settings.fieldSpacing || '24'} onChange={e => handleUpdate('fieldSpacing', e.target.value)} />
                    </div>
                </ZoruAccordionContent>
            </ZoruAccordionItem>
            <ZoruAccordionItem value="style_fields">
                <ZoruAccordionTrigger>Fields</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                     <div className="space-y-2"><ZoruLabel>Typography</ZoruLabel><ZoruSelect value={settings.fieldTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('fieldTypography', 'fontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="sans-serif">Sans-serif</ZoruSelectItem><ZoruSelectItem value="serif">Serif</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                     <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.fieldColor || '#333333'} onChange={e => handleUpdate('fieldColor', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Background</ZoruLabel><ZoruInput type="color" value={settings.fieldBgColor || '#FFFFFF'} onChange={e => handleUpdate('fieldBgColor', e.target.value)} /></div></div>
                     <div className="space-y-2"><ZoruLabel>Border Type</ZoruLabel><ZoruSelect value={settings.fieldBorderType || 'solid'} onValueChange={v => handleUpdate('fieldBorderType', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem><ZoruSelectItem value="dotted">Dotted</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                     <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Border Width (px)</ZoruLabel><ZoruInput type="number" value={settings.fieldBorderWidth || '1'} onChange={e => handleUpdate('fieldBorderWidth', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Border Radius (px)</ZoruLabel><ZoruInput type="number" value={settings.fieldBorderRadius || '8'} onChange={e => handleUpdate('fieldBorderRadius', e.target.value)} /></div></div>
                     <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Border Color</ZoruLabel><ZoruInput type="color" value={settings.fieldBorderColor || '#e5e7eb'} onChange={e => handleUpdate('fieldBorderColor', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Focus Border</ZoruLabel><ZoruInput type="color" value={settings.fieldFocusBorderColor || '#2563eb'} onChange={e => handleUpdate('fieldFocusBorderColor', e.target.value)} /></div></div>
                     <div className="space-y-2"><ZoruLabel>Padding (px)</ZoruLabel><ZoruInput type="number" value={settings.fieldPadding || '12'} onChange={e => handleUpdate('fieldPadding', e.target.value)} /></div>
                </ZoruAccordionContent>
            </ZoruAccordionItem>
            <ZoruAccordionItem value="style_labels">
                <ZoruAccordionTrigger>Labels</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.labelColor || '#111827'} onChange={e => handleUpdate('labelColor', e.target.value)} /></div>
                    <div className="space-y-2"><ZoruLabel>Spacing below label (px)</ZoruLabel><ZoruInput type="number" value={settings.labelSpacing || '8'} onChange={e => handleUpdate('labelSpacing', e.target.value)} /></div>
                    <div className="space-y-2"><ZoruLabel>Typography</ZoruLabel><ZoruSelect value={settings.labelTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('labelTypography', 'fontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="sans-serif">Sans-serif</ZoruSelectItem><ZoruSelectItem value="serif">Serif</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                </ZoruAccordionContent>
            </ZoruAccordionItem>
             <ZoruAccordionItem value="style_description">
                <ZoruAccordionTrigger>Field Description</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.descriptionColor || '#64748b'} onChange={e => handleUpdate('descriptionColor', e.target.value)} /></div>
                    <div className="space-y-2"><ZoruLabel>Typography</ZoruLabel><ZoruSelect value={settings.descriptionTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('descriptionTypography', 'fontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="sans-serif">Sans-serif</ZoruSelectItem><ZoruSelectItem value="serif">Serif</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                </ZoruAccordionContent>
            </ZoruAccordionItem>
            <ZoruAccordionItem value="style_button">
                <ZoruAccordionTrigger>Submit ZoruButton</ZoruAccordionTrigger>
                <ZoruAccordionContent className="space-y-4 pt-2">
                     <div className="space-y-2"><ZoruLabel>Typography</ZoruLabel><ZoruSelect value={settings.buttonTypography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('buttonTypography', 'fontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="sans-serif">Sans-serif</ZoruSelectItem><ZoruSelectItem value="serif">Serif</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                     <Tabs defaultValue="normal">
                        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="normal">Normal</TabsTrigger><TabsTrigger value="hover">Hover</TabsTrigger></TabsList>
                        <TabsContent value="normal" className="pt-4 space-y-4">
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.buttonColor || '#FFFFFF'} onChange={e => handleUpdate('buttonColor', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Background</ZoruLabel><ZoruInput type="color" value={settings.buttonBgColor || '#16a34a'} onChange={e => handleUpdate('buttonBgColor', e.target.value)} /></div></div>
                        </TabsContent>
                        <TabsContent value="hover" className="pt-4 space-y-4">
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Hover Text</ZoruLabel><ZoruInput type="color" value={settings.buttonHoverColor || '#FFFFFF'} onChange={e => handleUpdate('buttonHoverColor', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Hover BG</ZoruLabel><ZoruInput type="color" value={settings.buttonHoverBgColor || '#15803d'} onChange={e => handleUpdate('buttonHoverBgColor', e.target.value)} /></div></div>
                        </TabsContent>
                     </Tabs>
                     <div className="space-y-2"><ZoruLabel>Border Type</ZoruLabel><ZoruSelect value={settings.buttonBorderType || 'none'} onValueChange={v => handleUpdate('buttonBorderType', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem><ZoruSelectItem value="dotted">Dotted</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                     <div className="space-y-2"><ZoruLabel>Border Radius (px)</ZoruLabel><ZoruInput type="number" value={settings.buttonBorderRadius || '8'} onChange={e => handleUpdate('buttonBorderRadius', e.target.value)} /></div>
                     <div className="space-y-2"><ZoruLabel>Padding (px)</ZoruLabel><ZoruInput type="number" value={settings.buttonPadding || '16'} onChange={e => handleUpdate('buttonPadding', e.target.value)} /></div>
                     <div className="space-y-2"><ZoruLabel>Box Shadow</ZoruLabel><ZoruSelect value={settings.buttonBoxShadow || 'none'} onValueChange={v => handleUpdate('buttonBoxShadow', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                     <div className="space-y-2"><ZoruLabel>Icon Size (px)</ZoruLabel><ZoruInput type="number" value={settings.buttonIconSize || '16'} onChange={e => handleUpdate('buttonIconSize', e.target.value)} /></div>
                     <div className="space-y-2"><ZoruLabel>Hover Animation</ZoruLabel><ZoruSelect value={settings.buttonHoverAnimation || 'none'} onValueChange={v => handleUpdate('buttonHoverAnimation', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent>{hoverAnimationOptions.map(opt => <ZoruSelectItem key={opt.value} value={opt.value}>{opt.label}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                </ZoruAccordionContent>
            </ZoruAccordionItem>
        </ZoruAccordion>
    )
}
