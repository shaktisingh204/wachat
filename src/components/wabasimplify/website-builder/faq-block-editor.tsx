
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function FaqBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const faqItems = settings.faqItems || [];

    const handleItemChange = (index: number, field: 'question' | 'answer', value: string) => {
        const newItems = [...faqItems];
        newItems[index] = { ...newItems[index], [field]: value };
        onUpdate({ ...settings, faqItems: newItems });
    };

    const addItem = () => {
        const newItems = [...faqItems, { id: uuidv4(), question: '', answer: '' }];
        onUpdate({ ...settings, faqItems: newItems });
    };

    const removeItem = (index: number) => {
        const newItems = faqItems.filter((_: any, i: number) => i !== index);
        onUpdate({ ...settings, faqItems: newItems });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor={`title-${settings.id}`}>Section Title</Label>
                <Input id={`title-${settings.id}`} value={settings.title || 'Frequently Asked Questions'} onChange={(e) => onUpdate({ ...settings, title: e.target.value })} />
            </div>
            {faqItems.map((item: any, index: number) => (
                <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Label>FAQ {index + 1}</Label>
                    <Input placeholder="Question..." value={item.question || ''} onChange={(e) => handleItemChange(index, 'question', e.target.value)} />
                    <Textarea placeholder="Answer..." value={item.answer || ''} onChange={(e) => handleItemChange(index, 'answer', e.target.value)} />
                </div>
            ))}
            <Button type="button" variant="outline" onClick={addItem}><Plus className="mr-2 h-4 w-4" /> Add FAQ</Button>
        </div>
    );
}
