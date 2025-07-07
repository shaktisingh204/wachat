
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';

type CarouselImage = {
  id: string;
  src: string;
  link?: string;
  caption?: string;
};

const handleFileChange = (file: File | null, callback: (dataUri: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        callback(reader.result as string);
    };
    reader.readAsDataURL(file);
};

export function ImageCarouselBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const images = settings.images || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleImageChange = (index: number, field: 'src' | 'link' | 'caption', value: string) => {
        const newImages = [...images];
        newImages[index] = { ...newImages[index], [field]: value };
        handleUpdate('images', newImages);
    };

    const addImage = () => {
        const newImages = [...images, { id: uuidv4(), src: '', link: '', caption: '' }];
        handleUpdate('images', newImages);
    };

    const removeImage = (index: number) => {
        const newImages = images.filter((_: any, i: number) => i !== index);
        handleUpdate('images', newImages);
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
            <Accordion type="multiple" className="w-full" defaultValue={['slides', 'settings']}>
                <AccordionItem value="slides">
                    <AccordionTrigger>Slides</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        {images.map((item: CarouselImage, index: number) => (
                            <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeImage(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                                <Label>Slide {index + 1}</Label>
                                 <div className="flex items-center gap-2">
                                    <Input type="file" accept="image/*" className="flex-1" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleImageChange(index, 'src', dataUri))} />
                                    {item.src && <Image src={item.src} alt="preview" width={40} height={40} className="rounded-md object-cover" />}
                                </div>
                                <Input placeholder="Link URL (Optional)" value={item.link || ''} onChange={(e) => handleImageChange(index, 'link', e.target.value)} />
                                <Input placeholder="Caption (Optional)" value={item.caption || ''} onChange={(e) => handleImageChange(index, 'caption', e.target.value)} />
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addImage}><Plus className="mr-2 h-4 w-4" /> Add Slide</Button>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="settings">
                    <AccordionTrigger>Carousel Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <Label>Loop</Label>
                            <Switch checked={settings.loop || false} onCheckedChange={(val) => handleUpdate('loop', val)} />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Show Arrows</Label>
                            <Switch checked={settings.showArrows !== false} onCheckedChange={(val) => handleUpdate('showArrows', val)} />
                        </div>
                         <div className="flex items-center justify-between">
                            <Label>Show Dots</Label>
                            <Switch checked={settings.showDots !== false} onCheckedChange={(val) => handleUpdate('showDots', val)} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <Label>Autoplay</Label>
                            <Switch checked={settings.autoplay || false} onCheckedChange={(val) => handleUpdate('autoplay', val)} />
                        </div>
                        {settings.autoplay && (
                            <div className="space-y-2">
                                <Label>Autoplay Delay (seconds)</Label>
                                <Input type="number" value={settings.autoplayDelay || 4} onChange={e => handleUpdate('autoplayDelay', Number(e.target.value))} />
                            </div>
                        )}
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
