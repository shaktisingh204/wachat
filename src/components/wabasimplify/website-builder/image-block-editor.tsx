
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function ImageBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
             <div className="space-y-2">
                <Label htmlFor={`src-${settings.id}`}>Image URL</Label>
                <Input id={`src-${settings.id}`} value={settings.src || ''} onChange={(e) => handleUpdate('src', e.target.value)} placeholder="https://example.com/image.png" />
            </div>
             <div className="space-y-2">
                <Label htmlFor={`alt-${settings.id}`}>Alt Text (for accessibility)</Label>
                <Input id={`alt-${settings.id}`} value={settings.alt || ''} onChange={(e) => handleUpdate('alt', e.target.value)} placeholder="Describe the image" />
            </div>
             <div className="space-y-2">
                <Label htmlFor={`caption-${settings.id}`}>Caption (Optional)</Label>
                <Input id={`caption-${settings.id}`} value={settings.caption || ''} onChange={(e) => handleUpdate('caption', e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor={`link-${settings.id}`}>Link URL (Optional)</Label>
                <Input id={`link-${settings.id}`} type="url" value={settings.link || ''} onChange={(e) => handleUpdate('link', e.target.value)} placeholder="https://example.com/product" />
            </div>

            <Accordion type="multiple" className="w-full" defaultValue={['sizing']}>
                <AccordionItem value="sizing">
                    <AccordionTrigger>Sizing & Appearance</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Size</Label>
                                <Select value={settings.size || 'medium'} onValueChange={(val) => handleUpdate('size', val)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="small">Small</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="large">Large</SelectItem>
                                        <SelectItem value="full">Full Width</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Alignment</Label>
                                <Select value={settings.align || 'center'} onValueChange={(val) => handleUpdate('align', val)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="left">Left</SelectItem>
                                        <SelectItem value="center">Center</SelectItem>
                                        <SelectItem value="right">Right</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Shape</Label>
                            <Select value={settings.shape || 'rounded'} onValueChange={(val) => handleUpdate('shape', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="square">Square</SelectItem>
                                    <SelectItem value="rounded">Rounded</SelectItem>
                                    <SelectItem value="circle">Circle</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="effects">
                    <AccordionTrigger>Effects & Border</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Hover Effect</Label>
                            <Select value={settings.hoverEffect || 'none'} onValueChange={(val) => handleUpdate('hoverEffect', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="zoom">Zoom In</SelectItem>
                                    <SelectItem value="grayscale">Grayscale</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Shadow</Label>
                            <Select value={settings.shadow || 'none'} onValueChange={(val) => handleUpdate('shadow', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="sm">Small</SelectItem>
                                    <SelectItem value="md">Medium</SelectItem>
                                    <SelectItem value="lg">Large</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Border</Label>
                             <div className="flex items-center space-x-2">
                                <Switch id="border-enabled" checked={settings.border?.enabled || false} onCheckedChange={(val) => handleSubFieldUpdate('border', 'enabled', val)} />
                                <Label htmlFor="border-enabled">Enable Border</Label>
                            </div>
                             {settings.border?.enabled && (
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <Input type="number" placeholder="Width (px)" value={settings.border?.width || '1'} onChange={(e) => handleSubFieldUpdate('border', 'width', e.target.value)} />
                                    <Input type="color" value={settings.border?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} />
                                </div>
                             )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
