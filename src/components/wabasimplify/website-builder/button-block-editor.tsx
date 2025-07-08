
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import * as LucideIcons from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from '../ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Textarea } from '../ui/textarea';

const iconNames = Object.keys(LucideIcons).filter(key => typeof (LucideIcons as any)[key] === 'object' && /^[A-Z]/.test(key));

const hoverAnimationOptions = [
    { value: 'none', label: 'None' }, { value: 'grow', label: 'Grow' }, { value: 'shrink', label: 'Shrink' },
    { value: 'pulse', label: 'Pulse' }, { value: 'bob', label: 'Bob' }, { value: 'wobbleHorizontal', label: 'Wobble Horizontal' },
];

export function ButtonBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
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
        newAttributes[index] = {...newAttributes[index], key: field === 'key' ? value : newAttributes[index].key, value: field === 'value' ? value : newAttributes[index].value};
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
                 <Accordion type="multiple" className="w-full" defaultValue={['content_general']}>
                    <AccordionItem value="content_general">
                        <AccordionTrigger>Button</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label htmlFor="text">Text</Label><Input id="text" value={settings.text || 'Click Me'} onChange={(e) => handleUpdate('text', e.target.value)} /></div>
                             <div className="space-y-2"><Label htmlFor="link">Link</Label><Input id="link" value={settings.link || '#'} onChange={(e) => handleUpdate('link', e.target.value)} /></div>
                             <div className="flex items-center space-x-2"><Switch id="linkNewWindow" checked={settings.linkNewWindow} onCheckedChange={(val) => handleUpdate('linkNewWindow', val)} /><Label htmlFor="linkNewWindow">Open in new window</Label></div>
                             <div className="flex items-center space-x-2"><Switch id="linkNofollow" checked={settings.linkNofollow} onCheckedChange={(val) => handleUpdate('linkNofollow', val)} /><Label htmlFor="linkNofollow">Add nofollow</Label></div>
                             <div className="space-y-2"><Label>Alignment</Label><Select value={settings.align || 'left'} onValueChange={(val) => handleUpdate('align', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem><SelectItem value="justify">Justify (full width)</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Size</Label><Select value={settings.size || 'default'} onValueChange={(val) => handleUpdate('size', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sm">Small</SelectItem><SelectItem value="default">Medium</SelectItem><SelectItem value="lg">Large</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>HTML Tag</Label><Select value={settings.htmlTag || 'a'} onValueChange={(val) => handleUpdate('htmlTag', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">a (link)</SelectItem><SelectItem value="button">button</SelectItem><SelectItem value="div">div</SelectItem><SelectItem value="span">span</SelectItem><SelectItem value="p">p</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="content_icon">
                        <AccordionTrigger>Icon</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Icon</Label><Select value={settings.icon || ''} onValueChange={(val) => handleUpdate('icon', val)}><SelectTrigger><SelectValue placeholder="No Icon"/></SelectTrigger><SelectContent><SelectItem value="">No Icon</SelectItem>{iconNames.map(iconName => (<SelectItem key={iconName} value={iconName}>{iconName}</SelectItem>))}</SelectContent></Select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Position</Label><Select value={settings.iconPosition || 'left'} onValueChange={(val) => handleUpdate('iconPosition', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="left">Before</SelectItem><SelectItem value="right">After</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>Spacing (px)</Label><Input type="number" value={settings.iconSpacing || '8'} onChange={(e) => handleUpdate('iconSpacing', e.target.value)} /></div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>

             <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_button']}>
                    <AccordionItem value="style_button">
                        <AccordionTrigger>Button</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Typography</Label><Select value={settings.typography?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('typography', 'fontFamily', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Default</SelectItem><SelectItem value="'Inter', sans-serif">Inter</SelectItem><SelectItem value="'Roboto', sans-serif">Roboto</SelectItem></SelectContent></Select></div>
                            <Tabs defaultValue="normal">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="normal">Normal</TabsTrigger>
                                    <TabsTrigger value="hover">Hover</TabsTrigger>
                                </TabsList>
                                <TabsContent value="normal" className="pt-4 space-y-4">
                                    <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.color || '#FFFFFF'} onChange={e => handleUpdate('color', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.backgroundColor || '#000000'} onChange={e => handleUpdate('backgroundColor', e.target.value)} /></div>
                                </TabsContent>
                                <TabsContent value="hover" className="pt-4 space-y-4">
                                    <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.hover?.color || settings.color || '#FFFFFF'} onChange={e => handleSubFieldUpdate('hover', 'color', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.hover?.backgroundColor || settings.backgroundColor || '#333333'} onChange={e => handleSubFieldUpdate('hover', 'backgroundColor', e.target.value)} /></div>
                                </TabsContent>
                            </Tabs>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="style_icon">
                        <AccordionTrigger>Icon</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Icon Size (px)</Label><Input type="number" value={settings.iconStyle?.size || '16'} onChange={e => handleSubFieldUpdate('iconStyle', 'size', e.target.value, true)} /></div>
                             <Tabs defaultValue="normal">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="normal">Normal</TabsTrigger>
                                    <TabsTrigger value="hover">Hover</TabsTrigger>
                                </TabsList>
                                <TabsContent value="normal" className="pt-4 space-y-4">
                                     <div className="space-y-2"><Label>Icon Color</Label><Input type="color" value={settings.iconStyle?.color || settings.color || '#FFFFFF'} onChange={e => handleSubFieldUpdate('iconStyle', 'color', e.target.value)} /></div>
                                </TabsContent>
                                <TabsContent value="hover" className="pt-4 space-y-4">
                                     <div className="space-y-2"><Label>Icon Hover Color</Label><Input type="color" value={settings.hover?.iconColor || settings.iconStyle?.color || settings.hover?.color || settings.color || '#FFFFFF'} onChange={e => handleSubFieldUpdate('hover', 'iconColor', e.target.value)} /></div>
                                </TabsContent>
                             </Tabs>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_border">
                        <AccordionTrigger>Border &amp; Shadow</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Border Type</Label><Select value={settings.border?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem><SelectItem value="dotted">Dotted</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Border Width (T R B L)</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.border?.width?.top ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), top: e.target.value })} /><Input type="number" placeholder="R" value={settings.border?.width?.right ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), right: e.target.value })} /><Input type="number" placeholder="B" value={settings.border?.width?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), bottom: e.target.value })} /><Input type="number" placeholder="L" value={settings.border?.width?.left ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), left: e.target.value })} /></div></div>
                            <div className="space-y-2"><Label>Border Radius (TL TR BR BL)</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="TL" value={settings.border?.radius?.tl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tl: e.target.value })} /><Input type="number" placeholder="TR" value={settings.border?.radius?.tr ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tr: e.target.value })} /><Input type="number" placeholder="BR" value={settings.border?.radius?.br ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), br: e.target.value })} /><Input type="number" placeholder="BL" value={settings.border?.radius?.bl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), bl: e.target.value })} /></div></div>
                            <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow?.type || 'none'} onValueChange={v => handleSubFieldUpdate('boxShadow', 'type', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="outline">Outline</SelectItem><SelectItem value="inset">Inset</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>
            
            <TabsContent value="advanced" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['advanced_spacing']}>
                    <AccordionItem value="advanced_spacing">
                        <AccordionTrigger>Spacing</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Margin (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="Top" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><Input type="number" placeholder="Right" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} /><Input type="number" placeholder="Bottom" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /><Input type="number" placeholder="Left" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} /></div></div>
                             <div className="space-y-2"><Label>Padding (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="Top" value={settings.padding?.top ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><Input type="number" placeholder="Right" value={settings.padding?.right ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><Input type="number" placeholder="Bottom" value={settings.padding?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><Input type="number" placeholder="Left" value={settings.padding?.left ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="advanced_effects">
                        <AccordionTrigger>Motion Effects</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Hover Animation</Label><Select value={settings.hover?.animation || 'none'} onValueChange={(val) => handleSubFieldUpdate('hover', 'animation', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{hoverAnimationOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fade">Fade In</SelectItem><SelectItem value="slide-up">Slide In Up</SelectItem></SelectContent></Select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Animation Duration</Label><Select value={settings.animationDuration || 'normal'} onValueChange={v => handleUpdate('animationDuration', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="slow">Slow</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="fast">Fast</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>Animation Delay (ms)</Label><Input type="number" value={settings.animationDelay || ''} onChange={e => handleUpdate('animationDelay', e.target.value)} /></div>
                            </div>
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
                            <Separator />
                            <Label>Alignment</Label>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label className="text-xs">Tablet</Label><Select value={settings.tabletAlign || ''} onValueChange={v => handleUpdate('tabletAlign', v)}><SelectTrigger><SelectValue placeholder="Inherit"/></SelectTrigger><SelectContent><SelectItem value="">Inherit</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem><SelectItem value="justify">Justify</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label className="text-xs">Mobile</Label><Select value={settings.mobileAlign || ''} onValueChange={v => handleUpdate('mobileAlign', v)}><SelectTrigger><SelectValue placeholder="Inherit"/></SelectTrigger><SelectContent><SelectItem value="">Inherit</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem><SelectItem value="justify">Justify</SelectItem></SelectContent></Select></div>
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
