
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type AccordionItemData = {
  id: string;
  title: string;
  content: string;
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
    
    const handleSubFieldUpdate = (mainField: string, subField: string, value: any) => {
        onUpdate({
            ...settings,
            [mainField]: {
                ...(settings[mainField] || {}),
                [subField]: value
            }
        });
    }

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['items', 'settings', 'style_box', 'style_title', 'style_content', 'advanced_spacing']}>
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
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="settings">
                    <AccordionTrigger>Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Toggle Behavior</Label>
                            <Select value={settings.behavior || 'single'} onValueChange={(val) => handleUpdate('behavior', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="single">Accordion (One open at a time)</SelectItem>
                                    <SelectItem value="multiple">Toggle (Multiple open)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="style_box">
                    <AccordionTrigger>Accordion Box Style</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Space Between (px)</Label><Input type="number" placeholder="10" value={settings.spaceBetween || ''} onChange={e => handleUpdate('spaceBetween', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Border Type</Label><Select value={settings.border?.type || 'solid'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem><SelectItem value="dotted">Dotted</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Border Width (px)</Label><Input type="number" placeholder="1" value={settings.border?.width ?? ''} onChange={e => handleSubFieldUpdate('border', 'width', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Border Color</Label><Input type="color" value={settings.border?.color || '#e5e7eb'} onChange={e => handleSubFieldUpdate('border', 'color', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" placeholder="8" value={settings.border?.radius ?? ''} onChange={e => handleSubFieldUpdate('border', 'radius', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow || 'none'} onValueChange={v => handleUpdate('boxShadow', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem></SelectContent></Select></div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="style_title">
                    <AccordionTrigger>Title Style</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Background</Label><Input type="color" value={settings.titleBgColor || '#FFFFFF'} onChange={e => handleUpdate('titleBgColor', e.target.value)} /></div><div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.titleColor || '#000000'} onChange={e => handleUpdate('titleColor', e.target.value)} /></div></div>
                        <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Active BG</Label><Input type="color" value={settings.activeTitleBgColor || '#F9FAFB'} onChange={e => handleUpdate('activeTitleBgColor', e.target.value)} /></div><div className="space-y-2"><Label>Active Text</Label><Input type="color" value={settings.activeTitleColor || '#000000'} onChange={e => handleUpdate('activeTitleColor', e.target.value)} /></div></div>
                        <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" placeholder="16" value={settings.titlePadding || ''} onChange={e => handleUpdate('titlePadding', e.target.value)} /></div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="style_content">
                    <AccordionTrigger>Content Style</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Background</Label><Input type="color" value={settings.contentBgColor || '#FFFFFF'} onChange={e => handleUpdate('contentBgColor', e.target.value)} /></div><div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.contentColor || '#333333'} onChange={e => handleUpdate('contentColor', e.target.value)} /></div></div>
                        <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" placeholder="16" value={settings.contentPadding || ''} onChange={e => handleUpdate('contentPadding', e.target.value)} /></div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="advanced_spacing">
                    <AccordionTrigger>Advanced Spacing</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2"><Label>Margin (Top, Bottom) in px</Label><div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="Top" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><Input type="number" placeholder="Bottom" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /></div></div>
                         <div className="space-y-2"><Label>Padding (Top, Bottom) in px</Label><div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="Top" value={settings.padding?.top ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><Input type="number" placeholder="Bottom" value={settings.padding?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /></div></div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

