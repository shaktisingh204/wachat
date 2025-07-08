
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';

const handleFileChange = (file: File | null, callback: (dataUri: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        callback(reader.result as string);
    };
    reader.readAsDataURL(file);
};


export function SectionBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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

    return (
        <Accordion type="multiple" className="w-full" defaultValue={['layout']}>
            <AccordionItem value="layout">
                <AccordionTrigger>Layout</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <Label>Content Width</Label>
                        <Select value={settings.width || 'boxed'} onValueChange={(val) => handleUpdate('width', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="boxed">Boxed</SelectItem>
                                <SelectItem value="full">Full Width</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {settings.width === 'boxed' && (
                        <div className="space-y-2">
                            <Label>Boxed Width (px)</Label>
                            <Input type="number" value={settings.boxedWidth || '1280'} onChange={e => handleUpdate('boxedWidth', Number(e.target.value))} />
                        </div>
                    )}
                     <div className="space-y-2">
                        <Label>Columns Gap (px)</Label>
                        <Slider
                            value={[settings.gap || 16]}
                            onValueChange={(val) => handleUpdate('gap', val[0])}
                            min={0} max={100} step={1}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>Height</Label>
                        <Select value={settings.heightMode || 'default'} onValueChange={(val) => handleUpdate('heightMode', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default</SelectItem>
                                <SelectItem value="fitToScreen">Fit to Screen</SelectItem>
                                <SelectItem value="minHeight">Min Height</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {settings.heightMode === 'minHeight' && (
                         <div className="space-y-2">
                            <Label>Minimum Height (vh)</Label>
                            <Input type="number" value={settings.minHeight || '50'} onChange={e => handleUpdate('minHeight', Number(e.target.value))} />
                        </div>
                    )}
                     <div className="space-y-2">
                        <Label>Vertical Align</Label>
                        <Select value={settings.verticalAlign || 'top'} onValueChange={(val) => handleUpdate('verticalAlign', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="top">Top</SelectItem>
                                <SelectItem value="middle">Middle</SelectItem>
                                <SelectItem value="bottom">Bottom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label>HTML Tag</Label>
                        <Select value={settings.htmlTag || 'section'} onValueChange={(val) => handleUpdate('htmlTag', val)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="section">section</SelectItem>
                                <SelectItem value="div">div</SelectItem>
                                <SelectItem value="article">article</SelectItem>
                                <SelectItem value="header">header</SelectItem>
                                <SelectItem value="footer">footer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="style">
                <AccordionTrigger>Style</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                     <div className="space-y-2">
                        <Label>Background Type</Label>
                         <Select value={settings.backgroundType || 'none'} onValueChange={(val) => handleUpdate('backgroundType', val)}>
                             <SelectTrigger><SelectValue /></SelectTrigger>
                             <SelectContent>
                                 <SelectItem value="none">None</SelectItem>
                                 <SelectItem value="classic">Classic (Color/Image)</SelectItem>
                             </SelectContent>
                         </Select>
                    </div>
                    {settings.backgroundType === 'classic' && (
                        <div className="p-3 border rounded-md space-y-4">
                            <div className="space-y-2"><Label>Color</Label><Input type="color" value={settings.backgroundColor || '#FFFFFF'} onChange={e => handleUpdate('backgroundColor', e.target.value)} /></div>
                            <div className="space-y-2"><Label>Image</Label><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null, (dataUri) => handleUpdate('backgroundImageUrl', dataUri))} /></div>
                            <div className="space-y-2"><Label>Position</Label><Select value={settings.backgroundPosition || 'center center'} onValueChange={v => handleUpdate('backgroundPosition', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="center center">Center Center</SelectItem><SelectItem value="top center">Top Center</SelectItem><SelectItem value="bottom center">Bottom Center</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Repeat</Label><Select value={settings.backgroundRepeat || 'no-repeat'} onValueChange={v => handleUpdate('backgroundRepeat', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="no-repeat">No-repeat</SelectItem><SelectItem value="repeat">Repeat</SelectItem></SelectContent></Select></div>
                            <div className="space-y-2"><Label>Size</Label><Select value={settings.backgroundSize || 'cover'} onValueChange={v => handleUpdate('backgroundSize', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cover">Cover</SelectItem><SelectItem value="contain">Contain</SelectItem><SelectItem value="auto">Auto</SelectItem></SelectContent></Select></div>
                        </div>
                    )}
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="advanced">
                <AccordionTrigger>Advanced</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                     <div className="space-y-2">
                        <Label>Margin (Top, Right, Bottom, Left) in px</Label>
                        <div className="grid grid-cols-4 gap-2">
                            <Input type="number" placeholder="Top" value={settings.margin?.top ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'top', e.target.value, true)} />
                            <Input type="number" placeholder="Right" value={settings.margin?.right ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'right', e.target.value, true)} />
                            <Input type="number" placeholder="Bottom" value={settings.margin?.bottom ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'bottom', e.target.value, true)} />
                            <Input type="number" placeholder="Left" value={settings.margin?.left ?? ''} onChange={(e) => handleSubFieldUpdate('margin', 'left', e.target.value, true)} />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>Padding (Top, Right, Bottom, Left) in px</Label>
                        <div className="grid grid-cols-4 gap-2">
                            <Input type="number" placeholder="Top" value={settings.padding?.top ?? '64'} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value, true)} />
                            <Input type="number" placeholder="Right" value={settings.padding?.right ?? '16'} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value, true)} />
                            <Input type="number" placeholder="Bottom" value={settings.padding?.bottom ?? '64'} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value, true)} />
                            <Input type="number" placeholder="Left" value={settings.padding?.left ?? '16'} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value, true)} />
                        </div>
                    </div>
                     <div className="space-y-2"><Label>Z-Index</Label><Input type="number" value={settings.zIndex || ''} onChange={e => handleUpdate('zIndex', e.target.value)} /></div>
                     <div className="space-y-2"><Label>CSS ID</Label><Input value={settings.cssId || ''} onChange={e => handleUpdate('cssId', e.target.value)} /></div>
                     <div className="space-y-2"><Label>CSS Classes</Label><Input value={settings.cssClasses || ''} onChange={e => handleUpdate('cssClasses', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Custom CSS</Label><Textarea value={settings.customCss || ''} onChange={e => handleUpdate('customCss', e.target.value)} className="font-mono" placeholder={`selector {\n  color: red;\n}`}/></div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
