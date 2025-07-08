
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import * as LucideIcons from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Separator } from '@/components/ui/separator';

const iconNames = Object.keys(LucideIcons).filter(key => 
    typeof (LucideIcons as any)[key] === 'object' && 
    key !== 'createLucideIcon' && 
    key !== 'icons' &&
    /^[A-Z]/.test(key)
);

const hoverAnimationOptions = [
    { value: 'none', label: 'None' }, { value: 'grow', label: 'Grow' }, { value: 'shrink', label: 'Shrink' },
    { value: 'pulse', label: 'Pulse' }, { value: 'bob', label: 'Bob' }, { value: 'wobbleHorizontal', label: 'Wobble Horizontal' },
    { value: 'rotate', label: 'Rotate' }
];

export function IconBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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

            {/* Content Tab */}
            <TabsContent value="content" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['content_icon', 'content_link']}>
                    <AccordionItem value="content_icon">
                        <AccordionTrigger>Icon</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Icon</Label><Select value={settings.icon || 'Star'} onValueChange={(val) => handleUpdate('icon', val)}><SelectTrigger searchable><SelectValue/></SelectTrigger><SelectContent>{iconNames.map(iconName => (<SelectItem key={iconName} value={iconName}>{iconName}</SelectItem>))}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>View</Label><Select value={settings.view || 'none'} onValueChange={(val) => handleUpdate('view', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Default</SelectItem><SelectItem value="stacked">Stacked</SelectItem><SelectItem value="framed">Framed</SelectItem></SelectContent></Select></div>
                            {settings.view !== 'none' && <div className="space-y-2"><Label>Shape</Label><Select value={settings.shape || 'circle'} onValueChange={(val) => handleUpdate('shape', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="circle">Circle</SelectItem><SelectItem value="square">Square</SelectItem></SelectContent></Select></div>}
                             <div className="space-y-2"><Label>HTML Tag</Label><Select value={settings.htmlTag || 'div'} onValueChange={(val) => handleUpdate('htmlTag', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="div">div</SelectItem><SelectItem value="span">span</SelectItem><SelectItem value="i">i</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="content_link">
                        <AccordionTrigger>Link</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>URL</Label><Input type="url" placeholder="https://..." value={settings.link || ''} onChange={(e) => handleUpdate('link', e.target.value)} /></div>
                            <div className="flex items-center space-x-2"><Switch id="linkNewWindow" checked={settings.linkNewWindow} onCheckedChange={(val) => handleUpdate('linkNewWindow', val)} /><Label htmlFor="linkNewWindow">Open in new window</Label></div>
                             <div className="flex items-center space-x-2"><Switch id="linkNofollow" checked={settings.linkNofollow} onCheckedChange={(val) => handleUpdate('linkNofollow', val)} /><Label htmlFor="linkNofollow">Add "nofollow" attribute</Label></div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_icon', 'style_view']}>
                    <AccordionItem value="style_icon">
                        <AccordionTrigger>Icon Style</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <Tabs defaultValue="normal">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="normal">Normal</TabsTrigger>
                                    <TabsTrigger value="hover">Hover</TabsTrigger>
                                </TabsList>
                                <TabsContent value="normal" className="pt-4 space-y-4">
                                     <div className="space-y-2"><Label>Primary Color</Label><Input type="color" value={settings.color || '#000000'} onChange={(e) => handleUpdate('color', e.target.value)} /></div>
                                </TabsContent>
                                <TabsContent value="hover" className="pt-4 space-y-4">
                                    <div className="space-y-2"><Label>Hover Primary Color</Label><Input type="color" value={settings.hoverColor || settings.color || '#000000'} onChange={(e) => handleUpdate('hoverColor', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Hover Animation</Label><Select value={settings.hoverAnimation || 'none'} onValueChange={v => handleUpdate('hoverAnimation', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{hoverAnimationOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Transition Duration (s)</Label><Input type="number" step="0.1" value={settings.transitionDuration || '0.3'} onChange={e => handleUpdate('transitionDuration', e.target.value)} /></div>
                                </TabsContent>
                            </Tabs>
                             <div className="space-y-2"><Label>Size</Label><Slider value={[settings.size || 48]} onValueChange={v => handleUpdate('size', v[0])} min={8} max={200} step={1} /></div>
                             <div className="space-y-2"><Label>Rotate (deg)</Label><Slider value={[settings.rotate || 0]} onValueChange={v => handleUpdate('rotate', v[0])} min={0} max={360} step={1} /></div>
                            <div className="flex items-center gap-4 pt-2"><Switch id="flipHorizontal" checked={settings.flipHorizontal} onCheckedChange={(val) => handleUpdate('flipHorizontal', val)} /><Label htmlFor="flipHorizontal">Flip Horizontal</Label><Switch id="flipVertical" checked={settings.flipVertical} onCheckedChange={(val) => handleUpdate('flipVertical', val)} /><Label htmlFor="flipVertical">Flip Vertical</Label></div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="style_view" disabled={settings.view === 'none'}>
                        <AccordionTrigger>View (Frame/Stack)</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <Tabs defaultValue="normal">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="normal">Normal</TabsTrigger>
                                    <TabsTrigger value="hover">Hover</TabsTrigger>
                                </TabsList>
                                <TabsContent value="normal" className="pt-4 space-y-4">
                                    <div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.viewBackgroundColor || '#FFFFFF'} onChange={e => handleUpdate('viewBackgroundColor', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Border Color</Label><Input type="color" value={settings.viewBorderColor || '#000000'} onChange={e => handleUpdate('viewBorderColor', e.target.value)} /></div>
                                </TabsContent>
                                <TabsContent value="hover" className="pt-4 space-y-4">
                                    <div className="space-y-2"><Label>Hover Background</Label><Input type="color" value={settings.viewHoverBackgroundColor || settings.viewBackgroundColor} onChange={e => handleUpdate('viewHoverBackgroundColor', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Hover Border</Label><Input type="color" value={settings.viewHoverBorderColor || settings.viewBorderColor} onChange={e => handleUpdate('viewHoverBorderColor', e.target.value)} /></div>
                                </TabsContent>
                            </Tabs>
                            <Separator/>
                            <div className="space-y-2"><Label>Border Type</Label><Select value={settings.border?.type || 'solid'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem><SelectItem value="dotted">Dotted</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Border Width (T R B L)</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.border?.width?.top ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), top: e.target.value })} /><Input type="number" placeholder="R" value={settings.border?.width?.right ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), right: e.target.value })} /><Input type="number" placeholder="B" value={settings.border?.width?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), bottom: e.target.value })} /><Input type="number" placeholder="L" value={settings.border?.width?.left ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), left: e.target.value })} /></div></div>
                            <div className="space-y-2"><Label>Border Radius (TL TR BR BL)</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="TL" value={settings.border?.radius?.tl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tl: e.target.value })} /><Input type="number" placeholder="TR" value={settings.border?.radius?.tr ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tr: e.target.value })} /><Input type="number" placeholder="BR" value={settings.border?.radius?.br ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), br: e.target.value })} /><Input type="number" placeholder="BL" value={settings.border?.radius?.bl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), bl: e.target.value })} /></div></div>
                            <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" value={settings.viewPadding || 16} onChange={e => handleUpdate('viewPadding', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow || 'none'} onValueChange={v => handleUpdate('boxShadow', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_filters">
                        <AccordionTrigger>CSS Filters</AccordionTrigger>
                        <AccordionContent className="pt-2">
                             <Tabs defaultValue="normal">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="normal">Normal</TabsTrigger>
                                    <TabsTrigger value="hover">Hover</TabsTrigger>
                                </TabsList>
                                <TabsContent value="normal" className="pt-4 space-y-4">
                                     <div className="space-y-2"><Label>Blur (px)</Label><Slider value={[settings.filter?.blur || 0]} onValueChange={v => handleSubFieldUpdate('filter', 'blur', v[0])} min={0} max={10} step={1} /></div>
                                     <div className="space-y-2"><Label>Brightness (%)</Label><Slider value={[settings.filter?.brightness || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'brightness', v[0])} min={0} max={200} step={5} /></div>
                                     <div className="space-y-2"><Label>Contrast (%)</Label><Slider value={[settings.filter?.contrast || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'contrast', v[0])} min={0} max={200} step={5} /></div>
                                     <div className="space-y-2"><Label>Saturation (%)</Label><Slider value={[settings.filter?.saturate || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'saturate', v[0])} min={0} max={200} step={5} /></div>
                                     <div className="space-y-2"><Label>Hue (deg)</Label><Slider value={[settings.filter?.hue || 0]} onValueChange={v => handleSubFieldUpdate('filter', 'hue', v[0])} min={0} max={360} step={5} /></div>
                                </TabsContent>
                                <TabsContent value="hover" className="pt-4 space-y-4">
                                     <div className="space-y-2"><Label>Blur (px)</Label><Slider value={[settings.hoverFilter?.blur || 0]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'blur', v[0])} min={0} max={10} step={1} /></div>
                                     <div className="space-y-2"><Label>Brightness (%)</Label><Slider value={[settings.hoverFilter?.brightness || 100]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'brightness', v[0])} min={0} max={200} step={5} /></div>
                                     <div className="space-y-2"><Label>Contrast (%)</Label><Slider value={[settings.hoverFilter?.contrast || 100]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'contrast', v[0])} min={0} max={200} step={5} /></div>
                                     <div className="space-y-2"><Label>Saturation (%)</Label><Slider value={[settings.hoverFilter?.saturate || 100]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'saturate', v[0])} min={0} max={200} step={5} /></div>
                                     <div className="space-y-2"><Label>Hue (deg)</Label><Slider value={[settings.hoverFilter?.hue || 0]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'hue', v[0])} min={0} max={360} step={5} /></div>
                                </TabsContent>
                             </Tabs>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>

            {/* Advanced Tab */}
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
                            <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fadeIn">Fade In</SelectItem><SelectItem value="fadeInUp">Fade In Up</SelectItem><SelectItem value="zoomIn">Zoom In</SelectItem><SelectItem value="bounce">Bounce</SelectItem></SelectContent></Select></div>
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
                            <Label>Responsive Alignment</Label>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label className="text-xs">Tablet</Label><Select value={settings.tabletAlign || 'default'} onValueChange={v => handleUpdate('tabletAlign', v === 'default' ? undefined : v)}><SelectTrigger><SelectValue placeholder="Inherit"/></SelectTrigger><SelectContent><SelectItem value="default">Inherit</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label className="text-xs">Mobile</Label><Select value={settings.mobileAlign || 'default'} onValueChange={v => handleUpdate('mobileAlign', v === 'default' ? undefined : v)}><SelectTrigger><SelectValue placeholder="Inherit"/></SelectTrigger><SelectContent><SelectItem value="default">Inherit</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></div>
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
