

'use client';

import { ZoruLabel, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ZoruButton } from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ZoruSwitch } from '@/components/zoruui';
import { ZoruSeparator } from '@/components/zoruui';

export function RichTextBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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

    const handleAttributeChange = (index: number, field: 'key' | 'value', value: string) => {
        const newAttributes = [...(settings.customAttributes || [])];
        newAttributes[index] = {...newAttributes[index], [field]: value};
        handleUpdate('customAttributes', newAttributes);
    }
    
    const addAttribute = () => {
        const newAttributes = [...(settings.customAttributes || []), {id: uuidv4(), key: '', value: ''}];
        handleUpdate('customAttributes', newAttributes);
    }

    const removeAttribute = (index: number) => {
        const newAttributes = (settings.customAttributes || []).filter((_: any, i:number) => i !== index);
        handleUpdate('customAttributes', newAttributes);
    }

    return (
        <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="pt-4">
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['content_main']}>
                    <ZoruAccordionItem value="content_main">
                        <ZoruAccordionTrigger>Text Editor</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <ZoruLabel htmlFor={`html-content-${settings.id}`}>Content</ZoruLabel>
                                <ZoruTextarea
                                    id={`html-content-${settings.id}`}
                                    value={settings.htmlContent || ''}
                                    onChange={(e) => handleUpdate('htmlContent', e.target.value)}
                                    placeholder="Enter your formatted text or HTML here..."
                                    className="h-48 font-mono"
                                />
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="content_structure">
                        <ZoruAccordionTrigger>Structure</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <ZoruLabel>HTML Tag</ZoruLabel>
                                <ZoruSelect value={settings.htmlTag || 'div'} onValueChange={(val) => handleUpdate('htmlTag', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="div">div</ZoruSelectItem>
                                        <ZoruSelectItem value="section">section</ZoruSelectItem>
                                        <ZoruSelectItem value="article">article</ZoruSelectItem>
                                        <ZoruSelectItem value="p">p</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="flex items-center space-x-2">
                                <ZoruSwitch id="dropCap" checked={settings.dropCap} onCheckedChange={(val) => handleUpdate('dropCap', val)} />
                                <ZoruLabel htmlFor="dropCap">Enable Drop Cap</ZoruLabel>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                 </ZoruAccordion>
            </TabsContent>
            
            <TabsContent value="style" className="pt-4">
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['style_typography']}>
                    <ZoruAccordionItem value="style_typography">
                        <ZoruAccordionTrigger>Typography</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.color || '#333333'} onChange={(e) => handleUpdate('color', e.target.value)} /></div>
                             <div className="space-y-2"><ZoruLabel>Alignment</ZoruLabel><ZoruSelect value={settings.textAlign || 'left'} onValueChange={(val) => handleUpdate('textAlign', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="left">Left</ZoruSelectItem><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="right">Right</ZoruSelectItem><ZoruSelectItem value="justify">Justify</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="space-y-2"><ZoruLabel>Font Family</ZoruLabel><ZoruSelect value={settings.fontFamily || 'inherit'} onValueChange={(val) => handleUpdate('fontFamily', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Theme Default</ZoruSelectItem><ZoruSelectItem value="Inter, sans-serif">Inter</ZoruSelectItem><ZoruSelectItem value="'Roboto', sans-serif">Roboto</ZoruSelectItem><ZoruSelectItem value="'Lato', sans-serif">Lato</ZoruSelectItem><ZoruSelectItem value="'Merriweather', serif">Merriweather</ZoruSelectItem><ZoruSelectItem value="'Playfair Display', serif">Playfair Display</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><ZoruLabel>Font Size (px)</ZoruLabel><ZoruInput type="number" value={settings.fontSize || ''} onChange={(e) => handleUpdate('fontSize', e.target.value)} placeholder="e.g. 16" /></div><div className="space-y-2"><ZoruLabel>Weight</ZoruLabel><ZoruSelect value={settings.fontWeight || 'normal'} onValueChange={(val) => handleUpdate('fontWeight', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="normal">Normal</ZoruSelectItem><ZoruSelectItem value="bold">Bold</ZoruSelectItem><ZoruSelectItem value="300">300</ZoruSelectItem><ZoruSelectItem value="500">500</ZoruSelectItem><ZoruSelectItem value="700">700</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div></div>
                            <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><ZoruLabel>Transform</ZoruLabel><ZoruSelect value={settings.textTransform || 'none'} onValueChange={v => handleUpdate('textTransform', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="uppercase">Uppercase</ZoruSelectItem><ZoruSelectItem value="lowercase">Lowercase</ZoruSelectItem><ZoruSelectItem value="capitalize">Capitalize</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div><div className="space-y-2"><ZoruLabel>Style</ZoruLabel><ZoruSelect value={settings.fontStyle || 'normal'} onValueChange={(val) => handleUpdate('fontStyle', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="normal">Normal</ZoruSelectItem><ZoruSelectItem value="italic">Italic</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div></div>
                            <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><ZoruLabel>Line Height</ZoruLabel><ZoruInput type="number" step="0.1" value={settings.lineHeight || ''} onChange={(e) => handleUpdate('lineHeight', e.target.value)} placeholder="e.g. 1.6" /></div><div className="space-y-2"><ZoruLabel>Letter Spacing (px)</ZoruLabel><ZoruInput type="number" value={settings.letterSpacing || ''} onChange={(e) => handleUpdate('letterSpacing', e.target.value)} placeholder="e.g. 1.2" /></div></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_shadow">
                        <ZoruAccordionTrigger>Text Shadow & Blend Mode</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><ZoruLabel>Text Shadow</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="X" value={settings.textShadow?.x || '0'} onChange={(e) => handleSubFieldUpdate('textShadow', 'x', e.target.value, true)} /><ZoruInput type="number" placeholder="Y" value={settings.textShadow?.y || '0'} onChange={(e) => handleSubFieldUpdate('textShadow', 'y', e.target.value, true)} /><ZoruInput type="number" placeholder="Blur" value={settings.textShadow?.blur || '0'} onChange={(e) => handleSubFieldUpdate('textShadow', 'blur', e.target.value, true)} /><ZoruInput type="color" value={settings.textShadow?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('textShadow', 'color', e.target.value)} /></div></div>
                             <div className="space-y-2"><ZoruLabel>Blend Mode</ZoruLabel><ZoruSelect value={settings.blendMode || 'normal'} onValueChange={(val) => handleUpdate('blendMode', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="normal">Normal</ZoruSelectItem><ZoruSelectItem value="multiply">Multiply</ZoruSelectItem><ZoruSelectItem value="screen">Screen</ZoruSelectItem><ZoruSelectItem value="overlay">Overlay</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>

            <TabsContent value="advanced" className="pt-4">
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['advanced_spacing']}>
                    <ZoruAccordionItem value="advanced_spacing">
                        <ZoruAccordionTrigger>Spacing</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><ZoruLabel>Margin (Top, Right, Bottom, Left) in px</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="T" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><ZoruInput type="number" placeholder="R" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} /><ZoruInput type="number" placeholder="B" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /><ZoruInput type="number" placeholder="L" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} /></div></div>
                             <div className="space-y-2"><ZoruLabel>Padding (Top, Right, Bottom, Left) in px</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="T" value={settings.padding?.top ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><ZoruInput type="number" placeholder="R" value={settings.padding?.right ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><ZoruInput type="number" placeholder="B" value={settings.padding?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><ZoruInput type="number" placeholder="L" value={settings.padding?.left ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_motion">
                        <ZoruAccordionTrigger>Motion Effects</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>Entrance Animation</ZoruLabel><ZoruSelect value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="fadeIn">Fade In</ZoruSelectItem><ZoruSelectItem value="fadeInUp">Fade In Up</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_responsive">
                        <ZoruAccordionTrigger>Responsive</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <ZoruLabel>Visibility</ZoruLabel>
                            <div className="flex flex-col gap-2 rounded-md border p-3">
                                <div className="flex items-center justify-between"><ZoruLabel htmlFor="showOnDesktop" className="font-normal">Show on Desktop</ZoruLabel><ZoruSwitch id="showOnDesktop" checked={settings.responsiveVisibility?.desktop !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'desktop', val)} /></div>
                                <div className="flex items-center justify-between"><ZoruLabel htmlFor="showOnTablet" className="font-normal">Show on Tablet</ZoruLabel><ZoruSwitch id="showOnTablet" checked={settings.responsiveVisibility?.tablet !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'tablet', val)} /></div>
                                <div className="flex items-center justify-between"><ZoruLabel htmlFor="showOnMobile" className="font-normal">Show on Mobile</ZoruLabel><ZoruSwitch id="showOnMobile" checked={settings.responsiveVisibility?.mobile !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'mobile', val)} /></div>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_attributes">
                        <ZoruAccordionTrigger>Attributes</ZoruAccordionTrigger>
                         <ZoruAccordionContent className="space-y-4 pt-2">
                             {(settings.customAttributes || []).map((attr: any, index: number) => (
                                 <div key={attr.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center"><ZoruInput placeholder="Key" value={attr.key} onChange={e => handleAttributeChange(index, 'key', e.target.value)} /><ZoruInput placeholder="Value" value={attr.value} onChange={e => handleAttributeChange(index, 'value', e.target.value)} /><ZoruButton type="button" variant="ghost" size="icon" onClick={() => removeAttribute(index)}><Trash2 className="h-4 w-4 text-destructive"/></ZoruButton></div>
                             ))}
                             <ZoruButton type="button" variant="outline" className="w-full" onClick={addAttribute}><Plus className="mr-2 h-4 w-4"/>Add Attribute</ZoruButton>
                         </ZoruAccordionContent>
                    </ZoruAccordionItem>
                     <ZoruAccordionItem value="advanced_custom">
                        <ZoruAccordionTrigger>Custom CSS</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>CSS ID</ZoruLabel><ZoruInput value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>CSS Classes</ZoruLabel><ZoruInput value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>Custom CSS</ZoruLabel><ZoruTextarea value={settings.customCss || ''} onChange={e => handleUpdate('customCss', e.target.value)} className="font-mono" placeholder={`selector {\n  color: red;\n}`}/></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
             </TabsContent>
        </Tabs>
    );
}
