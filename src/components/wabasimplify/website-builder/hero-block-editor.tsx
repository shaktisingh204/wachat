
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const handleFileChange = (file: File | null, callback: (dataUri: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        callback(reader.result as string);
    };
    reader.readAsDataURL(file);
};

export function HeroBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['content', 'background', 'cta', 'layout']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger>Content & Typography</AccordionTrigger>
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
                            <Label>Text Color</Label>
                            <Input type="color" value={settings.textColor || '#FFFFFF'} onChange={(e) => handleUpdate('textColor', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Text Alignment</Label>
                            <Select value={settings.textAlign || 'center'} onValueChange={(val) => handleUpdate('textAlign', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
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
                            <Input id={`bg-image-${settings.id}`} type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleUpdate('backgroundImageUrl', dataUri))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Background Color (Fallback)</Label>
                            <Input type="color" value={settings.backgroundColor || '#111827'} onChange={(e) => handleUpdate('backgroundColor', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label>Overlay Color</Label>
                            <Input type="color" value={settings.overlayColor || '#000000'} onChange={(e) => handleUpdate('overlayColor', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label>Overlay Opacity</Label>
                            <Input type="range" min="0" max="1" step="0.1" value={settings.overlayOpacity || 0.3} onChange={(e) => handleUpdate('overlayOpacity', e.target.value)} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cta">
                    <AccordionTrigger>Call to Action Button</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Button Text</Label>
                            <Input placeholder="Shop Now" value={settings.buttonText || ''} onChange={(e) => handleUpdate('buttonText', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Button URL</Label>
                            <Input type="url" placeholder="https://..." value={settings.buttonLink || ''} onChange={(e) => handleUpdate('buttonLink', e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Button Color</Label>
                                <Input type="color" value={settings.buttonColor || '#FFFFFF'} onChange={(e) => handleUpdate('buttonColor', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Button Text Color</Label>
                                <Input type="color" value={settings.buttonTextColor || '#000000'} onChange={(e) => handleUpdate('buttonTextColor', e.target.value)} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="layout">
                    <AccordionTrigger>Layout & Sizing</AccordionTrigger>
                     <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Content Layout</Label>
                            <Select value={settings.layout || 'center'} onValueChange={(val) => handleUpdate('layout', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="offset-box">Offset Box</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Height</Label>
                            <Input placeholder="e.g. 500px or 80vh" value={settings.height || '600px'} onChange={e => handleUpdate('height', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label>Vertical Align</Label>
                             <Select value={settings.verticalAlign || 'center'} onValueChange={(val) => handleUpdate('verticalAlign', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="flex-start">Top</SelectItem>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="flex-end">Bottom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="advanced">
                    <AccordionTrigger>Advanced</AccordionTrigger>
                     <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Entrance Animation</Label>
                             <Select value={settings.animation || 'fade'} onValueChange={(val) => handleUpdate('animation', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="fade">Fade In</SelectItem>
                                    <SelectItem value="slide-up">Slide In Up</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>CSS ID</Label>
                            <Input value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>CSS Classes</Label>
                            <Input value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
