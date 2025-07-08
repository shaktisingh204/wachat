
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';

type CarouselImage = {
  id: string;
  src: string;
  link?: string;
  caption?: string;
};

const handleFileChange = (file: File | null, callback: (dataUri: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        callback(reader.result as string);
    };
    reader.readAsDataURL(file);
};

const hoverAnimationOptions = [
    { value: 'none', label: 'None' },
    { value: 'zoom', label: 'Zoom' },
    { value: 'grow', label: 'Grow' },
    { value: 'shrink', label: 'Shrink' },
    { value: 'pulse', label: 'Pulse' },
    { value: 'pulseGrow', label: 'Pulse Grow' },
    { value: 'pulseShrink', label: 'Pulse Shrink' },
    { value: 'push', label: 'Push' },
    { value: 'pop', label: 'Pop' },
    { value: 'bounceIn', label: 'Bounce In' },
    { value: 'bounceOut', label: 'Bounce Out' },
    { value: 'rotate', label: 'Rotate' },
    { value: 'growRotate', label: 'Grow Rotate' },
    { value: 'float', label: 'Float' },
    { value: 'sink', label: 'Sink' },
    { value: 'bob', label: 'Bob' },
    { value: 'hang', label: 'Hang' },
    { value: 'skew', label: 'Skew' },
    { value: 'skewForward', label: 'Skew Forward' },
    { value: 'skewBackward', label: 'Skew Backward' },
    { value: 'wobbleHorizontal', label: 'Wobble Horizontal' },
    { value: 'wobbleVertical', label: 'Wobble Vertical' },
];

