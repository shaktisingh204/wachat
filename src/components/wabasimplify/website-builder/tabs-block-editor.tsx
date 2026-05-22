'use client';

import {
  Label,
  Button,
  Input,
  Textarea,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Separator,
} from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import * as LucideIcons from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
        <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Content Tab */}
            <TabsContent value="content" className="pt-4">
                <Accordion type="multiple" className="w-full" defaultValue={['items', 'settings']}>
                    <ZoruAccordionItem value="items">
                        <ZoruAccordionTrigger>Tabs</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            {tabs.map((tab: Tab, index: number) => (
                                <div key={tab.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeTab(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                    <Label>Tab {index + 1}</Label>
                                    <Input placeholder="Tab Label" value={tab.label || ''} onChange={(e) => handleTabChange(index, 'label', e.target.value)} />
                                    <Select value={tab.icon || '__none__'} onValueChange={(val) => handleTabChange(index, 'icon', val === '__none__' ? '' : val)}>
                                        <ZoruSelectTrigger><ZoruSelectValue placeholder="Select an icon..."/></ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="__none__">No Icon</ZoruSelectItem>
                                            {iconNames.map(iconName => (
                                                <ZoruSelectItem key={iconName} value={iconName}>{iconName}</ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </Select>
                                    <Textarea placeholder="Tab content..." value={tab.content || ''} onChange={(e) => handleTabChange(index, 'content', e.target.value)} />
                                </div>
                            ))}
                            <Button type="button" variant="outline" onClick={addTab}><Plus className="mr-2 h-4 w-4" /> Add Tab</Button>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="settings">
                        <ZoruAccordionTrigger>Settings</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <Label>Default Active Tab</Label>
                                <Select value={settings.defaultActiveTab || (tabs[0]?.id || '')} onValueChange={(val) => handleUpdate('defaultActiveTab', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {tabs.map((tab: Tab) => <ZoruSelectItem key={tab.id} value={tab.id}>{tab.label}</ZoruSelectItem>)}
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Alignment</Label>
                                <Select value={settings.alignment || 'start'} onValueChange={(val) => handleUpdate('alignment', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="start">Left</ZoruSelectItem>
                                        <ZoruSelectItem value="center">Center</ZoruSelectItem>
                                        <ZoruSelectItem value="end">Right</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Icon Position</Label>
                                <Select value={settings.iconPosition || 'left'} onValueChange={(val) => handleUpdate('iconPosition', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="left">Left</ZoruSelectItem>
                                        <ZoruSelectItem value="right">Right</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between"><Label>Stretch Tabs</Label><Switch checked={settings.stretchTabs} onCheckedChange={v => handleUpdate('stretchTabs', v)} /></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </Accordion>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_tabs_list']}>
                    <ZoruAccordionItem value="style_tabs_list">
                        <ZoruAccordionTrigger>Tabs (Header)</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.tabsListBgColor || '#f1f5f9'} onChange={e => handleUpdate('tabsListBgColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.tabTextColor || '#64748b'} onChange={e => handleUpdate('tabTextColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Active Text Color</Label><Input type="color" value={settings.activeTabTextColor || '#0f172a'} onChange={e => handleUpdate('activeTabTextColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Active BG Color</Label><Input type="color" value={settings.activeTabBgColor || '#ffffff'} onChange={e => handleUpdate('activeTabBgColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Spacing (Gap)</Label><Input type="number" placeholder="e.g. 4" value={settings.tabSpacing || ''} onChange={e => handleUpdate('tabSpacing', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Border Radius</Label><Input type="number" placeholder="e.g. 8" value={settings.tabsListBorderRadius || 8} onChange={e => handleUpdate('tabsListBorderRadius', Number(e.target.value))} /></div>
                            <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.tabsListShadow || 'none'} onValueChange={v => handleUpdate('tabsListShadow', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></Select></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_tabs_content">
                        <ZoruAccordionTrigger>Content Panel</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.contentBgColor || '#ffffff'} onChange={e => handleUpdate('contentBgColor', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.contentTextColor || '#334155'} onChange={e => handleUpdate('contentTextColor', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" value={settings.contentPadding || 16} onChange={e => handleUpdate('contentPadding', Number(e.target.value))} /></div>
                             <div className="space-y-2"><Label>Border Type</Label><Select value={settings.contentBorderType || 'solid'} onValueChange={v => handleUpdate('contentBorderType', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem></ZoruSelectContent></Select></div>
                             <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" value={settings.contentBorderRadius || 8} onChange={e => handleUpdate('contentBorderRadius', Number(e.target.value))} /></div>
                             <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.contentShadow || 'none'} onValueChange={v => handleUpdate('contentShadow', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></Select></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                 </Accordion>
            </TabsContent>

             {/* Advanced Tab */}
            <TabsContent value="advanced" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['advanced_spacing']}>
                    <ZoruAccordionItem value="advanced_spacing">
                        <ZoruAccordionTrigger>Spacing</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Margin (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><Input type="number" placeholder="R" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} /><Input type="number" placeholder="B" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /><Input type="number" placeholder="L" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} /></div></div>
                             <div className="space-y-2"><Label>Padding (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.padding?.top ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><Input type="number" placeholder="R" value={settings.padding?.right ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><Input type="number" placeholder="B" value={settings.padding?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><Input type="number" placeholder="L" value={settings.padding?.left ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </Accordion>
             </TabsContent>
        </Tabs>
    );
}
