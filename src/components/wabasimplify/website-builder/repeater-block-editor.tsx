
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';

type RepeaterItem = {
  id: string;
  imageUrl?: string;
  title: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
};

const handleFileChange = (file: File | null, callback: (dataUri: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        callback(reader.result as string);
    };
    reader.readAsDataURL(file);
};


export function RepeaterBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const items = settings.items || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleItemChange = (index: number, field: keyof RepeaterItem, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        handleUpdate('items', newItems);
    };

    const addItem = () => {
        const newItems = [...items, { id: uuidv4(), title: 'New Item' }];
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
            <Accordion type="multiple" className="w-full" defaultValue={['items', 'layout']}>
                <AccordionItem value="items">
                    <AccordionTrigger>Repeater Items</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        {items.map((item: RepeaterItem, index: number) => (
                            <Card key={item.id} className="relative bg-background">
                                <CardContent className="p-4 space-y-3">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeItem(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                    <h4 className="font-medium">Item {index + 1}</h4>
                                    <div className="space-y-2">
                                        <Label>Image</Label>
                                         <div className="flex items-center gap-2">
                                            <Input type="file" accept="image/*" className="flex-1" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleItemChange(index, 'imageUrl', dataUri))} />
                                            {item.imageUrl && <Image src={item.imageUrl} alt="preview" width={40} height={40} className="rounded-md object-cover" />}
                                        </div>
                                    </div>
                                    <div className="space-y-2"><Label>Title</Label><Input placeholder="Item Title" value={item.title || ''} onChange={(e) => handleItemChange(index, 'title', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Description</Label><Textarea placeholder="Item description..." value={item.description || ''} onChange={(e) => handleItemChange(index, 'description', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Button Text</Label><Input placeholder="e.g., Learn More" value={item.buttonText || ''} onChange={(e) => handleItemChange(index, 'buttonText', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Button Link</Label><Input placeholder="https://..." value={item.buttonLink || ''} onChange={(e) => handleItemChange(index, 'buttonLink', e.target.value)} /></div>
                                </CardContent>
                            </Card>
                        ))}
                        <Button type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add Item</Button>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="layout">
                    <AccordionTrigger>Layout Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Layout</Label>
                            <Select value={settings.layout || 'grid'} onValueChange={(val) => handleUpdate('layout', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="grid">Grid</SelectItem>
                                    <SelectItem value="list">List</SelectItem>
                                    <SelectItem value="carousel">Carousel</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {settings.layout === 'grid' && (
                            <div className="space-y-2">
                                <Label>Columns</Label>
                                <Select value={String(settings.columns || 3)} onValueChange={(val) => handleUpdate('columns', Number(val))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1</SelectItem>
                                        <SelectItem value="2">2</SelectItem>
                                        <SelectItem value="3">3</SelectItem>
                                        <SelectItem value="4">4</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                         {settings.layout === 'carousel' && (
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <Label>Loop</Label>
                                    <Switch checked={settings.loop || false} onCheckedChange={(val) => handleUpdate('loop', val)} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label>Autoplay</Label>
                                    <Switch checked={settings.autoplay || false} onCheckedChange={(val) => handleUpdate('autoplay', val)} />
                                </div>
                                {settings.autoplay && (
                                    <div className="space-y-2"><Label>Autoplay Delay (sec)</Label><Input type="number" value={settings.autoplayDelay || 4} onChange={e => handleUpdate('autoplayDelay', Number(e.target.value))} /></div>
                                )}
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="outerLayout">
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
