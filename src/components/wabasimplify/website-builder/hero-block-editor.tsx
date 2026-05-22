'use client';

import {
  Label,
  Button,
  Input,
  Textarea,
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
  ZoruAlertTitle,
  ZoruAlertDescription,
} from '@/components/zoruui';
import { Plus, Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

import { Lightbulb } from 'lucide-react';
import { SabFilePickerButton, SabFileUrlInput } from '@/components/sabfiles';

const shapeDividerOptions = [
    { value: 'none', label: 'None' },
    { value: 'tilt', label: 'Tilt' },
    { value: 'waves', label: 'Waves' },
    { value: 'curve', label: 'Curve' },
];

export function HeroBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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

    // Slideshow handlers
    const handleSlideshowImageChange = (index: number, value: string) => {
        const newImages = [...(settings.slideshowImages || [])];
        newImages[index] = { ...newImages[index], src: value };
        handleUpdate('slideshowImages', newImages);
    };

    const addSlideshowImage = () => {
        const newImages = [...(settings.slideshowImages || []), { id: uuidv4(), src: '' }];
        handleUpdate('slideshowImages', newImages);
    };
    
    const removeSlideshowImage = (index: number) => {
        const newImages = (settings.slideshowImages || []).filter((_: any, i: number) => i !== index);
        handleUpdate('slideshowImages', newImages);
    };

    return (
        <div className="space-y-4">
            <ZoruAccordion type="multiple" className="w-full" defaultValue={['layout', 'style', 'content']}>
                {/* Content Tab */}
                <ZoruAccordionItem value="content">
                    <ZoruAccordionTrigger>Content</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><ZoruLabel>Title</ZoruLabel><ZoruInput value={settings.title || ''} onChange={(e) => handleUpdate('title', e.target.value)} /></div>
                        <div className="space-y-2"><ZoruLabel>Subtitle</ZoruLabel><ZoruTextarea value={settings.subtitle || ''} onChange={(e) => handleUpdate('subtitle', e.target.value)} /></div>
                        <ZoruSeparator />
                        <h4 className="font-medium">Call to Action Button</h4>
                        <div className="space-y-2"><ZoruLabel>Button Text</ZoruLabel><ZoruInput placeholder="Shop Now" value={settings.buttonText || ''} onChange={(e) => handleUpdate('buttonText', e.target.value)} /></div>
                        <div className="space-y-2"><ZoruLabel>Button URL</ZoruLabel><ZoruInput type="url" placeholder="https://..." value={settings.buttonLink || ''} onChange={(e) => handleUpdate('buttonLink', e.target.value)} /></div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                
                {/* Layout Tab */}
                <ZoruAccordionItem value="layout">
                    <ZoruAccordionTrigger>Layout</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><ZoruLabel>Content Layout</ZoruLabel><ZoruSelect value={settings.layout || 'center'} onValueChange={(val) => handleUpdate('layout', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="offset-box">Offset Box</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        <div className="space-y-2"><ZoruLabel>Height</ZoruLabel><ZoruInput placeholder="e.g. 600px or 80vh" value={settings.height || '600px'} onChange={e => handleUpdate('height', e.target.value)} /></div>
                        <div className="space-y-2"><ZoruLabel>Vertical Align</ZoruLabel><ZoruSelect value={settings.verticalAlign || 'center'} onValueChange={(val) => handleUpdate('verticalAlign', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="flex-start">Top</ZoruSelectItem><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="flex-end">Bottom</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        <div className="space-y-2"><ZoruLabel>Text Alignment</ZoruLabel><ZoruSelect value={settings.textAlign || 'center'} onValueChange={(val) => handleUpdate('textAlign', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="left">Left</ZoruSelectItem><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="right">Right</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        <div className="space-y-2"><ZoruLabel>Padding (T R B L) in px</ZoruLabel><div className="grid grid-cols-4 gap-2"><ZoruInput type="number" placeholder="Top" value={settings.padding?.top ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><ZoruInput type="number" placeholder="Right" value={settings.padding?.right ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><ZoruInput type="number" placeholder="Bottom" value={settings.padding?.bottom ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><ZoruInput type="number" placeholder="Left" value={settings.padding?.left ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        <div className="space-y-2"><ZoruLabel>Margin (Top, Bottom) in px</ZoruLabel><div className="grid grid-cols-2 gap-2"><ZoruInput type="number" placeholder="Top" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><ZoruInput type="number" placeholder="Bottom" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /></div></div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>

                {/* Style Tab */}
                <ZoruAccordionItem value="style">
                    <ZoruAccordionTrigger>Style</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><ZoruLabel>Background Type</ZoruLabel><ZoruSelect value={settings.backgroundType || 'classic'} onValueChange={(val) => handleUpdate('backgroundType', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="classic">Classic (Color/Image)</ZoruSelectItem><ZoruSelectItem value="video">Video</ZoruSelectItem><ZoruSelectItem value="slideshow">Slideshow</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        
                        {settings.backgroundType === 'classic' && (
                            <div className="p-3 border rounded-md space-y-4">
                                <div className="space-y-2"><ZoruLabel>Background Color</ZoruLabel><ZoruInput type="color" value={settings.backgroundColor || '#111827'} onChange={(e) => handleUpdate('backgroundColor', e.target.value)} /></div>
                                <div className="space-y-2">
                                    <ZoruLabel>Background Image</ZoruLabel>
                                    <SabFilePickerButton
                                        accept="image"
                                        onPick={({ url }) => handleUpdate('backgroundImageUrl', url)}
                                    >
                                        <Upload className="mr-2 h-4 w-4" /> Pick image
                                    </SabFilePickerButton>
                                </div>
                            </div>
                        )}
                        {settings.backgroundType === 'video' && (
                            <div className="p-3 border rounded-md space-y-4">
                                <div className="space-y-2"><ZoruLabel>Background Video URL</ZoruLabel><SabFileUrlInput accept="video" placeholder="https://example.com/video.mp4" value={settings.backgroundVideoUrl || ''} onChange={(v) => handleUpdate('backgroundVideoUrl', v)} /></div>
                            </div>
                        )}
                        {settings.backgroundType === 'slideshow' && (
                            <div className="p-3 border rounded-md space-y-4">
                                {(settings.slideshowImages || []).map((img: any, index: number) => (
                                    <div key={img.id} className="flex items-center gap-2">
                                        <SabFilePickerButton
                                            accept="image"
                                            className="flex-1"
                                            onPick={({ url }) => handleSlideshowImageChange(index, url)}
                                        >
                                            <Upload className="mr-2 h-4 w-4" /> {img.src ? 'Replace image' : 'Pick image'}
                                        </SabFilePickerButton>
                                        {img.src && <Image src={img.src} alt="preview" width={32} height={32} className="rounded-sm object-cover" />}
                                        <ZoruButton type="button" variant="ghost" size="icon" onClick={() => removeSlideshowImage(index)}><Trash2 className="h-4 w-4"/></ZoruButton>
                                    </div>
                                ))}
                                <SabFilePickerButton
                                    accept="image"
                                    onPick={({ url }) => {
                                        const newImages = [
                                            ...(settings.slideshowImages || []),
                                            { id: uuidv4(), src: url },
                                        ];
                                        handleUpdate('slideshowImages', newImages);
                                    }}
                                >
                                    <Plus className="h-4 w-4 mr-2" />Add Image
                                </SabFilePickerButton>
                            </div>
                        )}

                        <ZoruSeparator />
                        <h4 className="font-medium">Background Overlay</h4>
                        <div className="space-y-2"><ZoruLabel>Overlay Color</ZoruLabel><ZoruInput type="color" value={settings.overlayColor || '#000000'} onChange={(e) => handleUpdate('overlayColor', e.target.value)} /></div>
                        <div className="space-y-2"><ZoruLabel>Overlay Opacity</ZoruLabel><ZoruInput type="range" min="0" max="1" step="0.1" value={settings.overlayOpacity || 0.3} onChange={(e) => handleUpdate('overlayOpacity', e.target.value)} /></div>
                        
                        <ZoruSeparator />
                        <h4 className="font-medium">Text & Button Colors</h4>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.textColor || '#FFFFFF'} onChange={(e) => handleUpdate('textColor', e.target.value)} /></div>
                             <div className="space-y-2"><ZoruLabel>Button Color</ZoruLabel><ZoruInput type="color" value={settings.buttonColor || '#FFFFFF'} onChange={(e) => handleUpdate('buttonColor', e.target.value)} /></div>
                             <div className="space-y-2"><ZoruLabel>Button Text Color</ZoruLabel><ZoruInput type="color" value={settings.buttonTextColor || '#000000'} onChange={(e) => handleUpdate('buttonTextColor', e.target.value)} /></div>
                        </div>

                         <ZoruSeparator />
                        <h4 className="font-medium">Border & Shadow</h4>
                        <div className="space-y-2"><ZoruLabel>Border Radius (px)</ZoruLabel><ZoruInput type="number" placeholder="e.g., 12" value={settings.borderRadius || '0'} onChange={e => handleUpdate('borderRadius', e.target.value)} /></div>
                        <div className="space-y-2"><ZoruLabel>Box Shadow</ZoruLabel><ZoruSelect value={settings.boxShadow || 'none'} onValueChange={(val) => handleUpdate('boxShadow', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>

                        <ZoruSeparator />
                        <h4 className="font-medium">Shape Divider</h4>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel>Top Shape</ZoruLabel><ZoruSelect value={settings.topShape || 'none'} onValueChange={val => handleUpdate('topShape', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent>{shapeDividerOptions.map(o => <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Top Color</ZoruLabel><ZoruInput type="color" value={settings.topShapeColor || '#FFFFFF'} onChange={e => handleUpdate('topShapeColor', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>Top Height (px)</ZoruLabel><ZoruInput type="number" placeholder="100" value={settings.topShapeHeight || ''} onChange={e => handleUpdate('topShapeHeight', e.target.value)} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2"><ZoruLabel>Bottom Shape</ZoruLabel><ZoruSelect value={settings.bottomShape || 'none'} onValueChange={val => handleUpdate('bottomShape', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent>{shapeDividerOptions.map(o => <ZoruSelectItem key={o.value} value={o.value}>{o.label}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Bottom Color</ZoruLabel><ZoruInput type="color" value={settings.bottomShapeColor || '#FFFFFF'} onChange={e => handleUpdate('bottomShapeColor', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>Bottom Height (px)</ZoruLabel><ZoruInput type="number" placeholder="100" value={settings.bottomShapeHeight || ''} onChange={e => handleUpdate('bottomShapeHeight', e.target.value)} /></div>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                
                {/* Advanced Tab */}
                 <ZoruAccordionItem value="advanced">
                    <ZoruAccordionTrigger>Advanced</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <h4 className="font-medium">Motion Effects</h4>
                        <div className="space-y-2"><ZoruLabel>Entrance Animation</ZoruLabel><ZoruSelect value={settings.animation || 'fade'} onValueChange={(val) => handleUpdate('animation', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="fade">Fade In</ZoruSelectItem><ZoruSelectItem value="slide-up">Slide In Up</ZoruSelectItem><ZoruSelectItem value="zoom">Zoom In</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        <div className="space-y-2"><ZoruLabel>Sticky Position</ZoruLabel><ZoruSelect value={settings.sticky || 'none'} onValueChange={(val) => handleUpdate('sticky', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="top">Top of screen</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        
                        <ZoruSeparator />
                        <h4 className="font-medium">Responsive</h4>
                        <div className="flex items-center space-x-2"><ZoruSwitch id="hideDesktop" checked={settings.hideDesktop || false} onCheckedChange={v => handleUpdate('hideDesktop', v)}/><ZoruLabel htmlFor="hideDesktop">Hide on Desktop</ZoruLabel></div>
                        <div className="flex items-center space-x-2"><ZoruSwitch id="hideTablet" checked={settings.hideTablet || false} onCheckedChange={v => handleUpdate('hideTablet', v)}/><ZoruLabel htmlFor="hideTablet">Hide on Tablet</ZoruLabel></div>
                        <div className="flex items-center space-x-2"><ZoruSwitch id="hideMobile" checked={settings.hideMobile || false} onCheckedChange={v => handleUpdate('hideMobile', v)}/><ZoruLabel htmlFor="hideMobile">Hide on Mobile</ZoruLabel></div>
                        
                        <ZoruSeparator />
                        <h4 className="font-medium">Custom</h4>
                        <div className="space-y-2"><ZoruLabel>Z-Index</ZoruLabel><ZoruInput type="number" placeholder="auto" value={settings.zIndex || ''} onChange={e => handleUpdate('zIndex', e.target.value)} /></div>
                        <div className="space-y-2"><ZoruLabel>CSS ID</ZoruLabel><ZoruInput value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div>
                        <div className="space-y-2"><ZoruLabel>CSS Classes</ZoruLabel><ZoruInput value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </ZoruAccordion>
        </div>
    );
}
