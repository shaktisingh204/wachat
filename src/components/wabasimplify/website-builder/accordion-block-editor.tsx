
'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from '../ui/switch';
import * as LucideIcons from 'lucide-react';
import { Separator } from '../ui/separator';

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
                <Accordion type="multiple" className="w-full" defaultValue={['items', 'settings']}>
                    <AccordionItem value="items">
                        <AccordionTrigger>Accordion Items</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            {items.map((item: AccordionItemData, index: number) => (
                                <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeItem(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                    <Label>Item {index + 1}</Label>
                                    <Input placeholder="Item Title" value={item.title || ''} onChange={(e) => handleItemChange(index, 'title', e.target.value)} />
                                    <Textarea placeholder="Item content..." value={item.content || ''} onChange={(e) => handleItemChange(index, 'content', e.target.value)} />
                                    <Select value={item.icon || ''} onValueChange={(val) => handleItemChange(index, 'icon', val)}>
                                        <SelectTrigger><SelectValue placeholder="Select an icon..."/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">No Icon</SelectItem>
                                            {iconNames.map(iconName => (<SelectItem key={iconName} value={iconName}>{iconName}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                            <Button type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="settings">
                        <AccordionTrigger>Settings</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Toggle Behavior</Label><Select value={settings.behavior || 'single'} onValueChange={(val) => handleUpdate('behavior', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="single">Accordion</SelectItem><SelectItem value="multiple">Toggle</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Default Active Item</Label><Select value={settings.defaultActiveItem || ''} onValueChange={v => handleUpdate('defaultActiveItem', v)}><SelectTrigger><SelectValue placeholder="None"/></SelectTrigger><SelectContent><SelectItem value="">None</SelectItem>{items.map((item: AccordionItemData, index: number) => <SelectItem key={item.id} value={item.id}>Item {index+1} ({item.title})</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>Title HTML Tag</Label><Select value={settings.titleHtmlTag || 'h3'} onValueChange={v => handleUpdate('titleHtmlTag', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="h2">H2</SelectItem><SelectItem value="h3">H3</SelectItem><SelectItem value="h4">H4</SelectItem><SelectItem value="div">div</SelectItem></SelectContent></Select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Inactive Icon</Label><Select value={settings.inactiveIcon || 'Plus'} onValueChange={v => handleUpdate('inactiveIcon', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{iconNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-2"><Label>Active Icon</Label><Select value={settings.activeIcon || 'Minus'} onValueChange={v => handleUpdate('activeIcon', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{iconNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
                            </div>
                            <div className="space-y-2"><Label>Icon Position</Label><Select value={settings.iconPosition || 'right'} onValueChange={v => handleUpdate('iconPosition', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>

            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_box', 'style_title', 'style_content']}>
                    <AccordionItem value="style_box">
                        <AccordionTrigger>Accordion Box Style</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Space Between (px)</Label><Input type="number" placeholder="10" value={settings.spaceBetween || ''} onChange={e => handleUpdate('spaceBetween', Number(e.target.value))} /></div>
                            <div className="space-y-2"><Label>Border Type</Label><Select value={settings.border?.type || 'solid'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem><SelectItem value="dotted">Dotted</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Border Width (T R B L) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.border?.width?.top ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), top: e.target.value })} /><Input type="number" placeholder="R" value={settings.border?.width?.right ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), right: e.target.value })} /><Input type="number" placeholder="B" value={settings.border?.width?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), bottom: e.target.value })} /><Input type="number" placeholder="L" value={settings.border?.width?.left ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), left: e.target.value })} /></div></div>
                            <div className="space-y-2"><Label>Border Color</Label><Input type="color" value={settings.border?.color || '#e5e7eb'} onChange={e => handleSubFieldUpdate('border', 'color', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" placeholder="8" value={settings.border?.radius ?? ''} onChange={e => handleSubFieldUpdate('border', 'radius', Number(e.target.value))} /></div>
                            <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow || 'none'} onValueChange={v => handleUpdate('boxShadow', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="style_title">
                        <AccordionTrigger>Title Style</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Background</Label><Input type="color" value={settings.titleBgColor || '#FFFFFF'} onChange={e => handleUpdate('titleBgColor', e.target.value)} /></div><div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.titleColor || '#000000'} onChange={e => handleUpdate('titleColor', e.target.value)} /></div></div>
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Active BG</Label><Input type="color" value={settings.activeTitleBgColor || '#F9FAFB'} onChange={e => handleUpdate('activeTitleBgColor', e.target.value)} /></div><div className="space-y-2"><Label>Active Text</Label><Input type="color" value={settings.activeTitleColor || '#000000'} onChange={e => handleUpdate('activeTitleColor', e.target.value)} /></div></div>
                            <div className="space-y-2"><Label>Typography</Label><Select value={settings.titleFontFamily || 'inherit'} onValueChange={v => handleUpdate('titleFontFamily', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inherit">Default</SelectItem><SelectItem value="Inter, sans-serif">Inter</SelectItem><SelectItem value="'Roboto', sans-serif">Roboto</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" placeholder="16" value={settings.titlePadding || ''} onChange={e => handleUpdate('titlePadding', Number(e.target.value))} /></div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="style_content">
                        <AccordionTrigger>Content Style</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Background</Label><Input type="color" value={settings.contentBgColor || '#FFFFFF'} onChange={e => handleUpdate('contentBgColor', e.target.value)} /></div><div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.contentColor || '#333333'} onChange={e => handleUpdate('contentColor', e.target.value)} /></div></div>
                            <div className="space-y-2"><Label>Typography</Label><Select value={settings.contentFontFamily || 'inherit'} onValueChange={v => handleUpdate('contentFontFamily', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inherit">Default</SelectItem><SelectItem value="Inter, sans-serif">Inter</SelectItem><SelectItem value="'Roboto', sans-serif">Roboto</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" placeholder="16" value={settings.contentPadding || ''} onChange={e => handleUpdate('contentPadding', Number(e.target.value))} /></div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>
            
            <TabsContent value="advanced" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['advanced_spacing']}>
                    <AccordionItem value="advanced_spacing">
                        <AccordionTrigger>Spacing</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2"><div className="space-y-2"><Label>Margin (T R B L) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><Input type="number" placeholder="R" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} /><Input type="number" placeholder="B" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /><Input type="number" placeholder="L" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} /></div></div></AccordionContent></AccordionItem>
                    <AccordionItem value="advanced_motion"><AccordionTrigger>Motion Effects</AccordionTrigger><AccordionContent className="space-y-4 pt-2"><div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fadeIn">Fade In</SelectItem><SelectItem value="fadeInUp">Fade In Up</SelectItem></SelectContent></Select></div></AccordionContent></AccordionItem>
                    <AccordionItem value="advanced_responsive"><AccordionTrigger>Responsive</AccordionTrigger><AccordionContent className="space-y-4 pt-2"><Label>Visibility</Label><div className="flex flex-col gap-2 rounded-md border p-3"><div className="flex items-center justify-between"><Label htmlFor="showOnDesktop" className="font-normal">Show on Desktop</Label><Switch id="showOnDesktop" checked={settings.responsiveVisibility?.desktop !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'desktop', val)} /></div><div className="flex items-center justify-between"><Label htmlFor="showOnTablet" className="font-normal">Show on Tablet</Label><Switch id="showOnTablet" checked={settings.responsiveVisibility?.tablet !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'tablet', val)} /></div><div className="flex items-center justify-between"><Label htmlFor="showOnMobile" className="font-normal">Show on Mobile</Label><Switch id="showOnMobile" checked={settings.responsiveVisibility?.mobile !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'mobile', val)} /></div></div></AccordionContent></AccordionItem>
                    <AccordionItem value="advanced_attributes"><AccordionTrigger>Attributes</AccordionTrigger><AccordionContent className="space-y-4 pt-2">{(settings.customAttributes || []).map((attr: any, index: number) => (<div key={attr.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center"><Input placeholder="Key" value={attr.key} onChange={e => handleAttributeChange(index, 'key', e.target.value)} /><Input placeholder="Value" value={attr.value} onChange={e => handleAttributeChange(index, 'value', e.target.value)} /><Button type="button" variant="ghost" size="icon" onClick={() => removeAttribute(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>))}<Button type="button" variant="outline" className="w-full" onClick={addAttribute}><Plus className="mr-2 h-4 w-4"/>Add Attribute</Button></AccordionContent></AccordionItem>
                    <AccordionItem value="advanced_custom"><AccordionTrigger>Custom CSS</AccordionTrigger><AccordionContent className="space-y-4 pt-2"><div className="space-y-2"><Label>CSS ID</Label><Input value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div><div className="space-y-2"><Label>CSS Classes</Label><Input value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div><div className="space-y-2"><Label>Custom CSS</Label><Textarea value={settings.customCss || ''} onChange={e => handleUpdate('customCss', e.target.value)} className="font-mono" placeholder={`selector {\n  color: red;\n}`}/></div></AccordionContent></AccordionItem>
                </Accordion>
            </TabsContent>
        </Tabs>
    );
}
