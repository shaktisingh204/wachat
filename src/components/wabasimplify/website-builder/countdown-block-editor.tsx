
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function CountdownBlockEditor({ settings, onUpdate }: { settings: any, onUpdate: (newSettings: any) => void }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleLabelChange = (labelKey: string, value: string) => {
        onUpdate({
            ...settings,
            labels: {
                ...(settings.labels || {}),
                [labelKey]: value,
            }
        });
    }

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['general', 'style']}>
                <AccordionItem value="general">
                    <AccordionTrigger>General Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="endDate">End Date & Time</Label>
                            <Input
                                id="endDate"
                                type="datetime-local"
                                value={settings.endDate || ''}
                                onChange={(e) => handleUpdate('endDate', e.target.value)}
                            />
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
                    <AccordionTrigger>Action on Completion</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Action</Label>
                            <Select value={settings.actionOnEnd || 'hide'} onValueChange={(val) => handleUpdate('actionOnEnd', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hide">Hide Timer</SelectItem>
                                    <SelectItem value="showMessage">Show Message</SelectItem>
                                    <SelectItem value="redirect">Redirect to URL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {settings.actionOnEnd === 'showMessage' && (
                             <div className="space-y-2">
                                <Label>End Message</Label>
                                <Input value={settings.endMessage || 'The event has started!'} onChange={e => handleUpdate('endMessage', e.target.value)} />
                            </div>
                        )}
                        {settings.actionOnEnd === 'redirect' && (
                             <div className="space-y-2">
                                <Label>Redirect URL</Label>
                                <Input type="url" value={settings.redirectUrl || ''} onChange={e => handleUpdate('redirectUrl', e.target.value)} placeholder="https://example.com" />
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="style">
                    <AccordionTrigger>Styling</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                         <div className="space-y-2">
                            <Label>Style</Label>
                            <Select value={settings.style || 'digital'} onValueChange={(val) => handleUpdate('style', val)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="digital">Digital</SelectItem>
                                    <SelectItem value="circle">Circles</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Background Color</Label>
                                <Input type="color" value={settings.backgroundColor || '#FFFFFF'} onChange={(e) => handleUpdate('backgroundColor', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Text Color</Label>
                                <Input type="color" value={settings.textColor || '#000000'} onChange={(e) => handleUpdate('textColor', e.target.value)} />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