export function ImageCarouselBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const images = settings.images || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleImageChange = (index: number, field: keyof CarouselImage, value: string) => {
        const newImages = [...images];
        newImages[index] = { ...newImages[index], [field]: value };
        handleUpdate('images', newImages);
    };

    const addImage = () => {
        const newImages = [...images, { id: uuidv4(), src: '', link: '', caption: '' }];
        handleUpdate('images', newImages);
    };

    const removeImage = (index: number) => {
        const newImages = images.filter((_: any, i: number) => i !== index);
        handleUpdate('images', newImages);
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
                <Accordion type="multiple" className="w-full" defaultValue={['gallery', 'carousel_settings']}>
                    <AccordionItem value="gallery">
                        <AccordionTrigger>Image Gallery</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             {images.map((item: CarouselImage, index: number) => (
                                <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeImage(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                    <Label>Slide {index + 1}</Label>
                                     <div className="flex items-center gap-2">
                                        <Input type="file" accept="image/*" className="flex-1" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleImageChange(index, 'src', dataUri))} />
                                        {item.src && <Image src={item.src} alt="preview" width={40} height={40} className="rounded-md object-cover" />}
                                    </div>
                                    <Input placeholder="Link URL (Optional)" value={item.link || ''} onChange={(e) => handleImageChange(index, 'link', e.target.value)} />
                                    <Input placeholder="Caption (Optional)" value={item.caption || ''} onChange={(e) => handleImageChange(index, 'caption', e.target.value)} />
                                </div>
                            ))}
                            <Button type="button" variant="outline" onClick={addImage}><Plus className="mr-2 h-4 w-4" /> Add Image</Button>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="carousel_settings">
                        <AccordionTrigger>Carousel Settings</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Slides to Show</Label><Input type="number" min="1" max="10" value={settings.slidesToShow || 1} onChange={e => handleUpdate('slidesToShow', Number(e.target.value))} /></div>
                                <div className="space-y-2"><Label>Slides to Scroll</Label><Input type="number" min="1" max="10" value={settings.slidesToScroll || 1} onChange={e => handleUpdate('slidesToScroll', Number(e.target.value))} /></div>
                            </div>
                            <div className="space-y-2"><Label>Navigation</Label><Select value={settings.navigation || 'arrows_dots'} onValueChange={v => handleUpdate('navigation', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="arrows">Arrows</SelectItem><SelectItem value="dots">Dots</SelectItem><SelectItem value="arrows_dots">Arrows & Dots</SelectItem></SelectContent></Select></div>
                             <div className="flex items-center justify-between"><Label>Image Stretch</Label><Switch checked={settings.imageStretch} onCheckedChange={(val) => handleUpdate('imageStretch', val)} /></div>
                            <Separator/>
                            <div className="flex items-center justify-between"><Label>Autoplay</Label><Switch checked={settings.autoplay || false} onCheckedChange={(val) => handleUpdate('autoplay', val)} /></div>
                            {settings.autoplay && <div className="space-y-2"><Label>Autoplay Speed (ms)</Label><Input type="number" placeholder="3000" value={settings.autoplayDelay || 3000} onChange={e => handleUpdate('autoplayDelay', Number(e.target.value))}/></div>}
                            <div className="flex items-center justify-between"><Label>Pause on Hover</Label><Switch checked={settings.pauseOnHover || false} onCheckedChange={(val) => handleUpdate('pauseOnHover', val)} /></div>
                            <div className="flex items-center justify-between"><Label>Infinite Loop</Label><Switch checked={settings.loop || false} onCheckedChange={(val) => handleUpdate('loop', val)} /></div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>

            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_image']}>
                     <AccordionItem value="style_image">
                        <AccordionTrigger>Image</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Spacing (px)</Label><Input type="number" placeholder="16" value={settings.spacing || ''} onChange={e => handleUpdate('spacing', Number(e.target.value))} /></div>
                             <div className="space-y-2"><Label>Border Type</Label><Select value={settings.border?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem><SelectItem value="dotted">Dotted</SelectItem><SelectItem value="double">Double</SelectItem><SelectItem value="groove">Groove</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Border Width (T R B L)</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.border?.width?.top ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), top: e.target.value })} /><Input type="number" placeholder="R" value={settings.border?.width?.right ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), right: e.target.value })} /><Input type="number" placeholder="B" value={settings.border?.width?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), bottom: e.target.value })} /><Input type="number" placeholder="L" value={settings.border?.width?.left ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), left: e.target.value })} /></div></div>
                             <div className="space-y-2"><Label>Border Color</Label><Input type="color" value={settings.border?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Border Radius (TL TR BR BL)</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="TL" value={settings.border?.radius?.tl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tl: e.target.value })} /><Input type="number" placeholder="TR" value={settings.border?.radius?.tr ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tr: e.target.value })} /><Input type="number" placeholder="BR" value={settings.border?.radius?.br ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), br: e.target.value })} /><Input type="number" placeholder="BL" value={settings.border?.radius?.bl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), bl: e.target.value })} /></div></div>
                             <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow || 'none'} onValueChange={v => handleUpdate('boxShadow', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Hover Animation</Label><Select value={settings.hoverAnimation || 'none'} onValueChange={v => handleUpdate('hoverAnimation', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{hoverAnimationOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                             <div className="space-y-2"><Label>Transition Duration (s)</Label><Input type="number" step="0.1" value={settings.transitionDuration || '0.3'} onChange={e => handleUpdate('transitionDuration', e.target.value)} /></div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="style_filters">
                        <AccordionTrigger>CSS Filters</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <Tabs defaultValue="normal">
                                <TabsList><TabsTrigger value="normal">Normal</TabsTrigger><TabsTrigger value="hover">Hover</TabsTrigger></TabsList>
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
                    <AccordionItem value="style_navigation">
                        <AccordionTrigger>Navigation</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <h4 className="font-semibold text-sm">Arrows</h4>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Position</Label><Select value={settings.arrowPosition || 'inside'} onValueChange={v => handleUpdate('arrowPosition', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inside">Inside</SelectItem><SelectItem value="outside">Outside</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>Arrow Size (px)</Label><Input type="number" value={settings.arrowSize || 40} onChange={e => handleUpdate('arrowSize', Number(e.target.value))} /></div>
                                <div className="space-y-2"><Label>Arrow Color</Label><Input type="color" value={settings.arrowColor || '#ffffff'} onChange={e => handleUpdate('arrowColor', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Arrow BG</Label><Input type="color" value={settings.arrowBgColor || '#00000080'} onChange={e => handleUpdate('arrowBgColor', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Arrow Hover Color</Label><Input type="color" value={settings.arrowHoverColor || '#ffffff'} onChange={e => handleUpdate('arrowHoverColor', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Arrow Hover BG</Label><Input type="color" value={settings.arrowHoverBgColor || '#000000cc'} onChange={e => handleUpdate('arrowHoverBgColor', e.target.value)} /></div>
                                <div className="space-y-2 col-span-2"><Label>Arrow Border Radius (px)</Label><Input type="number" value={settings.arrowBorderRadius || 50} onChange={e => handleUpdate('arrowBorderRadius', Number(e.target.value))} /></div>
                             </div>
                             <h4 className="font-semibold text-sm pt-4">Dots</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Dot Position</Label><Select value={settings.dotPosition || 'outside'} onValueChange={v => handleUpdate('dotPosition', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="outside">Outside</SelectItem><SelectItem value="inside">Inside</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>Dot Size (px)</Label><Input type="number" value={settings.dotSize || 12} onChange={e => handleUpdate('dotSize', Number(e.target.value))} /></div>
                                <div className="space-y-2"><Label>Dot Spacing (px)</Label><Input type="number" value={settings.dotSpacing || 8} onChange={e => handleUpdate('dotSpacing', Number(e.target.value))} /></div>
                                <div className="space-y-2"><Label>Dot Alignment</Label><Select value={settings.dotAlignment || 'center'} onValueChange={v => handleUpdate('dotAlignment', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="flex-start">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="flex-end">Right</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>Dot Color</Label><Input type="color" value={settings.dotColor || '#ffffff80'} onChange={e => handleUpdate('dotColor', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Active Dot Color</Label><Input type="color" value={settings.activeDotColor || '#ffffff'} onChange={e => handleUpdate('activeDotColor', e.target.value)} /></div>
                            </div>
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
                            <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fadeIn">Fade In</SelectItem><SelectItem value="fadeInUp">Fade In Up</SelectItem><SelectItem value="fadeInDown">Fade In Down</SelectItem><SelectItem value="fadeInLeft">Fade In Left</SelectItem><SelectItem value="fadeInRight">Fade In Right</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Animation Duration</Label><Select value={settings.animationDuration || 'normal'} onValueChange={(val) => handleUpdate('animationDuration', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="slow">Slow</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="fast">Fast</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Animation Delay (ms)</Label><Input type="number" value={settings.animationDelay || ''} onChange={e => handleUpdate('animationDelay', e.target.value)} /></div>
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
