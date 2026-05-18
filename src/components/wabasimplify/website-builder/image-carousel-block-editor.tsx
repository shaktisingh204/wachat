
'use client';

import { ZoruLabel, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { Plus, Trash2, TrendingUp, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruSwitch } from '@/components/zoruui';
import { ZoruSeparator } from '@/components/zoruui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';
import { ZoruTextarea } from '@/components/zoruui';
import { SabFilePickerButton } from '@/components/sabfiles';

type CarouselImage = {
    id: string;
    src: string;
    link?: string;
    caption?: string;
};


const hoverAnimationOptions = [
    { value: 'none', label: 'None' }, { value: 'grow', label: 'Grow' }, { value: 'shrink', label: 'Shrink' },
    { value: 'pulse', label: 'Pulse' }, { value: 'bob', label: 'Bob' }, { value: 'wobbleHorizontal', label: 'Wobble Horizontal' },
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
        newAttributes[index] = { ...newAttributes[index], [field]: value };
        handleUpdate('customAttributes', newAttributes);
    }

    const addAttribute = () => {
        const newAttributes = [...(settings.customAttributes || []), { id: uuidv4(), key: '', value: '' }];
        handleUpdate('customAttributes', newAttributes);
    }

    const removeAttribute = (index: number) => {
        const newAttributes = (settings.customAttributes || []).filter((_: any, i: number) => i !== index);
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
                <ZoruAccordion type="multiple" className="w-full" defaultValue={['gallery', 'carousel_settings']}>
                    <ZoruAccordionItem value="gallery">
                        <ZoruAccordionTrigger>Image Gallery</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            {images.map((item: CarouselImage, index: number) => (
                                <div key={item.id} className="p-3 border rounded-md space-y-2 relative bg-background">
                                    <ZoruButton type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeImage(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </ZoruButton>
                                    <ZoruLabel>Slide {index + 1}</ZoruLabel>
                                    <div className="flex items-center gap-2">
                                        <SabFilePickerButton
                                            accept="image"
                                            className="flex-1"
                                            onPick={({ url }) => handleImageChange(index, 'src', url)}
                                        >
                                            <Upload className="mr-2 h-4 w-4" /> {item.src ? 'Replace image' : 'Pick image'}
                                        </SabFilePickerButton>
                                        {item.src && <Image src={item.src} alt="preview" width={40} height={40} className="rounded-sm object-cover" />}
                                    </div>
                                    <ZoruInput placeholder="Link URL (Optional)" value={item.link || ''} onChange={(e) => handleImageChange(index, 'link', e.target.value)} />
                                    <ZoruInput placeholder="Caption (Optional)" value={item.caption || ''} onChange={(e) => handleImageChange(index, 'caption', e.target.value)} />
                                </div>
                            ))}
                            <SabFilePickerButton
                                accept="image"
                                onPick={({ url }) => {
                                    const newImages = [
                                        ...images,
                                        { id: uuidv4(), src: url, link: '', caption: '' },
                                    ];
                                    handleUpdate('images', newImages);
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Add Image
                            </SabFilePickerButton>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="carousel_settings">
                        <ZoruAccordionTrigger>Carousel Settings</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><ZoruLabel>Slides to Show</ZoruLabel><ZoruInput type="number" min="1" max="10" value={settings.slidesToShow || 1} onChange={e => handleUpdate('slidesToShow', Number(e.target.value))} /></div>
                                <div className="space-y-2"><ZoruLabel>Slides to Scroll</ZoruLabel><ZoruInput type="number" min="1" max="10" value={settings.slidesToScroll || 1} onChange={e => handleUpdate('slidesToScroll', Number(e.target.value))} /></div>
                            </div>
                            <div className="space-y-2"><ZoruLabel>Navigation</ZoruLabel><ZoruSelect value={settings.navigation || 'arrows_dots'} onValueChange={v => handleUpdate('navigation', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="arrows">Arrows</ZoruSelectItem><ZoruSelectItem value="dots">Dots</ZoruSelectItem><ZoruSelectItem value="arrows_dots">Arrows & Dots</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="flex items-center justify-between"><ZoruLabel>Image Stretch</ZoruLabel><ZoruSwitch checked={settings.imageStretch} onCheckedChange={(val) => handleUpdate('imageStretch', val)} /></div>
                            <ZoruSeparator />
                            <div className="flex items-center justify-between"><ZoruLabel>Autoplay</ZoruLabel><ZoruSwitch checked={settings.autoplay || false} onCheckedChange={(val) => handleUpdate('autoplay', val)} /></div>
                            {settings.autoplay && <div className="space-y-2"><ZoruLabel>Autoplay Speed (ms)</ZoruLabel><ZoruInput type="number" placeholder="3000" value={settings.autoplayDelay || 3000} onChange={e => handleUpdate('autoplayDelay', Number(e.target.value))} /></div>}
                            <div className="flex items-center justify-between"><ZoruLabel>Pause on Hover</ZoruLabel><ZoruSwitch checked={settings.pauseOnHover || false} onCheckedChange={(val) => handleUpdate('pauseOnHover', val)} /></div>
                            <div className="flex items-center justify-between"><ZoruLabel>Infinite Loop</ZoruLabel><ZoruSwitch checked={settings.loop || false} onCheckedChange={(val) => handleUpdate('loop', val)} /></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>

            <TabsContent value="style" className="pt-4">
                <ZoruAccordion type="multiple" className="w-full" defaultValue={['style_image']}>
                    <ZoruAccordionItem value="style_image">
                        <ZoruAccordionTrigger>Image</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>Spacing (px)</ZoruLabel><ZoruInput type="number" placeholder="16" value={settings.spacing || ''} onChange={e => handleUpdate('spacing', Number(e.target.value))} /></div>
                            <div className="space-y-2"><ZoruLabel>Border Type</ZoruLabel><ZoruSelect value={settings.border?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem><ZoruSelectItem value="dotted">Dotted</ZoruSelectItem><ZoruSelectItem value="double">Double</ZoruSelectItem><ZoruSelectItem value="groove">Groove</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Border Width (T R B L)</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="T" value={settings.border?.width?.top ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), top: e.target.value })} /><ZoruInput type="number" placeholder="R" value={settings.border?.width?.right ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), right: e.target.value })} /><ZoruInput type="number" placeholder="B" value={settings.border?.width?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), bottom: e.target.value })} /><ZoruInput type="number" placeholder="L" value={settings.border?.width?.left ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), left: e.target.value })} /></div></div>
                            <div className="space-y-2"><ZoruLabel>Border Color</ZoruLabel><ZoruInput type="color" value={settings.border?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>Border Radius (TL TR BR BL)</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="TL" value={settings.border?.radius?.tl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tl: e.target.value })} /><ZoruInput type="number" placeholder="TR" value={settings.border?.radius?.tr ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tr: e.target.value })} /><ZoruInput type="number" placeholder="BR" value={settings.border?.radius?.br ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), br: e.target.value })} /><ZoruInput type="number" placeholder="BL" value={settings.border?.radius?.bl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), bl: e.target.value })} /></div></div>
                            <div className="space-y-2"><ZoruLabel>Box Shadow</ZoruLabel><ZoruSelect value={settings.boxShadow || 'none'} onValueChange={v => handleUpdate('boxShadow', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Hover Animation</ZoruLabel><ZoruSelect value={settings.hoverAnimation || 'none'} onValueChange={v => handleUpdate('hoverAnimation', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent>{hoverAnimationOptions.map(opt => <ZoruSelectItem key={opt.value} value={opt.value}>{opt.label}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Transition Duration (s)</ZoruLabel><ZoruInput type="number" step="0.1" value={settings.transitionDuration || '0.3'} onChange={e => handleUpdate('transitionDuration', e.target.value)} /></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_filters">
                        <ZoruAccordionTrigger>CSS Filters</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <Tabs defaultValue="normal">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="normal">Normal</TabsTrigger>
                                    <TabsTrigger value="hover">Hover</TabsTrigger>
                                </TabsList>
                                <TabsContent value="normal" className="pt-4 space-y-4">
                                    <div className="space-y-2"><ZoruLabel>Blur (px)</ZoruLabel><Slider value={[settings.filter?.blur || 0]} onValueChange={v => handleSubFieldUpdate('filter', 'blur', v[0])} min={0} max={10} step={1} /></div>
                                    <div className="space-y-2"><ZoruLabel>Brightness (%)</ZoruLabel><Slider value={[settings.filter?.brightness || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'brightness', v[0])} min={0} max={200} step={5} /></div>
                                    <div className="space-y-2"><ZoruLabel>Contrast (%)</ZoruLabel><Slider value={[settings.filter?.contrast || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'contrast', v[0])} min={0} max={200} step={5} /></div>
                                    <div className="space-y-2"><ZoruLabel>Saturation (%)</ZoruLabel><Slider value={[settings.filter?.saturate || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'saturate', v[0])} min={0} max={200} step={5} /></div>
                                    <div className="space-y-2"><ZoruLabel>Hue (deg)</ZoruLabel><Slider value={[settings.filter?.hue || 0]} onValueChange={v => handleSubFieldUpdate('filter', 'hue', v[0])} min={0} max={360} step={5} /></div>
                                </TabsContent>
                                <TabsContent value="hover" className="pt-4 space-y-4">
                                    <div className="space-y-2"><ZoruLabel>Blur (px)</ZoruLabel><Slider value={[settings.hoverFilter?.blur || 0]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'blur', v[0])} min={0} max={10} step={1} /></div>
                                    <div className="space-y-2"><ZoruLabel>Brightness (%)</ZoruLabel><Slider value={[settings.hoverFilter?.brightness || 100]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'brightness', v[0])} min={0} max={200} step={5} /></div>
                                    <div className="space-y-2"><ZoruLabel>Contrast (%)</ZoruLabel><Slider value={[settings.hoverFilter?.contrast || 100]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'contrast', v[0])} min={0} max={200} step={5} /></div>
                                    <div className="space-y-2"><ZoruLabel>Saturation (%)</ZoruLabel><Slider value={[settings.hoverFilter?.saturate || 100]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'saturate', v[0])} min={0} max={200} step={5} /></div>
                                    <div className="space-y-2"><ZoruLabel>Hue (deg)</ZoruLabel><Slider value={[settings.hoverFilter?.hue || 0]} onValueChange={v => handleSubFieldUpdate('hoverFilter', 'hue', v[0])} min={0} max={360} step={5} /></div>
                                </TabsContent>
                            </Tabs>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_navigation">
                        <ZoruAccordionTrigger>Navigation</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <h4 className="font-semibold text-sm">Arrows</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><ZoruLabel>Position</ZoruLabel><ZoruSelect value={settings.arrowPosition || 'inside'} onValueChange={v => handleUpdate('arrowPosition', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inside">Inside</ZoruSelectItem><ZoruSelectItem value="outside">Outside</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                <div className="space-y-2"><ZoruLabel>Arrow Size (px)</ZoruLabel><ZoruInput type="number" value={settings.arrowSize || 40} onChange={e => handleUpdate('arrowSize', Number(e.target.value))} /></div>
                                <div className="space-y-2"><ZoruLabel>Arrow Color</ZoruLabel><ZoruInput type="color" value={settings.arrowColor || '#ffffff'} onChange={e => handleUpdate('arrowColor', e.target.value)} /></div>
                                <div className="space-y-2"><ZoruLabel>Arrow BG</ZoruLabel><ZoruInput type="color" value={settings.arrowBgColor || '#00000080'} onChange={e => handleUpdate('arrowBgColor', e.target.value)} /></div>
                                <div className="space-y-2"><ZoruLabel>Arrow Hover Color</ZoruLabel><ZoruInput type="color" value={settings.arrowHoverColor || '#ffffff'} onChange={e => handleUpdate('arrowHoverColor', e.target.value)} /></div>
                                <div className="space-y-2"><ZoruLabel>Arrow Hover BG</ZoruLabel><ZoruInput type="color" value={settings.arrowHoverBgColor || '#000000cc'} onChange={e => handleUpdate('arrowHoverBgColor', e.target.value)} /></div>
                                <div className="space-y-2 col-span-2"><ZoruLabel>Arrow Border Radius (px)</ZoruLabel><ZoruInput type="number" value={settings.arrowBorderRadius || 50} onChange={e => handleUpdate('arrowBorderRadius', Number(e.target.value))} /></div>
                            </div>
                            <h4 className="font-semibold text-sm pt-4">Dots</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><ZoruLabel>Dot Position</ZoruLabel><ZoruSelect value={settings.dotPosition || 'outside'} onValueChange={v => handleUpdate('dotPosition', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="outside">Outside</ZoruSelectItem><ZoruSelectItem value="inside">Inside</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                <div className="space-y-2"><ZoruLabel>Dot Size (px)</ZoruLabel><ZoruInput type="number" value={settings.dotSize || 12} onChange={e => handleUpdate('dotSize', Number(e.target.value))} /></div>
                                <div className="space-y-2"><ZoruLabel>Dot Spacing (px)</ZoruLabel><ZoruInput type="number" value={settings.dotSpacing || 8} onChange={e => handleUpdate('dotSpacing', Number(e.target.value))} /></div>
                                <div className="space-y-2"><ZoruLabel>Dot Alignment</ZoruLabel><ZoruSelect value={settings.dotAlignment || 'center'} onValueChange={v => handleUpdate('dotAlignment', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="flex-start">Left</ZoruSelectItem><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="flex-end">Right</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                <div className="space-y-2"><ZoruLabel>Dot Color</ZoruLabel><ZoruInput type="color" value={settings.dotColor || '#ffffff80'} onChange={e => handleUpdate('dotColor', e.target.value)} /></div>
                                <div className="space-y-2"><ZoruLabel>Active Dot Color</ZoruLabel><ZoruInput type="color" value={settings.activeDotColor || '#ffffff'} onChange={e => handleUpdate('activeDotColor', e.target.value)} /></div>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>

            <TabsContent value="advanced" className="pt-4">
                <ZoruAccordion type="multiple" className="w-full" defaultValue={['advanced_spacing']}>
                    <ZoruAccordionItem value="advanced_spacing">
                        <ZoruAccordionTrigger>Spacing</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>Margin (Top, Right, Bottom, Left) in px</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="T" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><ZoruInput type="number" placeholder="R" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} /><ZoruInput type="number" placeholder="B" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /><ZoruInput type="number" placeholder="L" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} /></div></div>
                            <div className="space-y-2"><ZoruLabel>Padding (Top, Right, Bottom, Left) in px</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="T" value={settings.padding?.top ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><ZoruInput type="number" placeholder="R" value={settings.padding?.right ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><ZoruInput type="number" placeholder="B" value={settings.padding?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><ZoruInput type="number" placeholder="L" value={settings.padding?.left ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_motion">
                        <ZoruAccordionTrigger>Motion Effects</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>Entrance Animation</ZoruLabel><ZoruSelect value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="fadeIn">Fade In</ZoruSelectItem><ZoruSelectItem value="fadeInUp">Fade In Up</ZoruSelectItem><ZoruSelectItem value="fadeInDown">Fade In Down</ZoruSelectItem><ZoruSelectItem value="fadeInLeft">Fade In Left</ZoruSelectItem><ZoruSelectItem value="fadeInRight">Fade In Right</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Animation Duration</ZoruLabel><ZoruSelect value={settings.animationDuration || 'normal'} onValueChange={(val) => handleUpdate('animationDuration', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="slow">Slow</ZoruSelectItem><ZoruSelectItem value="normal">Normal</ZoruSelectItem><ZoruSelectItem value="fast">Fast</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Animation Delay (ms)</ZoruLabel><ZoruInput type="number" value={settings.animationDelay || ''} onChange={e => handleUpdate('animationDelay', e.target.value)} /></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_responsive">
                        <ZoruAccordionTrigger>Responsive</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <ZoruLabel>Visibility</ZoruLabel>
                            <div className="flex flex-col gap-2 rounded-md border p-3">
                                <div className="flex items-center justify-between"><ZoruLabel htmlFor="showOnDesktop" className="font-normal">Show on Desktop</ZoruLabel><ZoruSwitch id="showOnDesktop" checked={settings.responsiveVisibility?.desktop !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'desktop', val)} /></div>
                                <div className="flex items-center justify-between"><ZoruLabel htmlFor="showOnTablet" className="font-normal">Show on Tablet</ZoruLabel><ZoruSwitch id="showOnTablet" checked={settings.responsiveVisibility?.tablet !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'tablet', val)} /></div>
                                <div className="flex items-center justify-between"><ZoruLabel htmlFor="showOnMobile" className="font-normal">Show on Mobile</ZoruLabel><ZoruSwitch id="showOnMobile" checked={settings.responsiveVisibility?.mobile !== false} onCheckedChange={(val) => handleSubFieldUpdate('responsiveVisibility', 'mobile', val)} /></div>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_attributes">
                        <ZoruAccordionTrigger>Attributes</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            {(settings.customAttributes || []).map((attr: any, index: number) => (
                                <div key={attr.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center"><ZoruInput placeholder="Key" value={attr.key} onChange={e => handleAttributeChange(index, 'key', e.target.value)} /><ZoruInput placeholder="Value" value={attr.value} onChange={e => handleAttributeChange(index, 'value', e.target.value)} /><ZoruButton type="button" variant="ghost" size="icon" onClick={() => removeAttribute(index)}><Trash2 className="h-4 w-4 text-destructive" /></ZoruButton></div>
                            ))}
                            <ZoruButton type="button" variant="outline" className="w-full" onClick={addAttribute}><Plus className="mr-2 h-4 w-4" />Add Attribute</ZoruButton>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="advanced_custom">
                        <ZoruAccordionTrigger>Custom CSS</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>CSS ID</ZoruLabel><ZoruInput value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>CSS Classes</ZoruLabel><ZoruInput value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>Custom CSS</ZoruLabel><ZoruTextarea value={settings.customCss || ''} onChange={e => handleUpdate('customCss', e.target.value)} className="font-mono" placeholder={`selector {\n  color: red;\n}`} /></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>
        </Tabs>
    );
}
