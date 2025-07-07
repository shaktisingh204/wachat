
'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Security Warning</AlertTitle>
                <AlertDescription>
                    Custom HTML and scripts can introduce security vulnerabilities or break your page layout. Use with caution.
                </AlertDescription>
            </Alert>
            <Accordion type="multiple" defaultValue={['content']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger>Content</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor={`custom-html-${settings.id}`}>Custom HTML/Script</Label>
                            <Textarea
                                id={`custom-html-${settings.id}`}
                                value={settings.html || ''}
                                onChange={(e) => onUpdate({ ...settings, html: e.target.value })}
                                placeholder="<style>...</style> <div>...</div> <script>...</script>"
                                className="h-64 font-mono"
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="layout">
                    <AccordionTrigger>Sizing &amp; Layout</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Width</Label>
                                <Input value={settings.layout?.width || '100%'} onChange={e => handleSubFieldUpdate('layout', 'width', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Height</Label>
                                <Input value={settings.layout?.height || 'auto'} onChange={e => handleSubFieldUpdate('layout', 'height', e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Max Width</Label>
                                <Input value={settings.layout?.maxWidth || ''} placeholder="e.g. 1200px" onChange={e => handleSubFieldUpdate('layout', 'maxWidth', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Min Height</Label>
                                <Input value={settings.layout?.minHeight || ''} placeholder="e.g. 200px" onChange={e => handleSubFieldUpdate('layout', 'minHeight', e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Overflow</Label>
                            <Select value={settings.layout?.overflow || 'visible'} onValueChange={(val) => handleSubFieldUpdate('layout', 'overflow', val)}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="visible">Visible</SelectItem>
                                    <SelectItem value="hidden">Hidden</SelectItem>
                                    <SelectItem value="scroll">Scroll</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
