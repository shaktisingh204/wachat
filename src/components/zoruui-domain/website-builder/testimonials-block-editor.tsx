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
  Avatar,
} from '@/components/zoruui';
import { Plus, Trash2, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import Image from 'next/image';
import { SabFilePickerButton } from '@/components/sabfiles';

export function TestimonialsBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const testimonials = settings.testimonials || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleItemChange = (index: number, field: string, value: string) => {
        const newTestimonials = [...testimonials];
        newTestimonials[index] = { ...newTestimonials[index], [field]: value };
        handleUpdate('testimonials', newTestimonials);
    };

    const addItem = () => {
        const newTestimonials = [...testimonials, { id: uuidv4(), quote: '', author: '', title: '', avatar: '' }];
        handleUpdate('testimonials', newTestimonials);
    };

    const removeItem = (index: number) => {
        const newTestimonials = testimonials.filter((_: any, i: number) => i !== index);
        handleUpdate('testimonials', newTestimonials);
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
            <Accordion type="multiple" className="w-full" defaultValue={['content']}>
                <ZoruAccordionItem value="content">
                    <ZoruAccordionTrigger>Content</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor={`title-${settings.id}`}>Section Title</Label>
                            <Input id={`title-${settings.id}`} value={settings.title || 'What Our Customers Say'} onChange={(e) => onUpdate({ ...settings, title: e.target.value })} />
                        </div>
                        {testimonials.map((item: any, index: number) => (
                            <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-zoru-surface">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1" onClick={() => removeItem(index)}>
                                    <Trash2 className="h-4 w-4 text-zoru-ink" />
                                </Button>
                                <Label>Testimonial {index + 1}</Label>
                                <Textarea placeholder="Quote..." value={item.quote || ''} onChange={(e) => handleItemChange(index, 'quote', e.target.value)} />
                                <div className="flex items-center gap-2">
                                    <Input placeholder="Author Name" value={item.author || ''} onChange={(e) => handleItemChange(index, 'author', e.target.value)} />
                                    <Input placeholder="Author Title" value={item.title || ''} onChange={(e) => handleItemChange(index, 'title', e.target.value)} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <SabFilePickerButton
                                        accept="image"
                                        className="flex-1"
                                        onPick={({ url }) => handleItemChange(index, 'avatar', url)}
                                    >
                                        <Upload className="mr-2 h-4 w-4" /> {item.avatar ? 'Replace photo' : 'Pick photo'}
                                    </SabFilePickerButton>
                                    {item.avatar && <Image src={item.avatar} alt="Avatar Preview" width={32} height={32} className="rounded-full object-cover" />}
                                </div>
                            </div>
                        ))}
                        <Button type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add Testimonial</Button>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                 <ZoruAccordionItem value="layout">
                    <ZoruAccordionTrigger>Sizing &amp; Layout</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
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
                                <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="visible">Visible</ZoruSelectItem>
                                    <ZoruSelectItem value="hidden">Hidden</ZoruSelectItem>
                                    <ZoruSelectItem value="scroll">Scroll</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </Accordion>
        </div>
    );
}
