
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, TrendingUp } from 'lucide-react';

export function HeadingBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
                 <Accordion type="multiple" className="w-full" defaultValue={['content_general', 'content_structure']}>
                     <AccordionItem value="content_general">
                        <AccordionTrigger>General</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <Label htmlFor={`text-${settings.id}`}>Title</Label>
                                <Textarea id={`text-${settings.id}`} value={settings.text || 'Heading Text'} onChange={(e) => handleUpdate('text', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`link-${settings.id}`}>Link URL (Optional)</Label>
                                <Input id={`link-${settings.id}`} type="url" value={settings.link || ''} onChange={(e) => handleUpdate('link', e.target.value)} placeholder="https://..." />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="content_subheading">
                        <AccordionTrigger>Subheading</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label>Subheading Text</Label>
                                <Textarea value={settings.subheadingText || ''} onChange={(e) => handleUpdate('subheadingText', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Subheading HTML Tag</Label>
                                 <Select value={settings.subheadingHtmlTag || 'p'} onValueChange={(val) => handleUpdate('subheadingHtmlTag', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="h1">H1</SelectItem><SelectItem value="h2">H2</SelectItem><SelectItem value="h3">H3</SelectItem><SelectItem value="h4">H4</SelectItem><SelectItem value="h5">H5</SelectItem><SelectItem value="h6">H6</SelectItem><SelectItem value="div">div</SelectItem><SelectItem value="span">span</SelectItem><SelectItem value="p">p</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="content_structure">
                        <AccordionTrigger>Structure</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <Label>HTML Tag</Label>
                                <Select value={settings.htmlTag || 'h2'} onValueChange={(val) => handleUpdate('htmlTag', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="h1">H1</SelectItem><SelectItem value="h2">H2</SelectItem><SelectItem value="h3">H3</SelectItem><SelectItem value="h4">H4</SelectItem><SelectItem value="h5">H5</SelectItem><SelectItem value="h6">H6</SelectItem><SelectItem value="div">div</SelectItem><SelectItem value="span">span</SelectItem><SelectItem value="p">p</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Visual Size Override</Label>
                                <Select value={settings.size || 'default'} onValueChange={(val) => handleUpdate('size', val === 'default' ? undefined : val)}>
                                    <SelectTrigger><SelectValue placeholder="Default"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default</SelectItem>
                                        <SelectItem value="text-sm">Small</SelectItem>
                                        <SelectItem value="text-lg">Medium</SelectItem>
                                        <SelectItem value="text-2xl">Large</SelectItem>
                                        <SelectItem value="text-4xl">XL</SelectItem>
                                        <SelectItem value="text-6xl">XXL</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Alignment</Label>
                                <div className="flex gap-2 rounded-md bg-muted p-1">
                                    <Button size="sm" variant={settings.textAlign === 'left' ? 'background' : 'ghost'} onClick={() => handleUpdate('textAlign', 'left')}>Left</Button>
                                    <Button size="sm" variant={settings.textAlign === 'center' ? 'background' : 'ghost'} onClick={() => handleUpdate('textAlign', 'center')}>Center</Button>
                                    <Button size="sm" variant={settings.textAlign === 'right' ? 'background' : 'ghost'} onClick={() => handleUpdate('textAlign', 'right')}>Right</Button>
                                    <Button size="sm" variant={settings.textAlign === 'justify' ? 'background' : 'ghost'} onClick={() => handleUpdate('textAlign', 'justify')}>Justify</Button>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>

            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_text', 'style_subheading']}>
                    <AccordionItem value="style_text">
                        <AccordionTrigger>Title Style</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.color || '#000000'} onChange={(e) => handleUpdate('color', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Blend Mode</Label><Select value={settings.blendMode || 'normal'} onValueChange={(val) => handleUpdate('blendMode', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="multiply">Multiply</SelectItem><SelectItem value="screen">Screen</SelectItem><SelectItem value="overlay">Overlay</SelectItem></SelectContent></Select></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_typography">
                        <AccordionTrigger>Title Typography</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Font Family</Label><Select value={settings.fontFamily || 'inherit'} onValueChange={(val) => handleUpdate('fontFamily', val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Theme Default</SelectItem><SelectItem value="Inter, sans-serif">Inter</SelectItem><SelectItem value="'Roboto', sans-serif">Roboto</SelectItem><SelectItem value="'Lato', sans-serif">Lato</SelectItem><SelectItem value="'Merriweather', serif">Merriweather</SelectItem><SelectItem value="'Playfair Display', serif">Playfair Display</SelectItem></SelectContent></Select></div>
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Size (px)</Label><Input type="number" value={settings.fontSize || ''} onChange={(e) => handleUpdate('fontSize', e.target.value)} placeholder="e.g. 24" /></div><div className="space-y-2"><Label>Weight</Label><Select value={settings.fontWeight || 'normal'} onValueChange={(val) => handleUpdate('fontWeight', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="bold">Bold</SelectItem><SelectItem value="300">300</SelectItem><SelectItem value="500">500</SelectItem><SelectItem value="700">700</SelectItem></SelectContent></Select></div></div>
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Transform</Label><Select value={settings.textTransform || 'none'} onValueChange={v => handleUpdate('textTransform', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="uppercase">Uppercase</SelectItem><SelectItem value="lowercase">Lowercase</SelectItem><SelectItem value="capitalize">Capitalize</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Style</Label><Select value={settings.fontStyle || 'normal'} onValueChange={(val) => handleUpdate('fontStyle', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="italic">Italic</SelectItem></SelectContent></Select></div></div>
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Line Height</Label><Input type="number" step="0.1" value={settings.lineHeight || ''} onChange={(e) => handleUpdate('lineHeight', e.target.value)} placeholder="e.g. 1.6" /></div><div className="space-y-2"><Label>Letter Spacing (px)</Label><Input type="number" value={settings.letterSpacing || ''} onChange={(e) => handleUpdate('letterSpacing', e.target.value)} placeholder="e.g. 1.2" /></div></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_subheading">
                        <AccordionTrigger>Subheading Style</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><Label>Color</Label><Input type="color" value={settings.subheading?.color || '#333333'} onChange={(e) => handleSubFieldUpdate('subheading', 'color', e.target.value)} /></div>
                             <div className="space-y-2"><Label>Typography</Label><Select value={settings.subheading?.fontFamily || 'inherit'} onValueChange={v => handleSubFieldUpdate('subheading', 'fontFamily', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inherit">Theme Default</SelectItem><SelectItem value="Inter, sans-serif">Inter</SelectItem></SelectContent></Select></div>
                             <div className="grid grid-cols-2 gap-2"><div className="space-y-2"><Label>Size (px)</Label><Input type="number" value={settings.subheading?.fontSize || ''} onChange={e => handleSubFieldUpdate('subheading', 'fontSize', e.target.value, true)} /></div><div className="space-y-2"><Label>Weight</Label><Select value={settings.subheading?.fontWeight || 'normal'} onValueChange={v => handleSubFieldUpdate('subheading', 'fontWeight', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="bold">Bold</SelectItem></SelectContent></Select></div></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_shadow">
                        <AccordionTrigger>Text Shadow</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-4 gap-2">
                                <Input type="number" placeholder="X" value={settings.textShadow?.x || '0'} onChange={(e) => handleSubFieldUpdate('textShadow', 'x', e.target.value, true)} />
                                <Input type="number" placeholder="Y" value={settings.textShadow?.y || '0'} onChange={(e) => handleSubFieldUpdate('textShadow', 'y', e.target.value, true)} />
                                <Input type="number" placeholder="Blur" value={settings.textShadow?.blur || '0'} onChange={(e) => handleSubFieldUpdate('textShadow', 'blur', e.target.value, true)} />
                                <Input type="color" value={settings.textShadow?.color || '#000000'} onChange={(e) => handleSubFieldUpdate('textShadow', 'color', e.target.value)} />
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
                             <div className="space-y-2"><Label>Margin (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="Top" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} /><Input type="number" placeholder="R" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} /><Input type="number" placeholder="B" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} /><Input type="number" placeholder="L" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} /></div></div>
                             <div className="space-y-2"><Label>Padding (Top, Right, Bottom, Left) in px</Label><div className="grid grid-cols-4 gap-2"><Input type="number" placeholder="T" value={settings.padding?.top ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} /><Input type="number" placeholder="R" value={settings.padding?.right ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} /><Input type="number" placeholder="B" value={settings.padding?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} /><Input type="number" placeholder="L" value={settings.padding?.left ?? ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} /></div></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="advanced_motion">
                        <AccordionTrigger>Motion Effects</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Entrance Animation</Label><Select value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="fadeIn">Fade In</SelectItem><SelectItem value="fadeInUp">Fade In Up</SelectItem><SelectItem value="zoomIn">Zoom In</SelectItem><SelectItem value="bounce">Bounce</SelectItem></SelectContent></Select></div>
                             <Alert><Lightbulb className="h-4 w-4" /><AlertTitle>Coming Soon</AlertTitle><AlertDescription>Advanced scrolling and mouse effects are planned for a future update.</AlertDescription></Alert>
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
                            <Separator/>
                            <Label>Responsive Alignment</Label>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label className="text-xs">Tablet</Label><Select value={settings.tabletTextAlign || 'default'} onValueChange={v => handleUpdate('tabletTextAlign', v === 'default' ? undefined : v)}><SelectTrigger><SelectValue placeholder="Inherit"/></SelectTrigger><SelectContent><SelectItem value="default">Inherit</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label className="text-xs">Mobile</Label><Select value={settings.mobileTextAlign || 'default'} onValueChange={v => handleUpdate('mobileTextAlign', v === 'default' ? undefined : v)}><SelectTrigger><SelectValue placeholder="Inherit"/></SelectTrigger><SelectContent><SelectItem value="default">Inherit</SelectItem><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent></Select></div>
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
