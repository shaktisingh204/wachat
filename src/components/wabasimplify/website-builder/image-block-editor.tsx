
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '../ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Separator } from '../ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Lightbulb } from 'lucide-react';
import { Slider } from '../ui/slider';

const handleFileChange = (file: File | null, callback: (dataUri: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        callback(reader.result as string);
    };
    reader.readAsDataURL(file);
};

export function ImageBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
        newAttributes[index] = {...newAttributes[index], key: field === 'key' ? value : newAttributes[index].key, value: field === 'value' ? value : newAttributes[index].value};
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
                 <Accordion type="multiple" className="w-full" defaultValue={['content_image', 'content_link']}>
                    <AccordionItem value="content_image">
                        <AccordionTrigger>Image</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <Label htmlFor={`src-${settings.id}`}>Image Upload</Label>
                                <Input id={`src-${settings.id}`} type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleUpdate('src', dataUri))} />
                            </div>
                             <div className="space-y-2">
                                <Label>Alignment</Label>
                                <Select value={settings.align || 'center'} onValueChange={(val) => handleUpdate('align', val)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="left">Left</SelectItem>
                                        <SelectItem value="center">Center</SelectItem>
                                        <SelectItem value="right">Right</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Caption</Label>
                                <Input value={settings.caption || ''} onChange={(e) => handleUpdate('caption', e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label>Alt Text</Label>
                                <Input value={settings.alt || ''} onChange={(e) => handleUpdate('alt', e.target.value)} />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="content_link">
                        <AccordionTrigger>Link</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label>URL</Label>
                                <Input type="url" placeholder="https://..." value={settings.link || ''} onChange={(e) => handleUpdate('link', e.target.value)} />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="link-newtab" checked={settings.linkNewTab} onCheckedChange={(val) => handleUpdate('linkNewTab', val)} />
                                <Label htmlFor="link-newtab">Open in new tab</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <Switch id="link-nofollow" checked={settings.linkNofollow} onCheckedChange={(val) => handleUpdate('linkNofollow', val)} />
                                <Label htmlFor="link-nofollow">Add "nofollow" attribute</Label>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="content_structure">
                        <AccordionTrigger>Structure</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label>HTML Tag</Label>
                                <Select value={settings.htmlTag || 'div'} onValueChange={(val) => handleUpdate('htmlTag', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="div">div</SelectItem>
                                        <SelectItem value="figure">figure</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="lazy-load" checked={settings.lazyLoad !== false} onCheckedChange={(val) => handleUpdate('lazyLoad', val)} />
                                <Label htmlFor="lazy-load">Lazy Load</Label>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>
            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_image', 'style_caption']}>
                     <AccordionItem value="style_image">
                        <AccordionTrigger>Image</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Width</Label><Input placeholder="100%" value={settings.width || ''} onChange={e => handleUpdate('width', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Max Width</Label><Input placeholder="e.g. 500px" value={settings.maxWidth || ''} onChange={e => handleUpdate('maxWidth', e.target.value)} /></div>
                            </div>
                            <div className="space-y-2"><Label>Height</Label><Input placeholder="auto" value={settings.height || ''} onChange={e => handleUpdate('height', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Object Fit</Label><Select value={settings.objectFit || 'cover'} onValueChange={v => handleUpdate('objectFit', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cover">Cover</SelectItem><SelectItem value="contain">Contain</SelectItem><SelectItem value="fill">Fill</SelectItem></SelectContent></Select></div>
                            <Separator />
                            <div className="space-y-2"><Label>Opacity</Label><Slider value={[settings.opacity ?? 1]} onValueChange={v => handleUpdate('opacity', v[0])} min={0} max={1} step={0.05} /></div>
                            <div className="space-y-2"><Label>Transition Duration (s)</Label><Input type="number" step="0.1" value={settings.transitionDuration || '0.3'} onChange={e => handleUpdate('transitionDuration', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Hover Animation</Label><Select value={settings.hoverAnimation || 'none'} onValueChange={v => handleUpdate('hoverAnimation', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="zoom">Zoom</SelectItem><SelectItem value="grow">Grow</SelectItem><SelectItem value="shrink">Shrink</SelectItem></SelectContent></Select></div>
                            <Separator />
                            <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" value={settings.borderRadius || '8'} onChange={e => handleUpdate('borderRadius', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Box Shadow</Label><Select value={settings.boxShadow || 'none'} onValueChange={v => handleUpdate('boxShadow', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="sm">Small</SelectItem><SelectItem value="md">Medium</SelectItem><SelectItem value="lg">Large</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_filters">
                        <AccordionTrigger>CSS Filters</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Blur (px)</Label><Slider value={[settings.filter?.blur || 0]} onValueChange={v => handleSubFieldUpdate('filter', 'blur', v[0])} min={0} max={10} step={1} /></div>
                             <div className="space-y-2"><Label>Brightness (%)</Label><Slider value={[settings.filter?.brightness || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'brightness', v[0])} min={0} max={200} step={5} /></div>
                             <div className="space-y-2"><Label>Contrast (%)</Label><Slider value={[settings.filter?.contrast || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'contrast', v[0])} min={0} max={200} step={5} /></div>
                             <div className="space-y-2"><Label>Saturation (%)</Label><Slider value={[settings.filter?.saturate || 100]} onValueChange={v => handleSubFieldUpdate('filter', 'saturate', v[0])} min={0} max={200} step={5} /></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_caption">
                        <AccordionTrigger>Caption Style</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.captionStyle?.color || '#64748b'} onChange={e => handleSubFieldUpdate('captionStyle', 'color', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Font Family</Label><Input value={settings.captionStyle?.fontFamily || ''} onChange={e => handleSubFieldUpdate('captionStyle', 'fontFamily', e.target.value)} placeholder="inherit"/></div>
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Size (px)</Label><Input type="number" value={settings.captionStyle?.fontSize || ''} onChange={e => handleSubFieldUpdate('captionStyle', 'fontSize', e.target.value, true)} /></div><div className="space-y-2"><Label>Weight</Label><Input value={settings.captionStyle?.fontWeight || ''} onChange={e => handleSubFieldUpdate('captionStyle', 'fontWeight', e.target.value)} /></div></div>
                            <div className="space-y-2"><Label>Spacing (px)</Label><Input type="number" value={settings.captionStyle?.spacing || '8'} onChange={e => handleSubFieldUpdate('captionStyle', 'spacing', e.target.value, true)} /></div>
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
