
'use client';

import { ZoruLabel, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { DatePicker } from '@/components/ui/date-picker';
import { ZoruRadioGroup, ZoruRadioGroupItem } from '@/components/zoruui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZoruButton } from '@/components/zoruui';
import { Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ZoruTextarea } from '@/components/zoruui';
import { Slider } from '@/components/ui/slider';
import { ZoruSwitch } from '@/components/zoruui';
import { ZoruSeparator } from '@/components/zoruui';

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
                <ZoruAccordion type="multiple" className="w-full" defaultValue={['general', 'labels', 'action']}>
                    <ZoruAccordionItem value="general">
                        <ZoruAccordionTrigger>General</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2">
                                <ZoruLabel>Countdown Type</ZoruLabel>
                                <ZoruRadioGroup value={settings.countdownType || 'dueDate'} onValueChange={(val) => handleUpdate('countdownType', val)} className="flex gap-4">
                                    <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="dueDate" id="type-duedate"/><ZoruLabel htmlFor="type-duedate" className="font-normal">Due Date</ZoruLabel></div>
                                    <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="evergreen" id="type-evergreen"/><ZoruLabel htmlFor="type-evergreen" className="font-normal">Evergreen</ZoruLabel></div>
                                </ZoruRadioGroup>
                             </div>
                            {settings.countdownType === 'evergreen' ? (
                                <div className="p-3 border rounded-md space-y-4">
                                    <ZoruLabel>Duration</ZoruLabel>
                                    <div className="grid grid-cols-3 gap-2">
                                        <ZoruInput type="number" placeholder="Days" value={settings.evergreenDuration?.days || ''} onChange={e => handleSubFieldUpdate('evergreenDuration', 'days', e.target.value, true)} />
                                        <ZoruInput type="number" placeholder="Hours" value={settings.evergreenDuration?.hours || ''} onChange={e => handleSubFieldUpdate('evergreenDuration', 'hours', e.target.value, true)} />
                                        <ZoruInput type="number" placeholder="Mins" value={settings.evergreenDuration?.minutes || ''} onChange={e => handleSubFieldUpdate('evergreenDuration', 'minutes', e.target.value, true)} />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 border rounded-md space-y-4">
                                    <div className="space-y-2">
                                        <ZoruLabel>Due Date</ZoruLabel>
                                        <ZoruInput type="datetime-local" value={settings.endDate || ''} onChange={(e) => handleUpdate('endDate', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <ZoruLabel>Time Zone</ZoruLabel>
                                        <ZoruSelect value={settings.timeZone || 'user'} onValueChange={val => handleUpdate('timeZone', val)}>
                                            <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="user">User's Timezone</ZoruSelectItem>
                                                <ZoruSelectItem value="server">Server Time (UTC)</ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </ZoruSelect>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center space-x-2">
                                <ZoruSwitch id="show-labels" checked={settings.showLabels !== false} onCheckedChange={(val) => handleUpdate('showLabels', val)} />
                                <ZoruLabel htmlFor="show-labels">Show Labels</ZoruLabel>
                            </div>
                            <div className="flex items-center space-x-2">
                                <ZoruSwitch id="show-separators" checked={settings.showSeparators !== false} onCheckedChange={(val) => handleUpdate('showSeparators', val)} />
                                <ZoruLabel htmlFor="show-separators">Show Separators</ZoruLabel>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>HTML Tag</ZoruLabel>
                                <ZoruSelect value={settings.htmlTag || 'div'} onValueChange={(val) => handleUpdate('htmlTag', val)}>
                                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="div">div</ZoruSelectItem>
                                        <ZoruSelectItem value="section">section</ZoruSelectItem>
                                        <ZoruSelectItem value="article">article</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="labels">
                        <ZoruAccordionTrigger>Labels</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><ZoruLabel>Days</ZoruLabel><ZoruInput value={settings.labels?.days || 'Days'} onChange={e => handleLabelChange('days', e.target.value)} /></div>
                                <div className="space-y-2"><ZoruLabel>Hours</ZoruLabel><ZoruInput value={settings.labels?.hours || 'Hours'} onChange={e => handleLabelChange('hours', e.target.value)} /></div>
                                <div className="space-y-2"><ZoruLabel>Minutes</ZoruLabel><ZoruInput value={settings.labels?.minutes || 'Minutes'} onChange={e => handleLabelChange('minutes', e.target.value)} /></div>
                                <div className="space-y-2"><ZoruLabel>Seconds</ZoruLabel><ZoruInput value={settings.labels?.seconds || 'Seconds'} onChange={e => handleLabelChange('seconds', e.target.value)} /></div>
                            </div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="action">
                        <ZoruAccordionTrigger>Action After Expire</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <ZoruSelect value={settings.actionOnEnd || 'hide'} onValueChange={(val) => handleUpdate('actionOnEnd', val)}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="none">Do Nothing</ZoruSelectItem>
                                    <ZoruSelectItem value="hide">Hide Timer</ZoruSelectItem>
                                    <ZoruSelectItem value="showMessage">Show Message</ZoruSelectItem>
                                    <ZoruSelectItem value="redirect">Redirect to URL</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                            {settings.actionOnEnd === 'showMessage' && <div className="space-y-2"><ZoruLabel>Message</ZoruLabel><ZoruTextarea value={settings.endMessage || 'Offer has expired!'} onChange={e => handleUpdate('endMessage', e.target.value)} /></div>}
                            {settings.actionOnEnd === 'redirect' && <div className="space-y-2"><ZoruLabel>Redirect URL</ZoruLabel><ZoruInput type="url" value={settings.redirectUrl || ''} onChange={e => handleUpdate('redirectUrl', e.target.value)} /></div>}
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                </ZoruAccordion>
            </TabsContent>
            <TabsContent value="style" className="pt-4">
                 <ZoruAccordion type="multiple" className="w-full" defaultValue={['style_digits', 'style_labels', 'style_separators']}>
                     <ZoruAccordionItem value="style_digits">
                        <ZoruAccordionTrigger>Digits</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="space-y-2"><ZoruLabel>Typography</ZoruLabel><ZoruSelect value={settings.digitFontFamily || 'inherit'} onValueChange={v => handleUpdate('digitFontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="monospace">Monospace</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.digitColor || '#000000'} onChange={e => handleUpdate('digitColor', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Background</ZoruLabel><ZoruInput type="color" value={settings.digitBgColor || '#FFFFFF'} onChange={e => handleUpdate('digitBgColor', e.target.value)} /></div></div>
                            <div className="space-y-2"><ZoruLabel>Padding (px)</ZoruLabel><ZoruInput type="number" value={settings.digitPadding || '16'} onChange={e => handleUpdate('digitPadding', Number(e.target.value))} /></div>
                             <div className="space-y-2"><ZoruLabel>Border Type</ZoruLabel><ZoruSelect value={settings.digitBorder?.type || 'none'} onValueChange={(val) => handleSubFieldUpdate('digitBorder', 'type', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="solid">Solid</ZoruSelectItem><ZoruSelectItem value="dashed">Dashed</ZoruSelectItem><ZoruSelectItem value="dotted">Dotted</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Border Width (px)</ZoruLabel><ZoruInput type="number" value={settings.digitBorder?.width ?? ''} onChange={(e) => handleSubFieldUpdate('digitBorder', 'width', e.target.value)} /></div><div className="space-y-2"><ZoruLabel>Border Color</ZoruLabel><ZoruInput type="color" value={settings.digitBorder?.color || '#e5e7eb'} onChange={(e) => handleSubFieldUpdate('digitBorder', 'color', e.target.value)} /></div></div>
                             <div className="space-y-2"><ZoruLabel>Border Radius (px)</ZoruLabel><ZoruInput type="number" value={settings.digitBorderRadius || '8'} onChange={e => handleUpdate('digitBorderRadius', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>Box Shadow</ZoruLabel><ZoruSelect value={settings.digitBoxShadow || 'none'} onValueChange={v => handleUpdate('digitBoxShadow', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="sm">Small</ZoruSelectItem><ZoruSelectItem value="md">Medium</ZoruSelectItem><ZoruSelectItem value="lg">Large</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            <div className="space-y-2"><ZoruLabel>Alignment</ZoruLabel><ZoruSelect value={settings.alignment || 'center'} onValueChange={(val) => handleUpdate('alignment', val)}><ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="left">Left</ZoruSelectItem><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="right">Right</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                    <ZoruAccordionItem value="style_labels">
                        <ZoruAccordionTrigger>Labels</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                            <div className="space-y-2"><ZoruLabel>Text Color</ZoruLabel><ZoruInput type="color" value={settings.labelColor || '#64748b'} onChange={e => handleUpdate('labelColor', e.target.value)} /></div>
                            <div className="space-y-2"><ZoruLabel>Spacing from Digit (px)</ZoruLabel><ZoruInput type="number" value={settings.labelSpacing || '8'} onChange={e => handleUpdate('labelSpacing', e.target.value)} /></div>
                             <div className="space-y-2"><ZoruLabel>Typography</ZoruLabel><ZoruSelect value={settings.labelFontFamily || 'inherit'} onValueChange={v => handleUpdate('labelFontFamily', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="inherit">Default</ZoruSelectItem><ZoruSelectItem value="sans-serif">Sans-serif</ZoruSelectItem><ZoruSelectItem value="serif">Serif</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </ZoruAccordionContent>
                    </ZoruAccordionItem>
                     <ZoruAccordionItem value="style_separators">
                        <ZoruAccordionTrigger>Separators</ZoruAccordionTrigger>
                        <ZoruAccordionContent className="space-y-4 pt-2">
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><ZoruLabel>ZoruSeparator Color</ZoruLabel><ZoruInput type="color" value={settings.separatorColor || '#000000'} onChange={e => handleUpdate('separatorColor', e.target.value)} /></div>
                                <div className="space-y-2"><ZoruLabel>ZoruSeparator Size (px)</ZoruLabel><ZoruInput type="number" value={settings.separatorSize || 48} onChange={e => handleUpdate('separatorSize', Number(e.target.value))} /></div>
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
                            <div className="space-y-2"><ZoruLabel>Entrance Animation</ZoruLabel><ZoruSelect value={settings.animation || 'none'} onValueChange={(val) => handleUpdate('animation', val)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="none">None</ZoruSelectItem><ZoruSelectItem value="fadeIn">Fade In</ZoruSelectItem><ZoruSelectItem value="fadeInUp">Fade In Up</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel>Animation Duration</ZoruLabel><ZoruSelect value={settings.animationDuration || 'normal'} onValueChange={v => handleUpdate('animationDuration', v)}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="slow">Slow</ZoruSelectItem><ZoruSelectItem value="normal">Normal</ZoruSelectItem><ZoruSelectItem value="fast">Fast</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div><div className="space-y-2"><ZoruLabel>Animation Delay (ms)</ZoruLabel><ZoruInput type="number" value={settings.animationDelay || ''} onChange={e => handleUpdate('animationDelay', e.target.value)} /></div></div>
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
                            <ZoruSeparator />
                             <ZoruLabel>Responsive Alignment</ZoruLabel>
                             <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><ZoruLabel className="text-xs">Tablet</ZoruLabel><ZoruSelect value={settings.tabletAlign || '__inherit__'} onValueChange={v => handleUpdate('tabletAlign', v === '__inherit__' ? '' : v)}><ZoruSelectTrigger><ZoruSelectValue placeholder="Inherit"/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="__inherit__">Inherit</ZoruSelectItem><ZoruSelectItem value="left">Left</ZoruSelectItem><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="right">Right</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div><div className="space-y-2"><ZoruLabel className="text-xs">Mobile</ZoruLabel><ZoruSelect value={settings.mobileAlign || '__inherit__'} onValueChange={v => handleUpdate('mobileAlign', v === '__inherit__' ? '' : v)}><ZoruSelectTrigger><ZoruSelectValue placeholder="Inherit"/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="__inherit__">Inherit</ZoruSelectItem><ZoruSelectItem value="left">Left</ZoruSelectItem><ZoruSelectItem value="center">Center</ZoruSelectItem><ZoruSelectItem value="right">Right</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div></div>
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
