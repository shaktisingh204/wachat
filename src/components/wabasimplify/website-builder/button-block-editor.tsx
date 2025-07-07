
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import * as LucideIcons from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const iconNames = Object.keys(LucideIcons).filter(key => typeof (LucideIcons as any)[key] === 'object');


export function ButtonBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
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
            <Accordion type="multiple" className="w-full" defaultValue={['general', 'style']}>
                <AccordionItem value="general">
                    <AccordionTrigger>General</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="text">Label</Label>
                            <Input id="text" value={settings.text || 'Click Me'} onChange={(e) => handleUpdate('text', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="link">Link URL</Label>
                            <Input id="link" value={settings.link || '#'} onChange={(e) => handleUpdate('link', e.target.value)} />
                        </div>
                        <Separator />
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Icon (Optional)</Label>
                                <Select value={settings.icon || ''} onValueChange={(val) => handleUpdate('icon', val)}>
                                    <SelectTrigger><SelectValue placeholder="No Icon"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">No Icon</SelectItem>
                                        {iconNames.map(iconName => (
                                            <SelectItem key={iconName} value={iconName}>{iconName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Icon Position</Label>
                                <Select value={settings.iconPosition || 'left'} onValueChange={(val) => handleUpdate('iconPosition', val)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="left">Left</SelectItem>
                                        <SelectItem value="right">Right</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="style">
                    <AccordionTrigger>Style &amp; Sizing</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Shape</Label>
                            <Select value={settings.shape || 'rounded'} onValueChange={(val) => handleUpdate('shape', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="square">Square</SelectItem>
                                    <SelectItem value="rounded">Rounded</SelectItem>
                                    <SelectItem value="pill">Pill</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Background Color</Label>
                                <Input type="color" value={settings.backgroundColor || '#000000'} onChange={(e) => handleUpdate('backgroundColor', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Text Color</Label>
                                <Input type="color" value={settings.textColor || '#FFFFFF'} onChange={(e) => handleUpdate('textColor', e.target.value)} />
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Padding (X, Y) in px</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Input type="number" placeholder="Horizontal (X)" value={settings.padding?.x || ''} onChange={(e) => handleSubFieldUpdate('padding', 'x', e.target.value)} />
                                <Input type="number" placeholder="Vertical (Y)" value={settings.padding?.y || ''} onChange={(e) => handleSubFieldUpdate('padding', 'y', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Border</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <Input type="number" placeholder="Width" value={settings.border?.width || '1'} onChange={(e) => handleSubFieldUpdate('border', 'width', e.target.value)} />
                                <Input type="color" value={settings.border?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} />
                                <Input type="number" placeholder="Radius" value={settings.border?.radius || '0'} onChange={(e) => handleSubFieldUpdate('border', 'radius', e.target.value)} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="typography">
                    <AccordionTrigger>Typography</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Font Family</Label>
                            <Select value={settings.fontFamily || 'inherit'} onValueChange={(val) => handleUpdate('fontFamily', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="inherit">Theme Default</SelectItem>
                                    <SelectItem value="'Inter', sans-serif">Inter</SelectItem>
                                    <SelectItem value="'Roboto', sans-serif">Roboto</SelectItem>
                                    <SelectItem value="'Lato', sans-serif">Lato</SelectItem>
                                    <SelectItem value="'Merriweather', serif">Merriweather</SelectItem>
                                    <SelectItem value="'Playfair Display', serif">Playfair Display</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-2"><Label>Size (px)</Label><Input type="number" value={settings.fontSize || ''} onChange={(e) => handleUpdate('fontSize', e.target.value)} placeholder="e.g. 14" /></div>
                            <div className="space-y-2"><Label>Weight</Label><Select value={settings.fontWeight || 'normal'} onValueChange={(val) => handleUpdate('fontWeight', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="bold">Bold</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Style</Label><Select value={settings.fontStyle || 'normal'} onValueChange={(val) => handleUpdate('fontStyle', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="italic">Italic</SelectItem></SelectContent></Select></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="effects">
                    <AccordionTrigger>Effects &amp; Animation</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Hover Effect</Label>
                            <Select value={settings.hoverEffect || 'scale'} onValueChange={(val) => handleUpdate('hoverEffect', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="scale">Scale</SelectItem>
                                    <SelectItem value="colorSwap">Color Swap</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {settings.hoverEffect === 'colorSwap' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Hover BG</Label>
                                    <Input type="color" value={settings.hoverBackgroundColor || '#333333'} onChange={(e) => handleUpdate('hoverBackgroundColor', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Hover Text</Label>
                                    <Input type="color" value={settings.hoverTextColor || '#FFFFFF'} onChange={(e) => handleUpdate('hoverTextColor', e.target.value)} />
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Animation</Label>
                            <Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="fade">Fade In</SelectItem>
                                    <SelectItem value="slide">Slide In</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="layout">
                    <AccordionTrigger>Sizing &amp; Layout</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Width</Label>
                                <Input value={settings.layout?.width || ''} placeholder="auto" onChange={e => handleSubFieldUpdate('layout', 'width', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Height</Label>
                                <Input value={settings.layout?.height || ''} placeholder="auto" onChange={e => handleSubFieldUpdate('layout', 'height', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Max Width</Label>
                                <Input value={settings.layout?.maxWidth || ''} placeholder="none" onChange={e => handleSubFieldUpdate('layout', 'maxWidth', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Min Height</Label>
                                <Input value={settings.layout?.minHeight || ''} placeholder="auto" onChange={e => handleSubFieldUpdate('layout', 'minHeight', e.target.value)} />
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
