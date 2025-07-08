
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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

export function HeroBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleSubFieldUpdate = (mainField: string, subField: string, value: any) => {
        onUpdate({
            ...settings,
            [mainField]: {
                ...(settings[mainField] || {}),
                [subField]: value
            }
        });
    }

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['content', 'layout', 'style']}>
                {/* Content Tab */}
                <AccordionItem value="content">
                    <AccordionTrigger>Content & Typography</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Title</Label><Input value={settings.title || ''} onChange={(e) => handleUpdate('title', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Subtitle</Label><Textarea value={settings.subtitle || ''} onChange={(e) => handleUpdate('subtitle', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.textColor || '#FFFFFF'} onChange={(e) => handleUpdate('textColor', e.target.value)} /></div>
                        <Separator />
                        <h4 className="font-medium">Call to Action Button</h4>
                        <div className="space-y-2"><Label>Button Text</Label><Input placeholder="Shop Now" value={settings.buttonText || ''} onChange={(e) => handleUpdate('buttonText', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Button URL</Label><Input type="url" placeholder="https://..." value={settings.buttonLink || ''} onChange={(e) => handleUpdate('buttonLink', e.target.value)} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Button Color</Label><Input type="color" value={settings.buttonColor || '#FFFFFF'} onChange={(e) => handleUpdate('buttonColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Button Text Color</Label><Input type="color" value={settings.buttonTextColor || '#000000'} onChange={(e) => handleUpdate('buttonTextColor', e.target.value)} /></div>
                        </div>
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
                        <div className="space-y-2"><Label>Padding (T R B L)</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="Top" value={settings.padding?.top ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value)} /><Input type="number" placeholder="Right" value={settings.padding?.right ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value)} /><Input type="number" placeholder="Bottom" value={settings.padding?.bottom ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value)} /><Input type="number" placeholder="Left" value={settings.padding?.left ?? '0'} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value)} /></div></div>
                    </AccordionContent>
                </AccordionItem>

                {/* Style Tab */}
                <AccordionItem value="style">
                    <AccordionTrigger>Style</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Background Type</Label><Select value={settings.backgroundType || 'classic'} onValueChange={(val) => handleUpdate('backgroundType', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="classic">Classic (Color/Image)</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent></Select></div>
                        {settings.backgroundType === 'classic' && (
                            <div className="p-3 border rounded-md space-y-4"><div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.backgroundColor || '#111827'} onChange={(e) => handleUpdate('backgroundColor', e.target.value)} /></div><div className="space-y-2"><Label>Background Image</Label><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleUpdate('backgroundImageUrl', dataUri))} /></div></div>
                        )}
                        {settings.backgroundType === 'video' && (
                            <div className="p-3 border rounded-md space-y-4"><div className="space-y-2"><Label>Background Video URL</Label><Input placeholder="https://example.com/video.mp4" value={settings.backgroundVideoUrl || ''} onChange={(e) => handleUpdate('backgroundVideoUrl', e.target.value)} /></div></div>
                        )}
                        <Separator />
                        <h4 className="font-medium">Background Overlay</h4>
                        <div className="space-y-2"><Label>Overlay Color</Label><Input type="color" value={settings.overlayColor || '#000000'} onChange={(e) => handleUpdate('overlayColor', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Overlay Opacity</Label><Input type="range" min="0" max="1" step="0.1" value={settings.overlayOpacity || 0.3} onChange={(e) => handleUpdate('overlayOpacity', e.target.value)} /></div>
                        <Separator />
                        <h4 className="font-medium">Border & Effects</h4>
                        <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" placeholder="e.g., 12" value={settings.borderRadius || '0'} onChange={e => handleUpdate('borderRadius', e.target.value)} /></div>
                         <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow || 'none'} onValueChange={(val) => handleUpdate('boxShadow', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Shape Divider</Label><Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Coming Soon</AlertTitle><AlertDescription>Shape dividers are planned for a future update.</AlertDescription></Alert></div>
                    </AccordionContent>
                </AccordionItem>
                
                {/* Advanced Tab */}
                 <AccordionItem value="advanced">
                    <AccordionTrigger>Advanced</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'fade'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fade">Fade In</SelectItem><SelectItem value="slide-up">Slide In Up</SelectItem><SelectItem value="zoom">Zoom In</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Z-Index</Label><Input type="number" placeholder="auto" value={settings.zIndex || ''} onChange={e => handleUpdate('zIndex', e.target.value)} /></div>
                        <Separator />
                         <h4 className="font-medium">Responsive</h4>
                         <div className="flex items-center space-x-2"><Switch id="hideDesktop" checked={settings.hideDesktop || false} onCheckedChange={v => handleUpdate('hideDesktop', v)}/><Label htmlFor="hideDesktop">Hide on Desktop</Label></div>
                         <div className="flex items-center space-x-2"><Switch id="hideTablet" checked={settings.hideTablet || false} onCheckedChange={v => handleUpdate('hideTablet', v)}/><Label htmlFor="hideTablet">Hide on Tablet</Label></div>
                         <div className="flex items-center space-x-2"><Switch id="hideMobile" checked={settings.hideMobile || false} onCheckedChange={v => handleUpdate('hideMobile', v)}/><Label htmlFor="hideMobile">Hide on Mobile</Label></div>
                         <Separator />
                        <h4 className="font-medium">Custom</h4>
                        <div className="space-y-2"><Label>CSS ID</Label><Input value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div>
                        <div className="space-y-2"><Label>CSS Classes</Label><Input value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
