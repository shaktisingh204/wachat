
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const handleFileChange = (file: File | null, callback: (dataUri: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        callback(reader.result as string);
    };
    reader.readAsDataURL(file);
};


export function SectionBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
        <Tabs defaultValue="layout" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            <TabsContent value="layout" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['layout_structure']}>
                    <AccordionItem value="layout_structure">
                        <AccordionTrigger>Layout</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <Label>Content Width</Label>
                                <Select value={settings.width || 'boxed'} onValueChange={(val) => handleUpdate('width', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="boxed">Boxed</SelectItem>
                                        <SelectItem value="full">Full Width</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {settings.width === 'boxed' && (
                                <div className="space-y-2">
                                    <Label>Boxed Width (px)</Label>
                                    <Input type="number" value={settings.boxedWidth || '1280'} onChange={e => handleUpdate('boxedWidth', Number(e.target.value))} />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Height</Label>
                                <Select value={settings.heightMode || 'default'} onValueChange={(val) => handleUpdate('heightMode', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default</SelectItem>
                                        <SelectItem value="fitToScreen">Fit to Screen</SelectItem>
                                        <SelectItem value="minHeight">Min Height</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {settings.heightMode === 'minHeight' && (
                                <div className="space-y-2">
                                    <Label>Minimum Height (vh)</Label>
                                    <Input type="number" value={settings.minHeight || '50'} onChange={e => handleUpdate('minHeight', Number(e.target.value))} />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Vertical Align</Label>
                                <Select value={settings.verticalAlign || 'top'} onValueChange={(val) => handleUpdate('verticalAlign', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="top">Top</SelectItem>
                                        <SelectItem value="middle">Middle</SelectItem>
                                        <SelectItem value="bottom">Bottom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Overflow</Label>
                                <Select value={settings.overflow || 'default'} onValueChange={(val) => handleUpdate('overflow', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default</SelectItem>
                                        <SelectItem value="hidden">Hidden</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>HTML Tag</Label>
                                <Select value={settings.htmlTag || 'section'} onValueChange={(val) => handleUpdate('htmlTag', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="section">section</SelectItem>
                                        <SelectItem value="div">div</SelectItem>
                                        <SelectItem value="article">article</SelectItem>
                                        <SelectItem value="header">header</SelectItem>
                                        <SelectItem value="footer">footer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>
            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_background']}>
                     <AccordionItem value="style_background">
                        <AccordionTrigger>Background</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <Label>Background Type</Label>
                                 <Select value={settings.backgroundType || 'none'} onValueChange={(val) => handleUpdate('backgroundType', val)}>
                                     <SelectTrigger><SelectValue /></SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="none">None</SelectItem>
                                         <SelectItem value="classic">Classic (Color/Image)</SelectItem>
                                         <SelectItem value="gradient">Gradient</SelectItem>
                                         <SelectItem value="video">Video</SelectItem>
                                     </SelectContent>
                                 </Select>
                            </div>
                            {settings.backgroundType === 'classic' && (
                                <div className="p-3 border rounded-md space-y-4">
                                    <div className="space-y-2"><Label>Color</Label><Input type="color" value={settings.backgroundColor || '#FFFFFF'} onChange={e => handleUpdate('backgroundColor', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Image</Label><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleUpdate('backgroundImageUrl', dataUri))} /></div>
                                    <div className="space-y-2"><Label>Position</Label><Select value={settings.backgroundPosition || 'center center'} onValueChange={v => handleUpdate('backgroundPosition', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="center center">Center Center</SelectItem><SelectItem value="top center">Top Center</SelectItem><SelectItem value="bottom center">Bottom Center</SelectItem></SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Attachment</Label><Select value={settings.backgroundAttachment || 'scroll'} onValueChange={v => handleUpdate('backgroundAttachment', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="scroll">Scroll</SelectItem><SelectItem value="fixed">Fixed</SelectItem></SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Repeat</Label><Select value={settings.backgroundRepeat || 'no-repeat'} onValueChange={v => handleUpdate('backgroundRepeat', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="no-repeat">No-repeat</SelectItem><SelectItem value="repeat">Repeat</SelectItem></SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Size</Label><Select value={settings.backgroundSize || 'cover'} onValueChange={v => handleUpdate('backgroundSize', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cover">Cover</SelectItem><SelectItem value="contain">Contain</SelectItem><SelectItem value="auto">Auto</SelectItem></SelectContent></Select></div>
                                </div>
                            )}
                             {settings.backgroundType === 'gradient' && (
                                <div className="p-3 border rounded-md space-y-4">
                                    <div className="space-y-2"><Label>Color 1</Label><Input type="color" value={settings.gradient?.color1 || '#FFFFFF'} onChange={e => handleSubFieldUpdate('gradient', 'color1', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Color 2</Label><Input type="color" value={settings.gradient?.color2 || '#F0F0F0'} onChange={e => handleSubFieldUpdate('gradient', 'color2', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Type</Label><Select value={settings.gradient?.type || 'linear'} onValueChange={v => handleSubFieldUpdate('gradient', 'type', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="linear">Linear</SelectItem><SelectItem value="radial">Radial</SelectItem></SelectContent></Select></div>
                                    <div className="space-y-2"><Label>Angle (deg)</Label><Input type="number" value={settings.gradient?.angle || 180} onChange={e => handleSubFieldUpdate('gradient', 'angle', e.target.value)} /></div>
                                </div>
                             )}
                            {settings.backgroundType === 'video' && (
                                <div className="p-3 border rounded-md space-y-4">
                                    <div className="space-y-2"><Label>Video URL</Label><Input placeholder="https://example.com/video.mp4" value={settings.backgroundVideoUrl || ''} onChange={e => handleUpdate('backgroundVideoUrl', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>Start Time (s)</Label><Input type="number" value={settings.backgroundVideoStartTime || 0} onChange={e => handleUpdate('backgroundVideoStartTime', e.target.value)} /></div>
                                    <div className="space-y-2"><Label>End Time (s)</Label><Input type="number" value={settings.backgroundVideoEndTime || ''} onChange={e => handleUpdate('backgroundVideoEndTime', e.target.value)} placeholder="End of video" /></div>
                                    <div className="space-y-2"><Label>Fallback Image</Label><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleUpdate('backgroundVideoFallbackImageUrl', dataUri))} /></div>
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_overlay">
                        <AccordionTrigger>Background Overlay</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Overlay Type</Label><Select value={settings.backgroundOverlay?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('backgroundOverlay', 'type', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="classic">Color</SelectItem><SelectItem value="gradient">Gradient</SelectItem></SelectContent></Select></div>
                             {settings.backgroundOverlay?.type === 'classic' && (
                                 <div className="space-y-2"><Label>Color</Label><Input type="color" value={settings.backgroundOverlay?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('backgroundOverlay', 'color', e.target.value)} /></div>
                             )}
                            <div className="space-y-2">
                                <Label>Opacity</Label>
                                <Slider value={[settings.backgroundOverlay?.opacity || 0.5]} onValueChange={v => handleSubFieldUpdate('backgroundOverlay', 'opacity', v[0])} min={0} max={1} step={0.05} />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_border">
                        <AccordionTrigger>Border</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Border Type</Label><Select value={settings.border?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem><SelectItem value="dotted">Dotted</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Width (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.border?.width?.top ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), top: e.target.value })} /><Input type="number" placeholder="R" value={settings.border?.width?.right ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), right: e.target.value })} /><Input type="number" placeholder="B" value={settings.border?.width?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), bottom: e.target.value })} /><Input type="number" placeholder="L" value={settings.border?.width?.left ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), left: e.target.value })} /></div></div>
                             <div className="space-y-2"><Label>Color</Label><Input type="color" value={settings.border?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Border Radius</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="TL" value={settings.border?.radius?.tl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tl: e.target.value })} /><Input type="number" placeholder="TR" value={settings.border?.radius?.tr ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tr: e.target.value })} /><Input type="number" placeholder="BR" value={settings.border?.radius?.br ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), br: e.target.value })} /><Input type="number" placeholder="BL" value={settings.border?.radius?.bl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), bl: e.target.value })} /></div></div>
                             <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow || 'none'} onValueChange={(val) => handleUpdate('boxShadow', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem><SelectItem value="xl">Extra Large</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="style_shape_divider" disabled>
                        <AccordionTrigger>Shape Divider</AccordionTrigger>
                        <AccordionContent className="pt-2">
                             <Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Coming Soon!</AlertTitle><AlertDescription>Shape dividers are planned for a future update.</AlertDescription></Alert>
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
                             <div className="space-y-2"><Label>Padding (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="Top" value={settings.padding?.top ?? '64'} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><Input type="number" placeholder="Right" value={settings.padding?.right ?? '16'} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><Input type="number" placeholder="Bottom" value={settings.padding?.bottom ?? '64'} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><Input type="number" placeholder="Left" value={settings.padding?.left ?? '16'} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="advanced_motion" disabled>
                        <AccordionTrigger>Motion Effects</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Coming Soon!</AlertTitle><AlertDescription>Scrolling effects and advanced animations are planned for a future update.</AlertDescription></Alert>
                            <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fadeIn">Fade In</SelectItem><SelectItem value="fadeInUp">Fade In Up</SelectItem><SelectItem value="fadeInDown">Fade In Down</SelectItem><SelectItem value="fadeInLeft">Fade In Left</SelectItem><SelectItem value="fadeInRight">Fade In Right</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Sticky</Label><Select value={settings.sticky || 'none'} onValueChange={(val) => handleUpdate('sticky', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="top">Top of screen</SelectItem></SelectContent></Select></div>
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
                                 <div key={attr.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center">
                                     <Input placeholder="Key" value={attr.key} onChange={e => handleAttributeChange(index, 'key', e.target.value)} />
                                     <Input placeholder="Value" value={attr.value} onChange={e => handleAttributeChange(index, 'value', e.target.value)} />
                                     <Button type="button" variant="ghost" size="icon" onClick={() => removeAttribute(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                 </div>
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
