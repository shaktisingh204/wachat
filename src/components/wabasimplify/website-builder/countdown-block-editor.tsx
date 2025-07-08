
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '../ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';

export function CountdownBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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

    const handleLabelChange = (labelKey: string, value: string) => {
        onUpdate({
            ...settings,
            labels: {
                ...(settings.labels || {}),
                [labelKey]: value,
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
                <Accordion type="multiple" className="w-full" defaultValue={['general', 'labels', 'action']}>
                    <AccordionItem value="general">
                        <AccordionTrigger>General</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <Label>Due Date</Label>
                                <Input type="datetime-local" value={settings.endDate || ''} onChange={(e) => handleUpdate('endDate', e.target.value)} />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch id="show-labels" checked={settings.showLabels !== false} onCheckedChange={(val) => handleUpdate('showLabels', val)} />
                                <Label htmlFor="show-labels">Show Labels</Label>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="labels">
                        <AccordionTrigger>Labels</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Days</Label><Input value={settings.labels?.days || 'Days'} onChange={e => handleLabelChange('days', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Hours</Label><Input value={settings.labels?.hours || 'Hours'} onChange={e => handleLabelChange('hours', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Minutes</Label><Input value={settings.labels?.minutes || 'Minutes'} onChange={e => handleLabelChange('minutes', e.target.value)} /></div>
                                <div className="space-y-2"><Label>Seconds</Label><Input value={settings.labels?.seconds || 'Seconds'} onChange={e => handleLabelChange('seconds', e.target.value)} /></div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="action">
                        <AccordionTrigger>Action After Expire</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <Select value={settings.actionOnEnd || 'hide'} onValueChange={(val) => handleUpdate('actionOnEnd', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hide">Hide Timer</SelectItem>
                                    <SelectItem value="showMessage">Show Message</SelectItem>
                                    <SelectItem value="redirect">Redirect to URL</SelectItem>
                                </SelectContent>
                            </Select>
                            {settings.actionOnEnd === 'showMessage' && <div className="space-y-2"><Label>Message</Label><Textarea value={settings.endMessage || 'Offer has expired!'} onChange={e => handleUpdate('endMessage', e.target.value)} /></div>}
                            {settings.actionOnEnd === 'redirect' && <div className="space-y-2"><Label>Redirect URL</Label><Input type="url" value={settings.redirectUrl || ''} onChange={e => handleUpdate('redirectUrl', e.target.value)} /></div>}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>
            <TabsContent value="style" className="pt-4">
                 <Accordion type="multiple" className="w-full" defaultValue={['style_digits', 'style_labels']}>
                     <AccordionItem value="style_digits">
                        <AccordionTrigger>Digits</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Typography</Label><Select value={settings.digitFontFamily || 'inherit'} onValueChange={v => handleUpdate('digitFontFamily', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="inherit">Default</SelectItem><SelectItem value="monospace">Monospace</SelectItem></SelectContent></Select></div>
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.digitColor || '#000000'} onChange={e => handleUpdate('digitColor', e.target.value)} /></div><div className="space-y-2"><Label>Background</Label><Input type="color" value={settings.digitBgColor || '#FFFFFF'} onChange={e => handleUpdate('digitBgColor', e.target.value)} /></div></div>
                            <div className="space-y-2"><Label>Border Radius (px)</Label><Input type="number" value={settings.digitBorderRadius || '8'} onChange={e => handleUpdate('digitBorderRadius', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Padding (px)</Label><Input type="number" value={settings.digitPadding || '16'} onChange={e => handleUpdate('digitPadding', e.target.value)} /></div>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="style_labels">
                        <AccordionTrigger>Labels</AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><Label>Text Color</Label><Input type="color" value={settings.labelColor || '#64748b'} onChange={e => handleUpdate('labelColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Spacing from Digit (px)</Label><Input type="number" value={settings.labelSpacing || '8'} onChange={e => handleUpdate('labelSpacing', e.target.value)} /></div>
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

