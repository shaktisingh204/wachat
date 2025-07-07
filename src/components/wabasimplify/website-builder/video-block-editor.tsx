
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function VideoBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            onUpdate({ ...settings, coverImageUrl: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['source', 'playback']}>
                <AccordionItem value="source">
                    <AccordionTrigger>Source</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor={`sourceUrl-${settings.id}`}>Video URL</Label>
                            <Input id={`sourceUrl-${settings.id}`} value={settings.sourceUrl || ''} onChange={(e) => handleUpdate('sourceUrl', e.target.value)} placeholder="YouTube, Vimeo, or direct MP4 URL" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`coverImageUrl-${settings.id}`}>Cover Image (Optional)</Label>
                            <Input id={`coverImageUrl-${settings.id}`} type="file" accept="image/*" onChange={handleFileChange} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="playback">
                    <AccordionTrigger>Playback &amp; Controls</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="flex items-center space-x-2">
                            <Switch id="autoplay" checked={settings.autoPlay || false} onCheckedChange={(val) => handleUpdate('autoPlay', val)} />
                            <Label htmlFor="autoplay">Autoplay</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <Switch id="controls" checked={settings.controls !== false} onCheckedChange={(val) => handleUpdate('controls', val)} />
                            <Label htmlFor="controls">Show Controls</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="muted" checked={settings.muted !== false} onCheckedChange={(val) => handleUpdate('muted', val)} />
                            <Label htmlFor="muted">Mute by Default</Label>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="style">
                    <AccordionTrigger>Style &amp; Appearance</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Aspect Ratio</Label>
                            <Select value={settings.aspectRatio || '16:9'} onValueChange={(val) => handleUpdate('aspectRatio', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                                    <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Border &amp; Shadow</Label>
                            <div className="grid grid-cols-3 gap-2">
                                <Input type="number" placeholder="Radius (px)" value={settings.border?.radius || '8'} onChange={(e) => handleSubFieldUpdate('border', 'radius', e.target.value)} />
                                <Input type="number" placeholder="Width (px)" value={settings.border?.width || '0'} onChange={(e) => handleSubFieldUpdate('border', 'width', e.target.value)} />
                                <Input type="color" value={settings.border?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} />
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <Switch id="shadow-enabled" checked={settings.shadow || false} onCheckedChange={(val) => handleUpdate('shadow', val)} />
                                <Label htmlFor="shadow-enabled">Enable Drop Shadow</Label>
                            </div>
                        </div>
                         <div className="space-y-2">
                            <Label>Play Icon (for custom players)</Label>
                            <div className="grid grid-cols-2 gap-2">
                                 <Input type="number" placeholder="Size (px)" value={settings.playIconSize || '64'} onChange={(e) => handleUpdate('playIconSize', e.target.value)} />
                                <Input type="color" value={settings.playIconColor || '#FFFFFF'} onChange={(e) => handleUpdate('playIconColor', e.target.value)} />
                            </div>
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
                                <Input value={settings.layout?.height || '450px'} onChange={e => handleSubFieldUpdate('layout', 'height', e.target.value)} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
