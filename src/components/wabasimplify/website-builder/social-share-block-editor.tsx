'use client';

import {
  ZoruLabel,
  ZoruButton,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruAccordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruCheckbox,
  ZoruSwitch,
  ZoruTextarea,
  ZoruSeparator,
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
} from '@/components/zoruui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Slider } from '@/components/ui/slider';

import { Lightbulb } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const availablePlatforms = [
    { id: 'facebook', name: 'Facebook' },
    { id: 'twitter', name: 'X (Twitter)' },
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'whatsapp', name: 'WhatsApp' },
    { id: 'telegram', name: 'Telegram' },
    { id: 'pinterest', name: 'Pinterest' },
    { id: 'reddit', name: 'Reddit' },
    { id: 'email', name: 'Email' },
    { id: 'print', name: 'Print' },
    { id: 'tumblr', name: 'Tumblr' },
    { id: 'vk', name: 'VK' },
    { id: 'xing', name: 'Xing' },
    { id: 'line', name: 'Line' },
    { id: 'skype', name: 'Skype' },
];

export function SocialShareBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handlePlatformToggle = (platformId: string, checked: boolean) => {
        const currentPlatforms = settings.platforms || [];
        const newPlatforms = checked
            ? [...currentPlatforms, platformId]
            : currentPlatforms.filter((p: string) => p !== platformId);
        handleUpdate('platforms', newPlatforms);
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
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['content_networks']}>
                    <ZoruAccordionItem value="content_networks">
                        <ZoruAccordionTrigger>Networks</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="grid grid-cols-2 gap-2">
                                {availablePlatforms.map(platform => (
                                    <div key={platform.id} className="flex items-center space-x-2">
                                        <ZoruCheckbox
                                            id={`platform-${platform.id}`}
                                            checked={(settings.platforms || []).includes(platform.id)}
                                            onCheckedChange={(checked) => handlePlatformToggle(platform.id, !!checked)}
                                        />
                                        <ZoruLabel htmlFor={`platform-${platform.id}`} className="font-normal">{platform.name}</ZoruLabel>
                                    </div>
                                ))}
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="content_settings">
                        <ZoruAccordionTrigger>Settings</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <ZoruLabel>Share URL</ZoruLabel>
                                <ZoruSelect value={settings.urlType || 'currentPage'} onValueChange={v => handleUpdate('urlType', v)}>
                                    <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="currentPage">Current Page URL</ZoruSelectItem>
                                        <ZoruSelectItem value="custom">Custom URL</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            {settings.urlType === 'custom' && (
                                <div className="space-y-2">
                                    <ZoruLabel>Custom URL</ZoruLabel>
                                    <ZoruInput type="url" placeholder="https://..." value={settings.customUrl || ''} onChange={e => handleUpdate('customUrl', e.target.value)} />
                                </div>
                            )}
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>
            <TabsContent value="style" className="pt-4">
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['style_buttons']}>
                    <ZoruAccordionItem value="style_buttons">
                        <ZoruAccordionTrigger>ZoruButton Style</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><ZoruLabel>Style</ZoruLabel><ZoruSelect value={settings.style || 'iconOnly'} onValueChange={v => handleUpdate('style', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="iconOnly">Icon Only</ZoruSelectItem><ZoruSelectItem value="withLabel">Icon & Text</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="space-y-2"><ZoruLabel>Shape</ZoruLabel><ZoruSelect value={settings.shape || 'rounded'} onValueChange={v => handleUpdate('shape', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="square">Square</ZoruSelectItem><ZoruSelectItem value="rounded">Rounded</ZoruSelectItem><ZoruSelectItem value="circle">Circle</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="space-y-2"><ZoruLabel>Columns</ZoruLabel><ZoruSelect value={String(settings.columns || 0)} onValueChange={v => handleUpdate('columns', Number(v))}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="0">Auto</ZoruSelectItem><ZoruSelectItem value="1">1</ZoruSelectItem><ZoruSelectItem value="2">2</ZoruSelectItem><ZoruSelectItem value="3">3</ZoruSelectItem><ZoruSelectItem value="4">4</ZoruSelectItem><ZoruSelectItem value="5">5</ZoruSelectItem><ZoruSelectItem value="6">6</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="space-y-2"><ZoruLabel>Alignment</ZoruLabel><ZoruSelect value={settings.alignment || 'center'} onValueChange={v => handleUpdate('alignment', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="left">Left</ZoruSelectItem><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="right">Right</ZoruSelectItem><ZoruSelectItem value="justify">Justify</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="space-y-2"><ZoruLabel>Size</ZoruLabel><ZoruSelect value={settings.size || 'medium'} onValueChange={v => handleUpdate('size', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="small">Small</ZoruSelectItem><ZoruSelectItem value="medium">Medium</ZoruSelectItem><ZoruSelectItem value="large">Large</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="space-y-2"><ZoruLabel>Icon Size (px)</ZoruLabel><ZoruInput type="number" value={settings.iconSize || 16} onChange={e => handleUpdate('iconSize', Number(e.target.value))} /></div>
                             <div className="space-y-2"><ZoruLabel>Gap between buttons (px)</ZoruLabel><ZoruInput type="number" value={settings.gap || 8} onChange={e => handleUpdate('gap', Number(e.target.value))} /></div>
                             <div className="space-y-2"><ZoruLabel>Transition Duration (s)</ZoruLabel><ZoruInput type="number" step="0.1" value={settings.transitionDuration || '0.3'} onChange={e => handleUpdate('transitionDuration', e.target.value)} /></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_colors">
                        <ZoruAccordionTrigger>Colors</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <Tabs defaultValue="normal">
                                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="normal">Normal</TabsTrigger><TabsTrigger value="hover">Hover</TabsTrigger></TabsList>
                                <TabsContent value="normal" className="pt-4 space-y-4">
                                     <div className="space-y-2"><ZoruLabel>Icon Color</ZoruLabel><ZoruInput type="color" value={settings.color || '#333333'} onChange={e => handleUpdate('color', e.target.value)} /></div>
                                     <div className="space-y-2"><ZoruLabel>Background Color</ZoruLabel><ZoruInput type="color" value={settings.backgroundColor || '#ffffff'} onChange={e => handleUpdate('backgroundColor', e.target.value)} /></div>
                                </TabsContent>
                                <TabsContent value="hover" className="pt-4 space-y-4">
                                    <div className="space-y-2"><ZoruLabel>Hover Icon Color</ZoruLabel><ZoruInput type="color" value={settings.hoverColor || settings.color} onChange={e => handleUpdate('hoverColor', e.target.value)} /></div>
                                    <div className="space-y-2"><ZoruLabel>Hover Background Color</ZoruLabel><ZoruInput type="color" value={settings.hoverBackgroundColor || settings.backgroundColor} onChange={e => handleUpdate('hoverBackgroundColor', e.target.value)} /></div>
                                </TabsContent>
                             </Tabs>
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
