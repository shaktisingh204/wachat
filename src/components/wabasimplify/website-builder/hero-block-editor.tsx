'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function HeroBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: string) => {
        onUpdate({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor={`title-${settings.id}`}>Title</Label>
                <Input id={`title-${settings.id}`} value={settings.title || ''} onChange={(e) => handleUpdate('title', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`subtitle-${settings.id}`}>Subtitle</Label>
                <Textarea id={`subtitle-${settings.id}`} value={settings.subtitle || ''} onChange={(e) => handleUpdate('subtitle', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`bg-image-${settings.id}`}>Background Image URL</Label>
                <Input id={`bg-image-${settings.id}`} type="url" value={settings.backgroundImageUrl || ''} onChange={(e) => handleUpdate('backgroundImageUrl', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor={`bg-color-${settings.id}`}>Background Color</Label>
                    <Input id={`bg-color-${settings.id}`} type="color" value={settings.backgroundColor || '#111827'} onChange={(e) => handleUpdate('backgroundColor', e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor={`text-color-${settings.id}`}>Text Color</Label>
                    <Input id={`text-color-${settings.id}`} type="color" value={settings.textColor || '#FFFFFF'} onChange={(e) => handleUpdate('textColor', e.target.value)} />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor={`font-family-${settings.id}`}>Font Family</Label>
                 <Select value={settings.fontFamily || 'Inter'} onValueChange={(val) => handleUpdate('fontFamily', val)}>
                    <SelectTrigger id={`font-family-${settings.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Inter">Inter (sans-serif)</SelectItem>
                        <SelectItem value="Roboto">Roboto (sans-serif)</SelectItem>
                        <SelectItem value="Lato">Lato (sans-serif)</SelectItem>
                        <SelectItem value="Merriweather">Merriweather (serif)</SelectItem>
                        <SelectItem value="Playfair Display">Playfair Display (serif)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Call to Action Button (Optional)</Label>
                 <div className="grid grid-cols-3 gap-2">
                     <Input placeholder="Button Text" value={settings.buttonText || ''} onChange={(e) => handleUpdate('buttonText', e.target.value)} />
                    <Input type="color" value={settings.buttonColor || '#FFFFFF'} onChange={(e) => handleUpdate('buttonColor', e.target.value)} />
                    <Input type="color" value={settings.buttonTextColor || '#000000'} onChange={(e) => handleUpdate('buttonTextColor', e.target.value)} />
                </div>
            </div>
        </div>
    );
}
