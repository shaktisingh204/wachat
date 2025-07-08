
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as LucideIcons from 'lucide-react';
import { Switch } from '../ui/switch';

const iconNames = Object.keys(LucideIcons).filter(key => typeof (LucideIcons as any)[key] === 'object' && /^[A-Z]/.test(key));

type Tab = {
  id: string;
  label: string;
  icon?: string;
  content: string;
};

export function TabsBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const tabs = settings.tabs || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleTabChange = (index: number, field: keyof Tab, value: string) => {
        const newTabs = [...tabs];
        newTabs[index] = { ...newTabs[index], [field]: value };
        handleUpdate('tabs', newTabs);
    };

    const addTab = () => {
        const newTabs = [...tabs, { id: uuidv4(), label: `New Tab ${tabs.length + 1}`, content: 'Tab content' }];
        handleUpdate('tabs', newTabs);
    };

    const removeTab = (index: number) => {
        const newTabs = tabs.filter((_: any, i: number) => i !== index);
        handleUpdate('tabs', newTabs);
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

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['content']}>
                <AccordionItem value="content">
                    <AccordionTrigger>Content</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        {tabs.map((tab: Tab, index: number) => (
                            <div key={tab.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeTab(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                                <Label>Tab {index + 1}</Label>
                                <Input placeholder="Tab Label" value={tab.label || ''} onChange={(e) => handleTabChange(index, 'label', e.target.value)} />
                                <Select value={tab.icon || ''} onValueChange={(val) => handleTabChange(index, 'icon', val)}>
                                    <SelectTrigger><SelectValue placeholder="Select an icon..."/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">No Icon</SelectItem>
                                        {iconNames.map(iconName => (
                                            <SelectItem key={iconName} value={iconName}>{iconName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Textarea placeholder="Tab content..." value={tab.content || ''} onChange={(e) => handleTabChange(index, 'content', e.target.value)} />
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addTab}><Plus className="mr-2 h-4 w-4" /> Add Tab</Button>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="layout">
                    <AccordionTrigger>Layout</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Alignment</Label>
                            <Select value={settings.alignment || 'start'} onValueChange={(val) => handleUpdate('alignment', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="start">Left</SelectItem>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="end">Right</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="style">
                    <AccordionTrigger>Style</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <Accordion type="multiple" className="w-full" defaultValue={['style_tabs_list']}>
                            <AccordionItem value="style_tabs_list">
                                <AccordionTrigger className="text-sm">Tabs List</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.tabsListBgColor || '#f1f5f9'} onChange={e => handleUpdate('tabsListBgColor', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Border Radius</Label><Input type="number" value={settings.tabsListBorderRadius || 8} onChange={e => handleUpdate('tabsListBorderRadius', Number(e.target.value))} /></div>
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="style_tabs_trigger">
                                <AccordionTrigger className="text-sm">Tab Button</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.tabTextColor || '#64748b'} onChange={e => handleUpdate('tabTextColor', e.target.value)} /></div>
                                        <div className="space-y-2"><Label>Active Text Color</Label><Input type="color" value={settings.activeTabTextColor || '#0f172a'} onChange={e => handleUpdate('activeTabTextColor', e.target.value)} /></div>
                                        <div className="space-y-2"><Label>Active BG Color</Label><Input type="color" value={settings.activeTabBgColor || '#ffffff'} onChange={e => handleUpdate('activeTabBgColor', e.target.value)} /></div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                             <AccordionItem value="style_tabs_content">
                                <AccordionTrigger className="text-sm">Content Panel</AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-2">
                                     <div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.contentBgColor || '#ffffff'} onChange={e => handleUpdate('contentBgColor', e.target.value)} /></div>
                                     <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.contentTextColor || '#334155'} onChange={e => handleUpdate('contentTextColor', e.target.value)} /></div>
                                     <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" value={settings.contentPadding || 16} onChange={e => handleUpdate('contentPadding', Number(e.target.value))} /></div>
                                     <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" value={settings.contentBorderRadius || 8} onChange={e => handleUpdate('contentBorderRadius', Number(e.target.value))} /></div>
                                </AccordionContent>
                            </AccordionItem>
                         </Accordion>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="advanced">
                    <AccordionTrigger>Advanced</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Margin (Top, Right, Bottom, Left) in px</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <Input type="number" placeholder="Top" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} />
                                <Input type="number" placeholder="Right" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} />
                                <Input type="number" placeholder="Bottom" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} />
                                <Input type="number" placeholder="Left" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Padding (Top, Right, Bottom, Left) in px</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <Input type="number" placeholder="Top" value={settings.padding?.top ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} />
                                <Input type="number" placeholder="Right" value={settings.padding?.right ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} />
                                <Input type="number" placeholder="Bottom" value={settings.padding?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} />
                                <Input type="number" placeholder="Left" value={settings.padding?.left ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Responsive Visibility</Label>
                             <div className="flex items-center gap-2">
                                <Switch id="showOnDesktop" checked={settings.responsiveVisibility?.desktop !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'desktop', val)} />
                                <Switch id="showOnTablet" checked={settings.responsiveVisibility?.tablet !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'tablet', val)} />
                                <Switch id="showOnMobile" checked={settings.responsiveVisibility?.mobile !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'mobile', val)} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
