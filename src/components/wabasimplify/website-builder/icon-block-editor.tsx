
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import * as LucideIcons from 'lucide-react';

const iconNames = Object.keys(LucideIcons).filter(key => 
    typeof (LucideIcons as any)[key] === 'object' && 
    key !== 'createLucideIcon' && 
    key !== 'icons' && // lucide-react has an `icons` export
    /^[A-Z]/.test(key) // Ensure it's a component name
);


export function IconBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
                            <Label>Icon</Label>
                            <Select value={settings.icon || 'Star'} onValueChange={(val) => handleUpdate('icon', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    {iconNames.map(iconName => (
                                        <SelectItem key={iconName} value={iconName}>{iconName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="link">Link URL (Optional)</Label>
                            <Input id="link" value={settings.link || ''} onChange={(e) => handleUpdate('link', e.target.value)} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="style">
                    <AccordionTrigger>Style</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Size (px)</Label>
                                <Input type="number" value={settings.size || '48'} onChange={(e) => handleUpdate('size', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <Input type="color" value={settings.color || '#000000'} onChange={(e) => handleUpdate('color', e.target.value)} />
                            </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Shape</Label>
                                <Select value={settings.shape || 'none'} onValueChange={(val) => handleUpdate('shape', val)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="circle">Circle</SelectItem>
                                        <SelectItem value="square">Square</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {settings.shape !== 'none' && (
                                <div className="space-y-2">
                                    <Label>Shape Color</Label>
                                    <Input type="color" value={settings.shapeColor || '#EEEEEE'} onChange={(e) => handleUpdate('shapeColor', e.target.value)} />
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="effects">
                    <AccordionTrigger>Animation</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Animation</Label>
                            <Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="rotate">Rotate on hover</SelectItem>
                                    <SelectItem value="pulse">Pulse</SelectItem>
                                    <SelectItem value="bounce">Bounce</SelectItem>
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
