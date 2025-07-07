
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function HeroBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: string) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            onUpdate({ ...settings, backgroundImageUrl: reader.result as string });
        };
        reader.readAsDataURL(file);
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
            <Accordion type="multiple" defaultValue={['content']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger>Content</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor={`title-${settings.id}`}>Title</Label>
                            <Input id={`title-${settings.id}`} value={settings.title || ''} onChange={(e) => handleUpdate('title', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`subtitle-${settings.id}`}>Subtitle</Label>
                            <Textarea id={`subtitle-${settings.id}`} value={settings.subtitle || ''} onChange={(e) => handleUpdate('subtitle', e.target.value)} />
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
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="background">
                    <AccordionTrigger>Background</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor={`bg-image-${settings.id}`}>Background Image Upload</Label>
                            <Input id={`bg-image-${settings.id}`} type="file" accept="image/*" onChange={handleFileChange} />
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
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cta">
                    <AccordionTrigger>Call to Action Button (Optional)</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-3 gap-2">
                            <Input className="col-span-3" placeholder="Button Text" value={settings.buttonText || ''} onChange={(e) => handleUpdate('buttonText', e.target.value)} />
                            <Input type="color" value={settings.buttonColor || '#FFFFFF'} onChange={(e) => handleUpdate('buttonColor', e.target.value)} />
                            <Input type="color" value={settings.buttonTextColor || '#000000'} onChange={(e) => handleUpdate('buttonTextColor', e.target.value)} />
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
