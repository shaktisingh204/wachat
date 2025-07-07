
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="settings">
                    <AccordionTrigger>Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Behavior</Label>
                            <Select value={settings.behavior || 'single'} onValueChange={(val) => handleUpdate('behavior', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="single">Single (Only one open at a time)</SelectItem>
                                    <SelectItem value="multiple">Multiple (Allow several open)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Background Color</Label>
                            <Input type="color" value={settings.backgroundColor || '#FFFFFF'} onChange={(e) => handleUpdate('backgroundColor', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Border</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <Input type="number" placeholder="Width (px)" value={settings.border?.width || '1'} onChange={(e) => handleSubFieldUpdate('border', 'width', e.target.value)} />
                                <Input type="color" value={settings.border?.color || '#e5e7eb'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} />
                                <Select value={settings.border?.style || 'solid'} onValueChange={(val) => handleSubFieldUpdate('border', 'style', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="solid">Solid</SelectItem>
                                        <SelectItem value="dashed">Dashed</SelectItem>
                                        <SelectItem value="dotted">Dotted</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="layout">
                    <AccordionTrigger>Sizing &amp; Layout</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Width</Label>
                                <Input value={settings.layout?.width || '100%'} onChange={e => handleSubFieldUpdate('layout', 'width', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Height</Label>
                                <Input value={settings.layout?.height || 'auto'} onChange={e => handleSubFieldUpdate('layout', 'height', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Max Width</Label>
                                <Input value={settings.layout?.maxWidth || ''} placeholder="e.g. 1200px" onChange={e => handleSubFieldUpdate('layout', 'maxWidth', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Min Height</Label>
                                <Input value={settings.layout?.minHeight || ''} placeholder="e.g. 200px" onChange={e => handleSubFieldUpdate('layout', 'minHeight', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Overflow</Label>
                            <Select value={settings.layout?.overflow || 'visible'} onValueChange={(val) => handleSubFieldUpdate('layout', 'overflow', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="visible">Visible</SelectItem>
                                    <SelectItem value="hidden">Hidden</SelectItem>
                                    <SelectItem value="scroll">Scroll</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
