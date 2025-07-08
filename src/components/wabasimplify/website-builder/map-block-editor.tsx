
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { MapPin, Lightbulb } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';


export function MapBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
            <TabsContent value="content" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['location', 'settings']}>
                    <AccordionItem value="location">
                        <AccordionTrigger>Location</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <Alert>
                                <MapPin className="h-4 w-4" />
                                <AlertTitle>Google Maps API Key Required</AlertTitle>
                                <AlertDescription>
                                    To display maps, you must add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_API_KEY"` to your `.env.local` file.
                                </AlertDescription>
                            </Alert>
                            <div className="space-y-2">
                                <Label>Address or Place Name</Label>
                                <Textarea
                                    value={settings.address || ''}
                                    onChange={(e) => handleUpdate('address', e.target.value)}
                                    placeholder="e.g., Eiffel Tower, Paris, France"
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="settings">
                        <AccordionTrigger>Settings</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>Zoom Level</Label>
                                    <span className="text-sm text-muted-foreground">{settings.zoom || 14}</span>
                                </div>
                                <Slider
                                    value={[settings.zoom || 14]}
                                    onValueChange={(val) => handleUpdate('zoom', val[0])}
                                    min={1}
                                    max={22}
                                    step={1}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Map Type</Label>
                                <Select value={settings.mapType || 'roadmap'} onValueChange={(val) => handleUpdate('mapType', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="roadmap">Roadmap</SelectItem>
                                        <SelectItem value="satellite">Satellite</SelectItem>
                                        <SelectItem value="hybrid">Hybrid</SelectItem>
                                        <SelectItem value="terrain">Terrain</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Language</Label>
                                <Input value={settings.language || ''} onChange={e => handleUpdate('language', e.target.value)} placeholder="e.g., fr for French" />
                            </div>
                            <Alert variant="default" className="mt-4">
                                <Lightbulb className="h-4 w-4" />
                                <AlertTitle>Note on Controls</AlertTitle>
                                <AlertDescription>
                                    Controls like dragging, scroll-wheel zoom, Street View, and fullscreen are managed by Google and are enabled by default in the embedded map. They cannot be toggled off individually with this simple map integration.
                                </AlertDescription>
                            </Alert>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="marker" disabled>
                        <AccordionTrigger>Custom Marker (Pro Feature)</AccordionTrigger>
                        <AccordionContent className="pt-2">
                            <p className="text-sm text-muted-foreground">Advanced marker customization is coming soon.</p>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>

            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_container']}>
                    <AccordionItem value="style_container">
                        <AccordionTrigger>Container</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Background Color</Label><Input type="color" value={settings.backgroundColor || ''} onChange={e => handleUpdate('backgroundColor', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Border Type</Label><Select value={settings.border?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('border', 'type', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="dashed">Dashed</SelectItem><SelectItem value="dotted">Dotted</SelectItem></SelectContent></Select></div>
                             <div className="space-y-2"><Label>Border Width (T R B L) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.border?.width?.top ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), top: e.target.value })} /><Input type="number" placeholder="R" value={settings.border?.width?.right ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), right: e.target.value })} /><Input type="number" placeholder="B" value={settings.border?.width?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), bottom: e.target.value })} /><Input type="number" placeholder="L" value={settings.border?.width?.left ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'width', { ...(settings.border?.width || {}), left: e.target.value })} /></div></div>
                             <div className="space-y-2"><Label>Border Color</Label><Input type="color" value={settings.border?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('border', 'color', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Border Radius (TL TR BR BL)</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="TL" value={settings.border?.radius?.tl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tl: e.target.value })} /><Input type="number" placeholder="TR" value={settings.border?.radius?.tr ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), tr: e.target.value })} /><Input type="number" placeholder="BR" value={settings.border?.radius?.br ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), br: e.target.value })} /><Input type="number" placeholder="BL" value={settings.border?.radius?.bl ?? ''} onChange={(e) => handleSubFieldUpdate('border', 'radius', { ...(settings.border?.radius || {}), bl: e.target.value })} /></div></div>
                             <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow || 'none'} onValueChange={v => handleUpdate('boxShadow', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem><SelectItem value="xl">Extra Large</SelectItem></SelectContent></Select></div>
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
                            <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fadeIn">Fade In</SelectItem><SelectItem value="fadeInUp">Fade In Up</SelectItem></SelectContent></Select></div>
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
                            <Label>Height Per Device</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label className="text-xs">Tablet Height</Label><Input placeholder="e.g. 400px" value={settings.tabletHeight || ''} onChange={e => handleUpdate('tabletHeight', e.target.value)} /></div>
                                <div className="space-y-2"><Label className="text-xs">Mobile Height</Label><Input placeholder="e.g. 300px" value={settings.mobileHeight || ''} onChange={e => handleUpdate('mobileHeight', e.target.value)} /></div>
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
