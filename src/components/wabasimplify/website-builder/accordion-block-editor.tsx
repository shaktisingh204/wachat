'use client';

import {
  ZoruLabel,
  ZoruButton,
  ZoruInput,
  ZoruTextarea,
  ZoruAccordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSwitch,
  ZoruSeparator,
} from '@/components/zoruui';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import React from 'react';

import * as LucideIcons from 'lucide-react';

const iconNames = Object.keys(LucideIcons).filter(key => typeof (LucideIcons as any)[key] === 'object' && /^[A-Z]/.test(key));

type AccordionItemData = {
  id: string;
  title: string;
  content: string;
  icon?: string;
};

export function AccordionBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const items = settings.items || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };
    
    const handleItemChange = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        handleUpdate('items', newItems);
    };

    const addItem = () => {
        const newItems = [...items, { id: uuidv4(), title: 'New Item', content: 'Item content' }];
        handleUpdate('items', newItems);
    };

    const removeItem = (index: number) => {
        const newItems = items.filter((_: any, i: number) => i !== index);
        handleUpdate('items', newItems);
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
        newAttributes[index] = {...newAttributes[index], key: field === 'key' ? value : newAttributes[index].key, value: field === 'value' ? value : newAttributes[index].value};
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
                <ZoruAccordion type="multiple" className="w-full" defaultValue={['items', 'settings']}>
                    <ZoruAccordionItem value="items">
                        <ZoruAccordionTrigger>ZoruAccordion Items</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            {items.map((item: AccordionItemData, index: number) => (
                                <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                                    <ZoruButton type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeItem(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </ZoruButton>
                                    <ZoruLabel>Item {index + 1}</ZoruLabel>
                                    <ZoruInput placeholder="Item Title" value={item.title || ''} onChange={(e) => handleItemChange(index, 'title', e.target.value)} />
                                    <ZoruTextarea placeholder="Item content..." value={item.content || ''} onChange={(e) => handleItemChange(index, 'content', e.target.value)} />
                                    <ZoruSelect value={item.icon || '__none__'} onValueChange={(val) => handleItemChange(index, 'icon', val === '__none__' ? '' : val)}>
                                        <ZoruSelectTrigger><ZoruSelectValue placeholder="ZoruSelect an icon..."/></ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="__none__">No Icon</ZoruSelectItem>
                                            {iconNames.map(iconName => (<ZoruSelectItem key={iconName} value={iconName}>{iconName}</ZoruSelectItem>))}
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                </div>
                            ))}
                            <ZoruButton type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add Item</ZoruButton>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="settings">
                        <ZoruAccordionTrigger>Settings</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>Toggle Behavior</ZoruLabel><ZoruSelect value={settings.behavior || 'single'} onValueChange={(val) => handleUpdate('behavior', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="single">ZoruAccordion</ZoruSelectItem><ZoruSelectItem value="multiple">Toggle</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Default Active Item</ZoruLabel><ZoruSelect value={settings.defaultActiveItem || '__none__'} onValueChange={v => handleUpdate('defaultActiveItem', v === '__none__' ? '' : v)}><ZoruSelectTrigger><ZoruSelectValue placeholder="None"/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="__none__">None</ZoruSelectItem>{items.map((item: AccordionItemData, index: number) => <ZoruSelectItem key={item.id} value={item.id}>Item {index+1} ({item.title})</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Title HTML Tag</ZoruLabel><ZoruSelect value={settings.titleHtmlTag || 'h3'} onValueChange={v => handleUpdate('titleHtmlTag', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="h2">H2</ZoruSelectItem><ZoruSelectItem value="h3">H3</ZoruSelectItem><ZoruSelectItem value="h4">H4</ZoruSelectItem><ZoruSelectItem value="div">div</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><ZoruLabel>Inactive Icon</ZoruLabel><ZoruSelect value={settings.inactiveIcon || 'Plus'} onValueChange={v => handleUpdate('inactiveIcon', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent>{iconNames.map(name => <ZoruSelectItem key={name} value={name}>{name}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                                <div className="space-y-2"><ZoruLabel>Active Icon</ZoruLabel><ZoruSelect value={settings.activeIcon || 'Minus'} onValueChange={v => handleUpdate('activeIcon', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent>{iconNames.map(name => <ZoruSelectItem key={name} value={name}>{name}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                            </div>
                            <div className="space-y-2"><ZoruLabel>Icon Position</ZoruLabel><ZoruSelect value={settings.iconPosition || 'right'} onValueChange={v => handleUpdate('iconPosition', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="left">Left</ZoruSelectItem><ZoruSelectItem value="right">Right</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>

            <TabsContent value="style" className="pt-4">
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['style_box', 'style_title', 'style_content']}>
                    <ZoruAccordionItem value="style_box">
                        <ZoruAccordionTrigger>ZoruAccordion Box Style</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>Space Between (px)</ZoruLabel><ZoruInput type="number" placeholder="10" value={settings.spaceBetween || ''} onChange={e => handleUpdate('spaceBetween', Number(e.target.value))} /></div>
                            <div className="space-y-2"><ZoruLabel>Border Type</ZoruLabel><ZoruSelect value={settings.border?.type || 'solid'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem><ZoruSelectItem value="dotted">Dotted</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Border Width (T R B L) in px</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="T" value={settings.border?.width?.top ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), top: e.target.value })} /><ZoruInput type="number" placeholder="R" value={settings.border?.width?.right ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), right: e.target.value })} /><ZoruInput type="number" placeholder="B" value={settings.border?.width?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), bottom: e.target.value })} /><ZoruInput type="number" placeholder="L" value={settings.border?.width?.left ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), left: e.target.value })} /></div></div>
                            <div className="space-y-2"><ZoruLabel>Border Color</ZoruLabel><ZoruInput type="color" value={settings.border?.color || '#e5e7eb'} onChange={e => handleSubFieldUpdate('border', 'color', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>Border Radius (px)</ZoruLabel><ZoruInput type="number" placeholder="8" value={settings.border?.radius ?? ''} onChange={e => handleSubFieldUpdate('border', 'radius', Number(e.target.value))} /></div>
                            <div className="space-y-2"><ZoruLabel>Box Shadow</ZoruLabel><ZoruSelect value={settings.boxShadow || 'none'} onValueChange={v => handleUpdate('boxShadow', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                     <ZoruAccordionItem value="style_title">
                        <ZoruAccordionTrigger>Title Style</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Background</ZoruLabel><ZoruInput type="color" value={settings.titleBgColor || '#FFFFFF'} onChange={e => handleUpdate('titleBgColor', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.titleColor || '#000000'} onChange={e => handleUpdate('titleColor', e.target.value)} /></div></div>
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Active BG</ZoruLabel><ZoruInput type="color" value={settings.activeTitleBgColor || '#F9FAFB'} onChange={e => handleUpdate('activeTitleBgColor', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Active Text</ZoruLabel><ZoruInput type="color" value={settings.activeTitleColor || '#000000'} onChange={e => handleUpdate('activeTitleColor', e.target.value)} /></div></div>
                            <div className="space-y-2"><ZoruLabel>Typography</ZoruLabel><ZoruSelect value={settings.titleFontFamily || 'inherit'} onValueChange={v => handleUpdate('titleFontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="Inter, sans-serif">Inter</ZoruSelectItem><ZoruSelectItem value="'Roboto', sans-serif">Roboto</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Padding (px)</ZoruLabel><ZoruInput type="number" placeholder="16" value={settings.titlePadding || ''} onChange={e => handleUpdate('titlePadding', Number(e.target.value))} /></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                     <ZoruAccordionItem value="style_content">
                        <ZoruAccordionTrigger>Content Style</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Background</ZoruLabel><ZoruInput type="color" value={settings.contentBgColor || '#FFFFFF'} onChange={e => handleUpdate('contentBgColor', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.contentColor || '#333333'} onChange={e => handleUpdate('contentColor', e.target.value)} /></div></div>
                            <div className="space-y-2"><ZoruLabel>Typography</ZoruLabel><ZoruSelect value={settings.contentFontFamily || 'inherit'} onValueChange={v => handleUpdate('contentFontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="Inter, sans-serif">Inter</ZoruSelectItem><ZoruSelectItem value="'Roboto', sans-serif">Roboto</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Padding (px)</ZoruLabel><ZoruInput type="number" placeholder="16" value={settings.contentPadding || ''} onChange={e => handleUpdate('contentPadding', Number(e.target.value))} /></div>
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
                    <ZoruAccordionItem value="advanced_motion"><ZoruAccordionTrigger>Motion Effects</ZoruAccordionTrigger><ZoruAccordionContent className="space-y-4 pt-2"><div className="space-y-2"><ZoruLabel>Entrance Animation</ZoruLabel><ZoruSelect value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="fadeIn">Fade In</ZoruSelectItem><ZoruSelectItem value="fadeInUp">Fade In Up</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Animation Duration</ZoruLabel><ZoruSelect value={settings.animationDuration || 'normal'} onValueChange={v => handleUpdate('animationDuration', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="slow">Slow</ZoruSelectItem><ZoruSelectItem value="normal">Normal</ZoruSelectItem><ZoruSelectItem value="fast">Fast</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div><div className="space-y-2"><ZoruLabel>Animation Delay (ms)</ZoruLabel><ZoruInput type="number" value={settings.animationDelay || ''} onChange={e => handleUpdate('animationDelay', e.target.value)} /></div></div></ZoruAccordionContent></ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_responsive"><ZoruAccordionTrigger>Responsive</ZoruAccordionTrigger><ZoruAccordionContent className="space-y-4 pt-2"><ZoruLabel>Visibility</ZoruLabel><div className="flex flex-col gap-2 rounded-md border p-3"><div className="flex items-center justify-between"><ZoruLabel htmlFor="showOnDesktop" className="font-normal">Show on Desktop</ZoruLabel><ZoruSwitch id="showOnDesktop" checked={settings.responsiveVisibility?.desktop !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'desktop', val)} /></div><div className="flex items-center justify-between"><ZoruLabel htmlFor="showOnTablet" className="font-normal">Show on Tablet</ZoruLabel><ZoruSwitch id="showOnTablet" checked={settings.responsiveVisibility?.tablet !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'tablet', val)} /></div><div className="flex items-center justify-between"><ZoruLabel htmlFor="showOnMobile" className="font-normal">Show on Mobile</ZoruLabel><ZoruSwitch id="showOnMobile" checked={settings.responsiveVisibility?.mobile !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'mobile', val)} /></div></div></ZoruAccordionContent></ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_attributes"><ZoruAccordionTrigger>Attributes</ZoruAccordionTrigger><ZoruAccordionContent className="space-y-4 pt-2">{(settings.customAttributes || []).map((attr: any, index: number) => (<div key={attr.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center"><ZoruInput placeholder="Key" value={attr.key} onChange={e => handleAttributeChange(index, 'key', e.target.value)} /><ZoruInput placeholder="Value" value={attr.value} onChange={e => handleAttributeChange(index, 'value', e.target.value)} /><ZoruButton type="button" variant="ghost" size="icon" onClick={() => removeAttribute(index)}><Trash2 className="h-4 w-4 text-destructive"/></ZoruButton></div>))}<ZoruButton type="button" variant="outline" className="w-full" onClick={addAttribute}><Plus className="mr-2 h-4 w-4"/>Add Attribute</ZoruButton></ZoruAccordionContent></ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_custom"><ZoruAccordionTrigger>Custom CSS</ZoruAccordionTrigger><ZoruAccordionContent className="space-y-4 pt-2"><div className="space-y-2"><ZoruLabel>CSS ID</ZoruLabel><ZoruInput value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>CSS Classes</ZoruLabel><ZoruInput value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Custom CSS</ZoruLabel><ZoruTextarea value={settings.customCss || ''} onChange={e => handleUpdate('customCss', e.target.value)} className="font-mono" placeholder={`selector {\n  color: red;\n}`}/></div></ZoruAccordionContent></ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>
        </Tabs>
    );
}
