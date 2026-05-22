'use client';

import { Label, Input, Switch, Accordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { Slider } from '@/components/ui/slider';

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
            <ZoruAccordion type="multiple" className="w-full" defaultValue={['layout']}>
                <ZoruAccordionItem value="layout">
                    <ZoruAccordionTrigger>Layout</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <ZoruLabel>Columns</ZoruLabel>
                                <span className="text-sm text-muted-foreground">{columnCount}</span>
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
                                <ZoruLabel>Gap between columns (px)</ZoruLabel>
                                <span className="text-sm text-muted-foreground">{settings.gap || 16}px</span>
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
                            <ZoruSwitch id="stackOnMobile" checked={settings.stackOnMobile !== false} onCheckedChange={(val) => handleUpdate('stackOnMobile', val)} />
                            <ZoruLabel htmlFor="stackOnMobile">Stack on mobile devices</ZoruLabel>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                 <ZoruAccordionItem value="spacing">
                    <ZoruAccordionTrigger>Spacing</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <ZoruLabel>Padding (Top, Right, Bottom, Left) in px</ZoruLabel>
                            <div className="grid grid-cols-4 gap-2">
                                <ZoruInput type="number" placeholder="Top" value={settings.padding?.top || ''} onChange={(e) => handleSubFieldUpdate('padding', 'top', e.target.value)} />
                                <ZoruInput type="number" placeholder="Right" value={settings.padding?.right || ''} onChange={(e) => handleSubFieldUpdate('padding', 'right', e.target.value)} />
                                <ZoruInput type="number" placeholder="Bottom" value={settings.padding?.bottom || ''} onChange={(e) => handleSubFieldUpdate('padding', 'bottom', e.target.value)} />
                                <ZoruInput type="number" placeholder="Left" value={settings.padding?.left || ''} onChange={(e) => handleSubFieldUpdate('padding', 'left', e.target.value)} />
                            </div>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </ZoruAccordion>
        </div>
    );
}
