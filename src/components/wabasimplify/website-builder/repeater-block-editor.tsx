
'use client';

import { ZoruLabel, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { Plus, Trash2, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruSwitch } from '@/components/zoruui';
import { ZoruSeparator } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import Image from 'next/image';
import { SabFilePickerButton } from '@/components/sabfiles';

type RepeaterItem = {
  id: string;
  imageUrl?: string;
  title: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
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
            <ZoruAccordion type="multiple" className="w-full" defaultValue={['items', 'layout']}>
                <ZoruAccordionItem value="items">
                    <ZoruAccordionTrigger>Repeater Items</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        {items.map((item: RepeaterItem, index: number) => (
                            <ZoruCard key={item.id} className="relative bg-background">
                                <ZoruCardContent className="p-4 space-y-3">
                                    <ZoruButton type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeItem(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </ZoruButton>
                                    <h4 className="font-medium">Item {index + 1}</h4>
                                    <div className="space-y-2">
                                        <ZoruLabel>Image</ZoruLabel>
                                         <div className="flex items-center gap-2">
                                            <SabFilePickerButton
                                                accept="image"
                                                className="flex-1"
                                                onPick={({ url }) => handleItemChange(index, 'imageUrl', url)}
                                            >
                                                <Upload className="mr-2 h-4 w-4" /> {item.imageUrl ? 'Replace image' : 'Pick image'}
                                            </SabFilePickerButton>
                                            {item.imageUrl && <Image src={item.imageUrl} alt="preview" width={40} height={40} className="rounded-md object-cover" />}
                                        </div>
                                    </div>
                                    <div className="space-y-2"><ZoruLabel>Title</ZoruLabel><ZoruInput placeholder="Item Title" value={item.title || ''} onChange={(e) => handleItemChange(index, 'title', e.target.value)} /></div>
                                    <div className="space-y-2"><ZoruLabel>Description</ZoruLabel><ZoruTextarea placeholder="Item description..." value={item.description || ''} onChange={(e) => handleItemChange(index, 'description', e.target.value)} /></div>
                                    <div className="space-y-2"><ZoruLabel>ZoruButton Text</ZoruLabel><ZoruInput placeholder="e.g., Learn More" value={item.buttonText || ''} onChange={(e) => handleItemChange(index, 'buttonText', e.target.value)} /></div>
                                    <div className="space-y-2"><ZoruLabel>ZoruButton Link</ZoruLabel><ZoruInput placeholder="https://..." value={item.buttonLink || ''} onChange={(e) => handleItemChange(index, 'buttonLink', e.target.value)} /></div>
                                </ZoruCardContent>
                            </ZoruCard>
                        ))}
                        <ZoruButton type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add Item</ZoruButton>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                <ZoruAccordionItem value="layout">
                    <ZoruAccordionTrigger>Layout Settings</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <ZoruLabel>Layout</ZoruLabel>
                            <ZoruSelect value={settings.layout || 'grid'} onValueChange={(val) => handleUpdate('layout', val)}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="grid">Grid</ZoruSelectItem>
                                    <ZoruSelectItem value="list">List</ZoruSelectItem>
                                    <ZoruSelectItem value="carousel">Carousel</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        {settings.layout === 'grid' && (
                            <div className="space-y-2">
                                <ZoruLabel>Columns</ZoruLabel>
                                <ZoruSelect value={String(settings.columns || 3)} onValueChange={(val) => handleUpdate('columns', Number(val))}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="1">1</ZoruSelectItem>
                                        <ZoruSelectItem value="2">2</ZoruSelectItem>
                                        <ZoruSelectItem value="3">3</ZoruSelectItem>
                                        <ZoruSelectItem value="4">4</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        )}
                         {settings.layout === 'carousel' && (
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between">
                                    <ZoruLabel>Loop</ZoruLabel>
                                    <ZoruSwitch checked={settings.loop || false} onCheckedChange={(val) => handleUpdate('loop', val)} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <ZoruLabel>Autoplay</ZoruLabel>
                                    <ZoruSwitch checked={settings.autoplay || false} onCheckedChange={(val) => handleUpdate('autoplay', val)} />
                                </div>
                                {settings.autoplay && (
                                    <div className="space-y-2"><ZoruLabel>Autoplay Delay (sec)</ZoruLabel><ZoruInput type="number" value={settings.autoplayDelay || 4} onChange={e => handleUpdate('autoplayDelay', Number(e.target.value))} /></div>
                                )}
                            </div>
                        )}
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                 <ZoruAccordionItem value="outerLayout">
                    <ZoruAccordionTrigger>Sizing &amp; Layout</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Width</ZoruLabel>
                                <ZoruInput value={settings.layout?.width || '100%'} onChange={e => handleSubFieldUpdate('layout', 'width', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Height</ZoruLabel>
                                <ZoruInput value={settings.layout?.height || 'auto'} onChange={e => handleSubFieldUpdate('layout', 'height', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Max Width</ZoruLabel>
                                <ZoruInput value={settings.layout?.maxWidth || ''} placeholder="e.g. 1200px" onChange={e => handleSubFieldUpdate('layout', 'maxWidth', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Min Height</ZoruLabel>
                                <ZoruInput value={settings.layout?.minHeight || ''} placeholder="e.g. 200px" onChange={e => handleSubFieldUpdate('layout', 'minHeight', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Overflow</ZoruLabel>
                            <ZoruSelect value={settings.layout?.overflow || 'visible'} onValueChange={(val) => handleSubFieldUpdate('layout', 'overflow', val)}>
                                <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="visible">Visible</ZoruSelectItem>
                                    <ZoruSelectItem value="hidden">Hidden</ZoruSelectItem>
                                    <ZoruSelectItem value="scroll">Scroll</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </ZoruAccordion>
        </div>
    );
}
