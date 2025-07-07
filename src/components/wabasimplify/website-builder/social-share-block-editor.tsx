
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';

const availablePlatforms = [
    { id: 'facebook', name: 'Facebook' },
    { id: 'twitter', name: 'X (Twitter)' },
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'whatsapp', name: 'WhatsApp' },
    { id: 'telegram', name: 'Telegram' },
    { id: 'pinterest', name: 'Pinterest' },
    { id: 'reddit', name: 'Reddit' },
];

export function SocialShareBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handlePlatformToggle = (platformId: string, checked: boolean) => {
        const currentPlatforms = settings.platforms || [];
        const newPlatforms = checked
            ? [...currentPlatforms, platformId]
            : currentPlatforms.filter((p: string) => p !== platformId);
        handleUpdate('platforms', newPlatforms);
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
            <Accordion type="multiple" className="w-full" defaultValue={['platforms', 'style']}>
                <AccordionItem value="platforms">
                    <AccordionTrigger>Platforms</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Share URL (Optional)</Label>
                            <Input
                                value={settings.shareUrl || ''}
                                onChange={(e) => handleUpdate('shareUrl', e.target.value)}
                                placeholder="Defaults to current page"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {availablePlatforms.map(platform => (
                                <div key={platform.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`platform-${platform.id}`}
                                        checked={(settings.platforms || []).includes(platform.id)}
                                        onCheckedChange={(checked) => handlePlatformToggle(platform.id, !!checked)}
                                    />
                                    <Label htmlFor={`platform-${platform.id}`} className="font-normal">{platform.name}</Label>
                                </div>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="style">
                    <AccordionTrigger>Style &amp; Appearance</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Style</Label>
                            <Select value={settings.style || 'iconOnly'} onValueChange={(val) => handleUpdate('style', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="iconOnly">Icons Only</SelectItem>
                                    <SelectItem value="withLabel">Icons with Labels</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Shape</Label>
                             <Select value={settings.shape || 'rounded'} onValueChange={(val) => handleUpdate('shape', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="square">Square</SelectItem>
                                    <SelectItem value="rounded">Rounded</SelectItem>
                                    <SelectItem value="circle">Circle</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Size</Label>
                                <Select value={settings.size || 'medium'} onValueChange={(val) => handleUpdate('size', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="small">Small</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="large">Large</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Icon Color</Label>
                                <Input type="color" value={settings.iconColor || '#333333'} onChange={(e) => handleUpdate('iconColor', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Alignment</Label>
                            <Select value={settings.alignment || 'center'} onValueChange={(val) => handleUpdate('alignment', val)}>
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
