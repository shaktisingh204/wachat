
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '../ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Slider } from '../ui/slider';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Lightbulb } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const availablePlatforms = [
    { id: 'facebook', name: 'Facebook' },
    { id: 'twitter', name: 'X (Twitter)' },
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'whatsapp', name: 'WhatsApp' },
    { id: 'telegram', name: 'Telegram' },
    { id: 'pinterest', name: 'Pinterest' },
    { id: 'reddit', name: 'Reddit' },
    { id: 'email', name: 'Email' },
    { id: 'print', name: 'Print' },
    { id: 'tumblr', name: 'Tumblr' },
    { id: 'vk', name: 'VK' },
    { id: 'xing', name: 'Xing' },
    { id: 'line', name: 'Line' },
    { id: 'skype', name: 'Skype' },
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
    
    const handleSubFieldUpdate = (mainField: string, subField: string, value: any, isNumber = false) => {
        const parsedValue = isNumber ? (value === '' ? undefined : Number(value)) : value;
        onUpdate({
            ...settings,
            [mainField]: {
                ...(settings[mainField] || {}),
                [subField]: parsedValue
            }
        });
    }

    const handleAttributeChange = (index: number, field: 'key' | 'value', value: string) => {
        const newAttributes = [...(settings.customAttributes || [])];
        newAttributes[index] = {...newAttributes[index], [field]: value};
        handleUpdate('customAttributes', newAttributes);
    }
    
    const addAttribute = () => {
        const newAttributes = [...(settings.customAttributes || []), {id: uuidv4(), key: '', value: ''}];
        handleUpdate('customAttributes', newAttributes);
    }

    const removeAttribute = (index: number) => {
        const newAttributes = (settings.customAttributes || []).filter((_: any, i:number) => i !== index);
        handleUpdate('customAttributes', newAttributes);
    }

    return (
        <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            <TabsContent value="content" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['content_networks']}>
                    <AccordionItem value="content_networks">
                        <AccordionTrigger>Networks</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
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
                    <AccordionItem value="content_settings">
                        <AccordionTrigger>Settings</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <Label>Share URL</Label>
                                <Select value={settings.urlType || 'currentPage'} onValueChange={v => handleUpdate('urlType', v)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="currentPage">Current Page URL</SelectItem>
                                        <SelectItem value="custom">Custom URL</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {settings.urlType === 'custom' && (
                                <div className="space-y-2">
                                    <Label>Custom URL</Label>
                                    <Input type="url" placeholder="https://..." value={settings.customUrl || ''} onChange={e => handleUpdate('customUrl', e.target.value)} />
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>
            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_buttons']}>
                    <AccordionItem value="style_buttons">
                        <AccordionTrigger>Button Style</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Style</Label><Select value={settings.style || 'iconOnly'} onValueChange={v => handleUpdate('style', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="iconOnly">Icon Only</SelectItem><SelectItem value="withLabel">Icon & Text</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Shape</Label><Select value={settings.shape || 'rounded'} onValueChange={v => handleUpdate('shape', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="square">Square</SelectItem><SelectItem value="rounded">Rounded</SelectItem><SelectItem value="circle">Circle</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Columns</Label><Select value={String(settings.columns || 0)} onValueChange={v => handleUpdate('columns', Number(v))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="0">Auto</SelectItem><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem><SelectItem value="4">4</SelectItem><SelectItem value="5">5</SelectItem><SelectItem value="6">6</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Alignment</Label><Select value={settings.alignment || 'center'} onValueChange={v => handleUpdate('alignment', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem><SelectItem value="justify">Justify</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Size</Label><Select value={settings.size || 'medium'} onValueChange={v => handleUpdate('size', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="small">Small</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="large">Large</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Icon Size (px)</Label><Input type="number" value={settings.iconSize || 16} onChange={e => handleUpdate('iconSize', Number(e.target.value))} /></div>
                             <div className="space-y-2"><Label>Gap between buttons (px)</Label><Input type="number" value={settings.gap || 8} onChange={e => handleUpdate('gap', Number(e.target.value))} /></div>
                             <div className="space-y-2"><Label>Transition Duration (s)</Label><Input type="number" step="0.1" value={settings.transitionDuration || '0.3'} onChange={e => handleUpdate('transitionDuration', e.target.value)} /></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_colors">
                        <AccordionTrigger>Colors</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <Tabs defaultValue="normal">
                                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="normal">Normal</TabsTrigger><TabsTrigger value="hover">Hover</TabsTrigger></TabsList>
                                <TabsContent value="normal" className="pt-4 space-y-4">
                                     <div className="space-y-2"><Label>Icon Color</Label><Input type="color" value={settings.color || '#333333'} onChange={e => handleUpdate('color', e.target.value)} /></div>
                                     <div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.backgroundColor || '#ffffff'} onChange={e => handleUpdate('backgroundColor', e.target.value)} /></div>
                                </TabsContent>
                                <TabsContent value="hover" className="pt-4 space-y-4">
                                    <div className="space-y-2"><Label>Hover Icon Color</Label><Input type="color" value={settings.hoverColor || settings.color} onChange={e => handleUpdate('hoverColor', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Hover Background Color</Label><Input type="color" value={settings.hoverBackgroundColor || settings.backgroundColor} onChange={e => handleUpdate('hoverBackgroundColor', e.target.value)} /></div>
                                </TabsContent>
                             </Tabs>
                        </AccordionContent>
                    </AccordionItem>
                 </Accordion>
            </TabsContent>

            <TabsContent value="advanced" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['advanced_spacing']}>
                    <AccordionItem value="advanced_spacing">
                        <AccordionTrigger>Spacing</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Margin (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><Input type="number" placeholder="R" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} /><Input type="number" placeholder="B" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /><Input type="number" placeholder="L" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} /></div></div>
                             <div className="space-y-2"><Label>Padding (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.padding?.top ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><Input type="number" placeholder="R" value={settings.padding?.right ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><Input type="number" placeholder="B" value={settings.padding?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><Input type="number" placeholder="L" value={settings.padding?.left ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="advanced_motion">
                        <AccordionTrigger>Motion Effects</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fadeIn">Fade In</SelectItem><SelectItem value="fadeInUp">Fade In Up</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="advanced_responsive">
                        <AccordionTrigger>Responsive</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <Label>Visibility</Label>
                            <div className="flex flex-col gap-2 rounded-md border p-3">
                                <div className="flex items-center justify-between"><Label htmlFor="showOnDesktop" className="font-normal">Show on Desktop</Label><Switch id="showOnDesktop" checked={settings.responsiveVisibility?.desktop !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'desktop', val)} /></div>
                                <div className="flex items-center justify-between"><Label htmlFor="showOnTablet" className="font-normal">Show on Tablet</Label><Switch id="showOnTablet" checked={settings.responsiveVisibility?.tablet !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'tablet', val)} /></div>
                                <div className="flex items-center justify-between"><Label htmlFor="showOnMobile" className="font-normal">Show on Mobile</Label><Switch id="showOnMobile" checked={settings.responsiveVisibility?.mobile !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'mobile', val)} /></div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="advanced_attributes">
                        <AccordionTrigger>Attributes</AccordionTrigger>
                         <AccordionContent className="space-y-4 pt-2">
                             {(settings.customAttributes || []).map((attr: any, index: number) => (
                                 <div key={attr.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center"><Input placeholder="Key" value={attr.key} onChange={e => handleAttributeChange(index, 'key', e.target.value)} /><Input placeholder="Value" value={attr.value} onChange={e => handleAttributeChange(index, 'value', e.target.value)} /><Button type="button" variant="ghost" size="icon" onClick={() => removeAttribute(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>
                             ))}
                             <Button type="button" variant="outline" className="w-full" onClick={addAttribute}><Plus className="mr-2 h-4 w-4"/>Add Attribute</Button>
                         </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="advanced_custom">
                        <AccordionTrigger>Custom CSS</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>CSS ID</Label><Input value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div>
                            <div className="space-y-2"><Label>CSS Classes</Label><Input value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Custom CSS</Label><Textarea value={settings.customCss || ''} onChange={e => handleUpdate('customCss', e.target.value)} className="font-mono" placeholder={`selector {\n  color: red;\n}`}/></div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
             </TabsContent>
        </Tabs>
    );
}
