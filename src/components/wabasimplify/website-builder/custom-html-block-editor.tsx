
'use client';

import { ZoruLabel } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruAlert, ZoruAlertDescription, ZoruAlertTitle } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';

export function CustomHtmlBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
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
             <ZoruAlert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Security Warning</ZoruAlertTitle>
                <ZoruAlertDescription>
                    Custom HTML and scripts can introduce security vulnerabilities or break your page layout. Use with caution.
                </ZoruAlertDescription>
            </ZoruAlert>
            <ZoruAccordion type="multiple" defaultValue={['content']} className="w-full">
                <ZoruAccordionItem value="content">
                    <ZoruAccordionTrigger>Content</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor={`custom-html-${settings.id}`}>Custom HTML/Script</ZoruLabel>
                            <ZoruTextarea
                                id={`custom-html-${settings.id}`}
                                value={settings.html || ''}
                                onChange={(e) => onUpdate({ ...settings, html: e.target.value })}
                                placeholder="<style>...</style> <div>...</div> <script>...</script>"
                                className="h-64 font-mono"
                            />
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                <ZoruAccordionItem value="layout">
                    <ZoruAccordionTrigger>Sizing &amp; Layout</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Width</ZoruLabel>
                                <ZoruInput value={settings.layout?.width || '100%'} onChange={e => handleSubFieldUpdate('layout', 'width', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Height</ZoruLabel>
                                <ZoruInput value={settings.layout?.height || 'auto'} onChange={e => handleSubFieldUpdate('layout', 'height', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel>Max Width</ZoruLabel>
                                <ZoruInput value={settings.layout?.maxWidth || ''} placeholder="e.g. 1200px" onChange={e => handleSubFieldUpdate('layout', 'maxWidth', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel>Min Height</ZoruLabel>
                                <ZoruInput value={settings.layout?.minHeight || ''} placeholder="e.g. 200px" onChange={e => handleSubFieldUpdate('layout', 'minHeight', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Overflow</ZoruLabel>
                            <ZoruSelect value={settings.layout?.overflow || 'visible'} onValueChange={(val) => handleSubFieldUpdate('layout', 'overflow', val)}>
                                <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="visible">Visible</ZoruSelectItem>
                                    <ZoruSelectItem value="hidden">Hidden</ZoruSelectItem>
                                    <ZoruSelectItem value="scroll">Scroll</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </ZoruAccordion>
        </div>
    );
}
