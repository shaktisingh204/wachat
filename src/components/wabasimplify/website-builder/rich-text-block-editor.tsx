
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function RichTextBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };
    
    const handleSubFieldUpdate = (mainField: string, subField: string, value: any) => {
        onUpdate({
            ...settings,
            [mainField]: {
                ...settings[mainField],
                [subField]: value
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor={`html-content-${settings.id}`}>Content (HTML supported)</Label>
                <Textarea
                    id={`html-content-${settings.id}`}
                    value={settings.htmlContent || ''}
                    onChange={(e) => handleUpdate('htmlContent', e.target.value)}
                    placeholder="Enter your formatted text or HTML here..."
                    className="h-48 font-mono"
                />
            </div>

             <Accordion type="multiple" className="w-full" defaultValue={['typography']}>
                <AccordionItem value="typography">
                    <AccordionTrigger>Typography</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Font Family</Label>
                            <Select value={settings.fontFamily || 'inherit'} onValueChange={(val) => handleUpdate('fontFamily', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inherit">Theme Default</SelectItem>
                                    <SelectItem value="Inter, sans-serif">Inter</SelectItem>
                                    <SelectItem value="'Roboto', sans-serif">Roboto</SelectItem>
                                    <SelectItem value="'Lato', sans-serif">Lato</SelectItem>
                                    <SelectItem value="'Merriweather', serif">Merriweather</SelectItem>
                                    <SelectItem value="'Playfair Display', serif">Playfair Display</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2"><Label>Font Size (px)</Label><Input type="number" value={settings.fontSize || ''} onChange={(e) => handleUpdate('fontSize', e.target.value)} placeholder="e.g. 16" /></div>
                            <div className="space-y-2"><Label>Line Height</Label><Input type="number" step="0.1" value={settings.lineHeight || ''} onChange={(e) => handleUpdate('lineHeight', e.target.value)} placeholder="e.g. 1.5" /></div>
                        </div>
                         <div className="space-y-2">
                            <Label>Color</Label>
                            <Input type="color" value={settings.color || '#333333'} onChange={(e) => handleUpdate('color', e.target.value)} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="layout">
                    <AccordionTrigger>Layout & Spacing</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Alignment</Label>
                            <Select value={settings.textAlign || 'left'} onValueChange={(val) => handleUpdate('textAlign', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
                                    <SelectItem value="justify">Justify</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Padding (Top, Right, Bottom, Left) in px</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <Input type="number" placeholder="Top" value={settings.padding?.top || ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value)} />
                                <Input type="number" placeholder="Right" value={settings.padding?.right || ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value)} />
                                <Input type="number" placeholder="Bottom" value={settings.padding?.bottom || ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value)} />
                                <Input type="number" placeholder="Left" value={settings.padding?.left || ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value)} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="effects">
                    <AccordionTrigger>Effects & Animation</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Animation</Label>
                            <Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="fade">Fade In</SelectItem>
                                    <SelectItem value="slide">Slide In</SelectItem>
                                    <SelectItem value="zoom">Zoom In</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
