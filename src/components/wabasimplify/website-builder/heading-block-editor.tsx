
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function HeadingBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
                <Label htmlFor={`text-${settings.id}`}>Text</Label>
                <Textarea id={`text-${settings.id}`} value={settings.text || 'Heading Text'} onChange={(e) => handleUpdate('text', e.target.value)} />
            </div>

            <Accordion type="multiple" className="w-full" defaultValue={['typography']}>
                <AccordionItem value="typography">
                    <AccordionTrigger>Typography</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>HTML Tag</Label>
                            <Select value={settings.htmlTag || 'h2'} onValueChange={(val) => handleUpdate('htmlTag', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="h1">H1</SelectItem>
                                    <SelectItem value="h2">H2</SelectItem>
                                    <SelectItem value="h3">H3</SelectItem>
                                    <SelectItem value="h4">H4</SelectItem>
                                    <SelectItem value="h5">H5</SelectItem>
                                    <SelectItem value="h6">H6</SelectItem>
                                    <SelectItem value="div">div</SelectItem>
                                    <SelectItem value="span">span</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-2"><Label>Size (px)</Label><Input type="number" value={settings.fontSize || ''} onChange={(e) => handleUpdate('fontSize', e.target.value)} placeholder="e.g. 24" /></div>
                            <div className="space-y-2"><Label>Weight</Label><Select value={settings.fontWeight || 'normal'} onValueChange={(val) => handleUpdate('fontWeight', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="bold">Bold</SelectItem><SelectItem value="300">300</SelectItem><SelectItem value="500">500</SelectItem><SelectItem value="700">700</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Style</Label><Select value={settings.fontStyle || 'normal'} onValueChange={(val) => handleUpdate('fontStyle', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="italic">Italic</SelectItem></SelectContent></Select></div>
                        </div>
                         <div className="space-y-2">
                            <Label>Color</Label>
                            <Input type="color" value={settings.color || '#000000'} onChange={(e) => handleUpdate('color', e.target.value)} />
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
                            <Label>Margin (Top, Right, Bottom, Left) in px</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <Input type="number" placeholder="Top" value={settings.margin?.top || ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value)} />
                                <Input type="number" placeholder="Right" value={settings.margin?.right || ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value)} />
                                <Input type="number" placeholder="Bottom" value={settings.margin?.bottom || ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value)} />
                                <Input type="number" placeholder="Left" value={settings.margin?.left || ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value)} />
                            </div>
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
                            <Label>Text Shadow</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <Input type="number" placeholder="X" value={settings.textShadow?.x || '0'} onChange={(e) => handleSubFieldUpdate('textShadow', 'x', e.target.value)} />
                                <Input type="number" placeholder="Y" value={settings.textShadow?.y || '0'} onChange={(e) => handleSubFieldUpdate('textShadow', 'y', e.target.value)} />
                                <Input type="number" placeholder="Blur" value={settings.textShadow?.blur || '0'} onChange={(e) => handleSubFieldUpdate('textShadow', 'blur', e.target.value)} />
                                <Input type="color" value={settings.textShadow?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('textShadow', 'color', e.target.value)} />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Animation</Label>
                            <Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="fade">Fade In</SelectItem>
                                    <SelectItem value="slide">Slide In</SelectItem>
                                    <SelectItem value="zoom">Zoom In</SelectItem>
                                    <SelectItem value="bounce">Bounce</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
