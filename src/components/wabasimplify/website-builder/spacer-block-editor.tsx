'use client';

import {
  Label,
  Button,
  Input,
  RadioGroup,
  ZoruRadioGroupItem,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Switch,
  Textarea,
} from '@/components/zoruui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

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

    const type = settings.type || 'spacer';

    return (
        <Tabs defaultValue="layout" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            <TabsContent value="layout" className="pt-4">
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel>Type</ZoruLabel>
                        <ZoruRadioGroup value={type} onValueChange={(val) => handleUpdate('type', val)} className="flex gap-4">
                            <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="spacer" id="type-spacer"/><ZoruLabel htmlFor="type-spacer" className="font-normal">Spacer</ZoruLabel></div>
                            <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="divider" id="type-divider"/><ZoruLabel htmlFor="type-divider" className="font-normal">Divider</ZoruLabel></div>
                        </ZoruRadioGroup>
                    </div>
                    
                    {type === 'spacer' ? (
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="height">Height (px)</ZoruLabel>
                            <ZoruInput id="height" type="number" value={settings.height || 24} onChange={e => handleUpdate('height', e.target.value)} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <ZoruLabel>Style</ZoruLabel>
                                    <ZoruSelect value={settings.style || 'solid'} onValueChange={(val) => handleUpdate('style', val)}>
                                        <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="solid">Solid</ZoruSelectItem>
                                            <ZoruSelectItem value="dashed">Dashed</ZoruSelectItem>
                                            <ZoruSelectItem value="dotted">Dotted</ZoruSelectItem>
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel>Color</ZoruLabel>
                                    <ZoruInput type="color" value={settings.color || '#e5e7eb'} onChange={(e) => handleUpdate('color', e.target.value)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <ZoruLabel>Width</ZoruLabel>
                                    <ZoruInput placeholder="e.g. 100% or 200px" value={settings.width || '100%'} onChange={e => handleUpdate('width', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel>Thickness (px)</ZoruLabel>
                                    <ZoruInput type="number" value={settings.thickness || '1'} onChange={e => handleUpdate('thickness', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Alignment</ZoruLabel>
                                <ZoruSelect value={settings.alignment || 'center'} onValueChange={(val) => handleUpdate('alignment', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="left">Left</ZoruSelectItem>
                                        <ZoruSelectItem value="center">Center</ZoruSelectItem>
                                        <ZoruSelectItem value="right">Right</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>
                    )}
                </div>
            </TabsContent>
            <TabsContent value="advanced" className="pt-4">
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['advanced_spacing']}>
                    <ZoruAccordionItem value="advanced_spacing">
                        <ZoruAccordionTrigger>Spacing</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><ZoruLabel>Margin (Top, Right, Bottom, Left) in px</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="T" value={settings.margin?.top ?? '16'} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><ZoruInput type="number" placeholder="R" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} /><ZoruInput type="number" placeholder="B" value={settings.margin?.bottom ?? '16'} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /><ZoruInput type="number" placeholder="L" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} /></div></div>
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
