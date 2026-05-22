'use client';

import {
  Label,
  Button,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Switch,
  Separator,
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
} from '@/components/zoruui';
import { v4 as uuidv4 } from 'uuid';
import { Plus,
  Trash2,
  Lightbulb,
  Upload } from 'lucide-react';
import { Tabs,
  TabsContent,
  TabsList,
  TabsTrigger } from "@/components/ui/tabs";

import { SabFilePickerButton, SabFileUrlInput } from '@/components/sabfiles';

export function ColumnBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
    };

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
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['content_positioning']}>
                    <ZoruAccordionItem value="content_positioning">
                        <ZoruAccordionTrigger>Positioning</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <ZoruLabel>Vertical Align</ZoruLabel>
                                <ZoruSelect value={settings.verticalAlign || 'flex-start'} onValueChange={(val) => handleUpdate('verticalAlign', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="flex-start">Top</ZoruSelectItem>
                                        <ZoruSelectItem value="center">Middle</ZoruSelectItem>
                                        <ZoruSelectItem value="flex-end">Bottom</ZoruSelectItem>
                                        <ZoruSelectItem value="stretch">Stretch</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Horizontal Align</ZoruLabel>
                                <ZoruSelect value={settings.horizontalAlign || 'flex-start'} onValueChange={(val) => handleUpdate('horizontalAlign', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="flex-start">Start</ZoruSelectItem>
                                        <ZoruSelectItem value="center">Center</ZoruSelectItem>
                                        <ZoruSelectItem value="flex-end">End</ZoruSelectItem>
                                        <ZoruSelectItem value="space-between">Space Between</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>HTML Tag</ZoruLabel>
                                <ZoruSelect value={settings.htmlTag || 'div'} onValueChange={(val) => handleUpdate('htmlTag', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="div">div</ZoruSelectItem>
                                        <ZoruSelectItem value="aside">aside</ZoruSelectItem>
                                        <ZoruSelectItem value="article">article</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                             <div className="space-y-2">
                                <ZoruLabel>Column Order</ZoruLabel>
                                <ZoruInput type="number" placeholder="e.g. 1" value={settings.order || ''} onChange={e => handleUpdate('order', e.target.value)} />
                                <p className="text-xs text-muted-foreground">A custom order for flex/grid layouts. Lower numbers appear first.</p>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>
            <TabsContent value="style" className="pt-4">
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['style_background']}>
                     <ZoruAccordionItem value="style_background">
                        <ZoruAccordionTrigger>Background</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                           <div className="space-y-2">
                                <ZoruLabel>Background Type</ZoruLabel>
                                <ZoruSelect value={settings.backgroundType || 'none'} onValueChange={(val) => handleUpdate('backgroundType', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="none">None</ZoruSelectItem>
                                        <ZoruSelectItem value="classic">Classic (Color/Image)</ZoruSelectItem>
                                        <ZoruSelectItem value="gradient">Gradient</ZoruSelectItem>
                                        <ZoruSelectItem value="video">Video</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                             {settings.backgroundType === 'classic' && (
                                <div className="p-3 border rounded-md space-y-4">
                                    <div className="space-y-2"><ZoruLabel>Color</ZoruLabel><ZoruInput type="color" value={settings.backgroundColor || '#FFFFFF'} onChange={e => handleUpdate('backgroundColor', e.target.value)} /></div>
                                    <div className="space-y-2">
                                        <ZoruLabel>Image</ZoruLabel>
                                        <SabFilePickerButton
                                            accept="image"
                                            onPick={({ url }) => handleUpdate('backgroundImageUrl', url)}
                                        >
                                            <Upload className="mr-2 h-4 w-4" /> Pick image
                                        </SabFilePickerButton>
                                    </div>
                                    <div className="space-y-2"><ZoruLabel>Position</ZoruLabel><ZoruSelect value={settings.backgroundPosition || 'center center'} onValueChange={v => handleUpdate('backgroundPosition', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="center center">Center Center</ZoruSelectItem><ZoruSelectItem value="top center">Top Center</ZoruSelectItem><ZoruSelectItem value="bottom center">Bottom Center</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                    <div className="space-y-2"><ZoruLabel>Attachment</ZoruLabel><ZoruSelect value={settings.backgroundAttachment || 'scroll'} onValueChange={v => handleUpdate('backgroundAttachment', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="scroll">Scroll</ZoruSelectItem><ZoruSelectItem value="fixed">Fixed</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                    <div className="space-y-2"><ZoruLabel>Repeat</ZoruLabel><ZoruSelect value={settings.backgroundRepeat || 'no-repeat'} onValueChange={v => handleUpdate('backgroundRepeat', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="no-repeat">No-repeat</ZoruSelectItem><ZoruSelectItem value="repeat">Repeat</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                    <div className="space-y-2"><ZoruLabel>Size</ZoruLabel><ZoruSelect value={settings.backgroundSize || 'cover'} onValueChange={v => handleUpdate('backgroundSize', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="cover">Cover</ZoruSelectItem><ZoruSelectItem value="contain">Contain</ZoruSelectItem><ZoruSelectItem value="auto">Auto</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                </div>
                            )}
                             {settings.backgroundType === 'gradient' && (
                                <div className="p-3 border rounded-md space-y-4">
                                    <div className="space-y-2"><ZoruLabel>Color 1</ZoruLabel><ZoruInput type="color" value={settings.gradient?.color1 || '#FFFFFF'} onChange={e => handleSubFieldUpdate('gradient', 'color1', e.target.value)} /></div>
                                    <div className="space-y-2"><ZoruLabel>Color 2</ZoruLabel><ZoruInput type="color" value={settings.gradient?.color2 || '#F0F0F0'} onChange={e => handleSubFieldUpdate('gradient', 'color2', e.target.value)} /></div>
                                    <div className="space-y-2"><ZoruLabel>Type</ZoruLabel><ZoruSelect value={settings.gradient?.type || 'linear'} onValueChange={v => handleSubFieldUpdate('gradient', 'type', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="linear">Linear</ZoruSelectItem><ZoruSelectItem value="radial">Radial</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                    <div className="space-y-2"><ZoruLabel>Angle (deg)</ZoruLabel><ZoruInput type="number" value={settings.gradient?.angle || 180} onChange={e => handleSubFieldUpdate('gradient', 'angle', e.target.value)} /></div>
                                </div>
                             )}
                            {settings.backgroundType === 'video' && (
                                <div className="p-3 border rounded-md space-y-4">
                                    <div className="space-y-2"><ZoruLabel>Video URL</ZoruLabel><SabFileUrlInput accept="video" placeholder="https://example.com/video.mp4" value={settings.backgroundVideoUrl || ''} onChange={(v) => handleUpdate('backgroundVideoUrl', v)} /></div>
                                    <div className="space-y-2"><ZoruLabel>Start Time (s)</ZoruLabel><ZoruInput type="number" value={settings.backgroundVideoStartTime || 0} onChange={e => handleUpdate('backgroundVideoStartTime', e.target.value)} /></div>
                                    <div className="space-y-2"><ZoruLabel>End Time (s)</ZoruLabel><ZoruInput type="number" value={settings.backgroundVideoEndTime || ''} onChange={e => handleUpdate('backgroundVideoEndTime', e.target.value)} placeholder="End of video" /></div>
                                </div>
                            )}
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_overlay">
                        <ZoruAccordionTrigger>Background Overlay</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><ZoruLabel>Overlay Type</ZoruLabel><ZoruSelect value={settings.backgroundOverlay?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('backgroundOverlay', 'type', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="classic">Color</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             {settings.backgroundOverlay?.type === 'classic' && (
                                 <div className="space-y-2"><ZoruLabel>Color</ZoruLabel><ZoruInput type="color" value={settings.backgroundOverlay?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('backgroundOverlay', 'color', e.target.value)} /></div>
                             )}
                            <div className="space-y-2">
                                <ZoruLabel>Opacity</ZoruLabel>
                                <ZoruInput type="range" min="0" max="1" step="0.05" value={settings.backgroundOverlay?.opacity || 0.5} onChange={e => handleSubFieldUpdate('backgroundOverlay', 'opacity', e.target.value, true)} />
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_border">
                        <ZoruAccordionTrigger>Border & Shadow</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><ZoruLabel>Border Type</ZoruLabel><ZoruSelect value={settings.border?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem><ZoruSelectItem value="dotted">Dotted</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="space-y-2"><ZoruLabel>Width (Top, Right, Bottom, Left) in px</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="T" value={settings.border?.width?.top ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), top: e.target.value })} /><ZoruInput type="number" placeholder="R" value={settings.border?.width?.right ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), right: e.target.value })} /><ZoruInput type="number" placeholder="B" value={settings.border?.width?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), bottom: e.target.value })} /><ZoruInput type="number" placeholder="L" value={settings.border?.width?.left ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), left: e.target.value })} /></div></div>
                             <div className="space-y-2"><ZoruLabel>Color</ZoruLabel><ZoruInput type="color" value={settings.border?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} /></div>
                             <div className="space-y-2"><ZoruLabel>Border Radius</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="TL" value={settings.border?.radius?.tl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tl: e.target.value })} /><ZoruInput type="number" placeholder="TR" value={settings.border?.radius?.tr ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tr: e.target.value })} /><ZoruInput type="number" placeholder="BR" value={settings.border?.radius?.br ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), br: e.target.value })} /><ZoruInput type="number" placeholder="BL" value={settings.border?.radius?.bl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), bl: e.target.value })} /></div></div>
                             <div className="space-y-2"><ZoruLabel>Box Shadow</ZoruLabel><ZoruSelect value={settings.boxShadow || 'none'} onValueChange={(val) => handleUpdate('boxShadow', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem><ZoruSelectItem value="xl">Extra Large</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
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
                     <ZoruAccordionItem value="advanced_motion" disabled>
                        <ZoruAccordionTrigger>Motion Effects (Coming Soon)</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="pt-2">
                            <ZoruAlert><Lightbulb className="h-4 w-4" /><ZoruAlertTitle>Coming Soon!</ZoruAlertTitle><ZoruAlertDescription>Advanced scrolling and mouse effects are planned for a future update.</ZoruAlertDescription></ZoruAlert>
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
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>
        </Tabs>
    );
}
