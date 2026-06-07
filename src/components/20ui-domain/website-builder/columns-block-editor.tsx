'use client';

import { Label, Input, Switch, Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/sabcrm/20ui';
import { Slider } from '@/components/sabcrm/20ui';

export function ColumnsBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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

    const columnCount = settings.columnCount || 2;

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['layout']}>
                <AccordionItem value="layout">
                    <AccordionTrigger>Layout</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Columns</Label>
                                <span className="text-sm text-[var(--st-text-secondary)]">{columnCount}</span>
                            </div>
                            <Slider
                                value={[columnCount]}
                                onValueChange={(val) => handleUpdate('columnCount', val[0])}
                                min={1}
                                max={6}
                                step={1}
                            />
                        </div>
                        <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                <Label>Gap between columns (px)</Label>
                                <span className="text-sm text-[var(--st-text-secondary)]">{settings.gap || 16}px</span>
                             </div>
                            <Slider
                                value={[settings.gap || 16]}
                                onValueChange={(val) => handleUpdate('gap', val[0])}
                                min={0}
                                max={64}
                                step={4}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Switch id="stackOnMobile" checked={settings.stackOnMobile !== false} onCheckedChange={(val) => handleUpdate('stackOnMobile', val)} />
                            <Label htmlFor="stackOnMobile">Stack on mobile devices</Label>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="spacing">
                    <AccordionTrigger>Spacing</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Padding (Top, Right, Bottom, Left) in px</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <Input type="number" placeholder="Top" value={settings.padding?.top || ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value)} />
                                <Input type="number" placeholder="Right" value={settings.padding?.right || ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value)} />
                                <Input type="number" placeholder="Bottom" value={settings.padding?.bottom || ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value)} />
                                <Input type="number" placeholder="Left" value={settings.padding?.left || ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value)} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
