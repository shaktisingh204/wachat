
'use client';

import { ZoruLabel, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';


export function FaqBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const faqItems = settings.faqItems || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleItemChange = (index: number, field: 'question' | 'answer', value: string) => {
        const newItems = [...faqItems];
        newItems[index] = { ...newItems[index], [field]: value };
        handleUpdate('faqItems', newItems);
    };

    const addItem = () => {
        const newItems = [...faqItems, { id: uuidv4(), question: '', answer: '' }];
        handleUpdate('faqItems', newItems);
    };

    const removeItem = (index: number) => {
        const newItems = faqItems.filter((_: any, i: number) => i !== index);
        handleUpdate('faqItems', newItems);
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
            <ZoruAccordion type="multiple" className="w-full" defaultValue={['content']}>
                <ZoruAccordionItem value="content">
                    <ZoruAccordionTrigger>Content</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor={`title-${settings.id}`}>Section Title</ZoruLabel>
                            <ZoruInput id={`title-${settings.id}`} value={settings.title || 'Frequently Asked Questions'} onChange={(e) => onUpdate({ ...settings, title: e.target.value })} />
                        </div>
                        {faqItems.map((item: any, index: number) => (
                            <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                                <ZoruButton type="button" variant="ghost" size="icon" className="absolute top-1 right-1" onClick={() => removeItem(index)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </ZoruButton>
                                <ZoruLabel>FAQ {index + 1}</ZoruLabel>
                                <ZoruInput placeholder="Question..." value={item.question || ''} onChange={(e) => handleItemChange(index, 'question', e.target.value)} />
                                <ZoruTextarea placeholder="Answer..." value={item.answer || ''} onChange={(e) => handleItemChange(index, 'answer', e.target.value)} />
                            </div>
                        ))}
                        <ZoruButton type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add FAQ</ZoruButton>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                <ZoruAccordionItem value="layout">
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
