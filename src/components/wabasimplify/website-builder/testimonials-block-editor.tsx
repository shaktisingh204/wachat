
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function TestimonialsBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const testimonials = settings.testimonials || [];

    const handleTestimonialChange = (index: number, field: string, value: string) => {
        const newTestimonials = [...testimonials];
        newTestimonials[index] = { ...newTestimonials[index], [field]: value };
        onUpdate({ ...settings, testimonials: newTestimonials });
    };

    const addTestimonial = () => {
        const newTestimonials = [...testimonials, { id: uuidv4(), quote: '', author: '', title: '' }];
        onUpdate({ ...settings, testimonials: newTestimonials });
    };

    const removeTestimonial = (index: number) => {
        const newTestimonials = testimonials.filter((_: any, i: number) => i !== index);
        onUpdate({ ...settings, testimonials: newTestimonials });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor={`title-${settings.id}`}>Section Title</Label>
                <Input id={`title-${settings.id}`} value={settings.title || 'What Our Customers Say'} onChange={(e) => onUpdate({ ...settings, title: e.target.value })} />
            </div>
            {testimonials.map((item: any, index: number) => (
                <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1" onClick={() => removeTestimonial(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Label>Testimonial {index + 1}</Label>
                    <Textarea placeholder="Quote..." value={item.quote || ''} onChange={(e) => handleTestimonialChange(index, 'quote', e.target.value)} />
                    <Input placeholder="Author Name" value={item.author || ''} onChange={(e) => handleTestimonialChange(index, 'author', e.target.value)} />
                    <Input placeholder="Author Title" value={item.title || ''} onChange={(e) => handleTestimonialChange(index, 'title', e.target.value)} />
                </div>
            ))}
            <Button type="button" variant="outline" onClick={addTestimonial}><Plus className="mr-2 h-4 w-4" /> Add Testimonial</Button>
        </div>
    );
}
