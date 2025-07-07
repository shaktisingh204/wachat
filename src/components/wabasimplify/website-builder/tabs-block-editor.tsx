
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

const iconNames = Object.keys(LucideIcons).filter(key => typeof (LucideIcons as any)[key] === 'object' && /^[A-Z]/.test(key));

export function TabsBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const tabs = settings.tabs || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };
    
    const handleTabChange = (index: number, field: string, value: string) => {
        const newTabs = [...tabs];
        newTabs[index] = { ...newTabs[index], [field]: value };
        handleUpdate('tabs', newTabs);
    };

    const addTab = () => {
        const newTabs = [...tabs, { id: uuidv4(), label: 'New Tab', content: 'Tab content' }];
        handleUpdate('tabs', newTabs);
    };

    const removeTab = (index: number) => {
        const newTabs = tabs.filter((_: any, i: number) => i !== index);
        handleUpdate('tabs', newTabs);
    };

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['tabs', 'settings']}>
                <AccordionItem value="tabs">
                    <AccordionTrigger>Tabs Content</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         {tabs.map((tab: any, index: number) => (
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
                 <AccordionItem value="settings">
                    <AccordionTrigger>Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Layout</Label>
                            <Select value={settings.layout || 'horizontal'} onValueChange={(val) => handleUpdate('layout', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="horizontal">Horizontal</SelectItem>
                                    <SelectItem value="vertical">Vertical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Animation</Label>
                            <Select value={settings.animation || 'fade'} onValueChange={(val) => handleUpdate('animation', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fade">Fade</SelectItem>
                                    <SelectItem value="slide">Slide</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Active Tab BG</Label>
                                <Input type="color" value={settings.activeTabBgColor || '#000000'} onChange={(e) => handleUpdate('activeTabBgColor', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Active Tab Text</Label>
                                <Input type="color" value={settings.activeTabTextColor || '#FFFFFF'} onChange={(e) => handleUpdate('activeTabTextColor', e.target.value)} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
