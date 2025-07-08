
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Lightbulb } from 'lucide-react';

const handleFileChange = (file: File | null, callback: (dataUri: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        callback(reader.result as string);
    };
    reader.readAsDataURL(file);
};

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
            <Accordion type="multiple" className="w-full" defaultValue={['layout', 'style', 'content']}>
                {/* Content Tab */}
                <AccordionItem value="content">
                    <AccordionTrigger>Content</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Title</Label><Input value={settings.title || ''} onChange={(e) => handleUpdate('title', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Subtitle</Label><Textarea value={settings.subtitle || ''} onChange={(e) => handleUpdate('subtitle', e.target.value)} /></div>
                        <Separator />
                        <h4 className="font-medium">Call to Action Button</h4>
                        <div className="space-y-2"><Label>Button Text</Label><Input placeholder="Shop Now" value={settings.buttonText || ''} onChange={(e) => handleUpdate('buttonText', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Button URL</Label><Input type="url" placeholder="https://..." value={settings.buttonLink || ''} onChange={(e) => handleUpdate('buttonLink', e.target.value)} /></div>
                    </AccordionContent>
                </AccordionItem>
                
                {/* Layout Tab */}
                <AccordionItem value="layout">
                    <AccordionTrigger>Layout</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Content Layout</Label><Select value={settings.layout || 'center'} onValueChange={(val) => handleUpdate('layout', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="center">Center</SelectItem><SelectItem value="offset-box">Offset Box</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Height</Label><Input placeholder="e.g. 600px or 80vh" value={settings.height || '600px'} onChange={e => handleUpdate('height', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Vertical Align</Label><Select value={settings.verticalAlign || 'center'} onValueChange={(val) => handleUpdate('verticalAlign', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="flex-start">Top</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="flex-end">Bottom</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Text Alignment</Label><Select value={settings.textAlign || 'center'} onValueChange={(val) => handleUpdate('textAlign', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Padding (T R B L) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="Top" value={settings.padding?.top ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><Input type="number" placeholder="Right" value={settings.padding?.right ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><Input type="number" placeholder="Bottom" value={settings.padding?.bottom ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><Input type="number" placeholder="Left" value={settings.padding?.left ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        <div className="space-y-2"><Label>Margin (Top, Bottom) in px</Label><div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="Top" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><Input type="number" placeholder="Bottom" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /></div></div>
                    </AccordionContent>
                </AccordionItem>

                {/* Style Tab */}
                <AccordionItem value="style">
                    <AccordionTrigger>Style</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Background Type</Label><Select value={settings.backgroundType || 'classic'} onValueChange={(val) => handleUpdate('backgroundType', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="classic">Classic (Color/Image)</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="slideshow">Slideshow</SelectItem></SelectContent></Select></div>
                        
                        {settings.backgroundType === 'classic' && (
                            <div className="p-3 border rounded-md space-y-4"><div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.backgroundColor || '#111827'} onChange={(e) => handleUpdate('backgroundColor', e.target.value)} /></div><div className="space-y-2"><Label>Background Image</Label><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleUpdate('backgroundImageUrl', dataUri))} /></div></div>
                        )}
                        {settings.backgroundType === 'video' && (
                            <div className="p-3 border rounded-md space-y-4"><div className="space-y-2"><Label>Background Video URL</Label><Input placeholder="https://example.com/video.mp4" value={settings.backgroundVideoUrl || ''} onChange={(e) => handleUpdate('backgroundVideoUrl', e.target.value)} /></div></div>
                        )}
                        {settings.backgroundType === 'slideshow' && (
                            <div className="p-3 border rounded-md space-y-4">
                                {(settings.slideshowImages || []).map((img: any, index: number) => (
                                    <div key={img.id} className="flex items-center gap-2">
                                        <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleSlideshowImageChange(index, dataUri))} />
                                        {img.src && <Image src={img.src} alt="preview" width={32} height={32} className="rounded-sm object-cover" />}
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeSlideshowImage(index)}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={addSlideshowImage}><Plus className="h-4 w-4 mr-2" />Add Image</Button>
                            </div>
                        )}

                        <Separator />
                        <h4 className="font-medium">Background Overlay</h4>
                        <div className="space-y-2"><Label>Overlay Color</Label><Input type="color" value={settings.overlayColor || '#000000'} onChange={(e) => handleUpdate('overlayColor', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Overlay Opacity</Label><Input type="range" min="0" max="1" step="0.1" value={settings.overlayOpacity || 0.3} onChange={(e) => handleUpdate('overlayOpacity', e.target.value)} /></div>
                        
                        <Separator />
                        <h4 className="font-medium">Text & Button Colors</h4>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.textColor || '#FFFFFF'} onChange={(e) => handleUpdate('textColor', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Button Color</Label><Input type="color" value={settings.buttonColor || '#FFFFFF'} onChange={(e) => handleUpdate('buttonColor', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Button Text Color</Label><Input type="color" value={settings.buttonTextColor || '#000000'} onChange={(e) => handleUpdate('buttonTextColor', e.target.value)} /></div>
                        </div>

                         <Separator />
                        <h4 className="font-medium">Border & Shadow</h4>
                        <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" placeholder="e.g., 12" value={settings.borderRadius || '0'} onChange={e => handleUpdate('borderRadius', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow || 'none'} onValueChange={(val) => handleUpdate('boxShadow', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem></SelectContent></Select></div>

                        <Separator />
                        <h4 className="font-medium">Shape Divider</h4>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Top Shape</Label><Select value={settings.topShape || 'none'} onValueChange={val => handleUpdate('topShape', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{shapeDividerOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>Top Color</Label><Input type="color" value={settings.topShapeColor || '#FFFFFF'} onChange={e => handleUpdate('topShapeColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Top Height (px)</Label><Input type="number" placeholder="100" value={settings.topShapeHeight || ''} onChange={e => handleUpdate('topShapeHeight', e.target.value)} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2"><Label>Bottom Shape</Label><Select value={settings.bottomShape || 'none'} onValueChange={val => handleUpdate('bottomShape', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{shapeDividerOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>Bottom Color</Label><Input type="color" value={settings.bottomShapeColor || '#FFFFFF'} onChange={e => handleUpdate('bottomShapeColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Bottom Height (px)</Label><Input type="number" placeholder="100" value={settings.bottomShapeHeight || ''} onChange={e => handleUpdate('bottomShapeHeight', e.target.value)} /></div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                
                {/* Advanced Tab */}
                 <AccordionItem value="advanced">
                    <AccordionTrigger>Advanced</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <h4 className="font-medium">Motion Effects</h4>
                        <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'fade'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fade">Fade In</SelectItem><SelectItem value="slide-up">Slide In Up</SelectItem><SelectItem value="zoom">Zoom In</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Sticky Position</Label><Select value={settings.sticky || 'none'} onValueChange={(val) => handleUpdate('sticky', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="top">Top of screen</SelectItem></SelectContent></Select></div>
                        
                        <Separator />
                        <h4 className="font-medium">Responsive</h4>
                        <div className="flex items-center space-x-2"><Switch id="hideDesktop" checked={settings.hideDesktop || false} onCheckedChange={v => handleUpdate('hideDesktop', v)}/><Label htmlFor="hideDesktop">Hide on Desktop</Label></div>
                        <div className="flex items-center space-x-2"><Switch id="hideTablet" checked={settings.hideTablet || false} onCheckedChange={v => handleUpdate('hideTablet', v)}/><Label htmlFor="hideTablet">Hide on Tablet</Label></div>
                        <div className="flex items-center space-x-2"><Switch id="hideMobile" checked={settings.hideMobile || false} onCheckedChange={v => handleUpdate('hideMobile', v)}/><Label htmlFor="hideMobile">Hide on Mobile</Label></div>
                        
                        <Separator />
                        <h4 className="font-medium">Custom</h4>
                        <div className="space-y-2"><Label>Z-Index</Label><Input type="number" placeholder="auto" value={settings.zIndex || ''} onChange={e => handleUpdate('zIndex', e.target.value)} /></div>
                        <div className="space-y-2"><Label>CSS ID</Label><Input value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div>
                        <div className="space-y-2"><Label>CSS Classes</Label><Input value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Custom CSS</Label><Textarea value={settings.customCss || ''} onChange={e => handleUpdate('customCss', e.target.value)} className="font-mono" placeholder={`selector {\n  color: red;\n}`}/></div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
