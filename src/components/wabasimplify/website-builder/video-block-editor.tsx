
'use client';

import { ZoruLabel, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruSwitch } from '@/components/zoruui';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ZoruButton } from '@/components/zoruui';
import { Plus, Trash2, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ZoruTextarea } from '@/components/zoruui';
import { Slider } from '@/components/ui/slider';
import { ZoruSeparator } from '@/components/zoruui';
import { SabFilePickerButton } from '@/components/sabfiles';

export function VideoBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['content_source', 'content_playback']}>
                    <ZoruAccordionItem value="content_source">
                        <ZoruAccordionTrigger>Source</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <ZoruLabel htmlFor={`sourceUrl-${settings.id}`}>Video URL</ZoruLabel>
                                <ZoruInput id={`sourceUrl-${settings.id}`} value={settings.sourceUrl || ''} onChange={(e) => handleUpdate('sourceUrl', e.target.value)} placeholder="YouTube, Vimeo, or direct MP4 URL" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><ZoruLabel htmlFor={`startTime-${settings.id}`}>Start Time (s)</ZoruLabel><ZoruInput id={`startTime-${settings.id}`} type="number" value={settings.startTime || ''} onChange={(e) => handleUpdate('startTime', e.target.value)} /></div>
                                <div className="space-y-2"><ZoruLabel htmlFor={`endTime-${settings.id}`}>End Time (s)</ZoruLabel><ZoruInput id={`endTime-${settings.id}`} type="number" value={settings.endTime || ''} onChange={(e) => handleUpdate('endTime', e.target.value)} /></div>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="content_playback">
                        <ZoruAccordionTrigger>Playback Options</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-3 pt-2">
                            <div className="flex items-center space-x-2"><ZoruSwitch id="autoplay" checked={settings.autoPlay || false} onCheckedChange={(val) => handleUpdate('autoPlay', val)} /><ZoruLabel htmlFor="autoplay">Autoplay</ZoruLabel></div>
                            <div className="flex items-center space-x-2"><ZoruSwitch id="loop" checked={settings.loop || false} onCheckedChange={(val) => handleUpdate('loop', val)} /><ZoruLabel htmlFor="loop">Loop</ZoruLabel></div>
                            <div className="flex items-center space-x-2"><ZoruSwitch id="muted" checked={settings.muted !== false} onCheckedChange={(val) => handleUpdate('muted', val)} /><ZoruLabel htmlFor="muted">Mute</ZoruLabel></div>
                            <div className="flex items-center space-x-2"><ZoruSwitch id="controls" checked={settings.controls !== false} onCheckedChange={(val) => handleUpdate('controls', val)} /><ZoruLabel htmlFor="controls">Show Controls</ZoruLabel></div>
                            <div className="flex items-center space-x-2"><ZoruSwitch id="playsinline" checked={settings.playsInline || false} onCheckedChange={(val) => handleUpdate('playsInline', val)} /><ZoruLabel htmlFor="playsinline">Play on Mobile (Playsinline)</ZoruLabel></div>
                            <div className="flex items-center space-x-2"><ZoruSwitch id="lazyLoad" checked={settings.lazyLoad !== false} onCheckedChange={(val) => handleUpdate('lazyLoad', val)} /><ZoruLabel htmlFor="lazyLoad">Lazy Load</ZoruLabel></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                     <ZoruAccordionItem value="content_cover">
                        <ZoruAccordionTrigger>Cover Image (Poster)</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <ZoruLabel>Cover Image</ZoruLabel>
                                <SabFilePickerButton
                                    accept="image"
                                    onPick={({ url }) => handleUpdate('coverImageUrl', url)}
                                >
                                    <Upload className="mr-2 h-4 w-4" /> Pick image
                                </SabFilePickerButton>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>
            <TabsContent value="style" className="pt-4">
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['style_video']}>
                     <ZoruAccordionItem value="style_video">
                        <ZoruAccordionTrigger>Video Style</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><ZoruLabel>Aspect Ratio</ZoruLabel><ZoruSelect value={settings.aspectRatio || '16:9'} onValueChange={(val) => handleUpdate('aspectRatio', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="16:9">16:9</ZoruSelectItem><ZoruSelectItem value="4:3">4:3</ZoruSelectItem><ZoruSelectItem value="1:1">1:1</ZoruSelectItem><ZoruSelectItem value="9:16">9:16 (Vertical)</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="space-y-2"><ZoruLabel>Border Type</ZoruLabel><ZoruSelect value={settings.border?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem><ZoruSelectItem value="dotted">Dotted</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Border Width (px)</ZoruLabel><ZoruInput type="number" value={settings.border?.width || '1'} onChange={(e) => handleSubFieldUpdate('border', 'width', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Border Color</ZoruLabel><ZoruInput type="color" value={settings.border?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} /></div></div>
                             <div className="space-y-2"><ZoruLabel>Border Radius (px)</ZoruLabel><ZoruInput type="number" value={settings.borderRadius || '8'} onChange={e => handleUpdate('borderRadius', e.target.value)} /></div>
                             <div className="space-y-2"><ZoruLabel>Box Shadow</ZoruLabel><ZoruSelect value={settings.boxShadow || 'none'} onValueChange={v => handleUpdate('boxShadow', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_filters">
                        <ZoruAccordionTrigger>CSS Filters</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>Opacity</ZoruLabel><Slider value={[settings.opacity ?? 1]} onValueChange={v => handleUpdate('opacity', v[0])} min={0} max={1} step={0.05} /></div>
                            <div className="space-y-2"><ZoruLabel>Blur (px)</ZoruLabel><Slider value={[settings.filter?.blur || 0]} onValueChange={v => handleSubFieldUpdate('filter', 'blur', v[0])} min={0} max={10} step={1} /></div>
                            <div className="space-y-2"><ZoruLabel>Brightness (%)</ZoruLabel><Slider value={[settings.filter?.brightness || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'brightness', v[0])} min={0} max={200} step={5} /></div>
                            <div className="space-y-2"><ZoruLabel>Contrast (%)</ZoruLabel><Slider value={[settings.filter?.contrast || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'contrast', v[0])} min={0} max={200} step={5} /></div>
                            <div className="space-y-2"><ZoruLabel>Saturation (%)</ZoruLabel><Slider value={[settings.filter?.saturate || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'saturate', v[0])} min={0} max={200} step={5} /></div>
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
                            <div className="space-y-2"><ZoruLabel>Entrance Animation</ZoruLabel><ZoruSelect value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="fadeIn">Fade In</ZoruSelectItem><ZoruSelectItem value="fadeInUp">Fade In Up</ZoruSelectItem><ZoruSelectItem value="zoomIn">Zoom In</ZoruSelectItem><ZoruSelectItem value="bounce">Bounce</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Hover Animation</ZoruLabel><ZoruSelect value={settings.hoverAnimation || 'none'} onValueChange={v => handleUpdate('hoverAnimation', v)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="zoom">Zoom</ZoruSelectItem><ZoruSelectItem value="grow">Grow</ZoruSelectItem><ZoruSelectItem value="shrink">Shrink</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
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
                                 <div key={attr.id} className="grid grid-cols-[1fr,1fr,auto] gap-2 items-center"><ZoruInput placeholder="Key" value={attr.key} onChange={e => handleAttributeChange(index, 'key', e.target.value)} /><ZoruInput placeholder="Value" value={attr.value} onChange={e => handleAttributeChange(index, 'value', e.target.value)} /><ZoruButton type="button" variant="ghost" size="icon" onClick={() => removeAttribute(index)}><Trash2 className="h-4 w-4 text-destructive"/></ZoruButton></div>
                             ))}
                             <ZoruButton type="button" variant="outline" className="w-full" onClick={addAttribute}><Plus className="mr-2 h-4 w-4"/>Add Attribute</ZoruButton>
                         </ZoruAccordionContent>
                    </ZoruAccordionItem>
                     <ZoruAccordionItem value="advanced_custom">
                        <ZoruAccordionTrigger>Custom CSS</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>CSS ID</ZoruLabel><ZoruInput value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>CSS Classes</ZoruLabel><ZoruInput value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>Custom CSS</ZoruLabel><ZoruTextarea value={settings.customCss || ''} onChange={e => handleUpdate('customCss', e.target.value)} className="font-mono" placeholder={`selector {\n  color: red;\n}`}/></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
             </TabsContent>
        </Tabs>
    );
}
