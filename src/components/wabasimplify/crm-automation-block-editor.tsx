'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export function CrmAutomationBlockEditor({ settings, onUpdate, availableAutomations }: { settings: any, onUpdate: (newSettings: any) => void, availableAutomations?: any[] }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['content']}>
                <AccordionItem value="content">
                    <AccordionTrigger>Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Automation Trigger</Label>
                            <Select value={settings.triggerId || ''} onValueChange={(val) => handleUpdate('triggerId', val)}>
                                <SelectTrigger><SelectValue placeholder="Select a trigger..." /></SelectTrigger>
                                <SelectContent>
                                    {(availableAutomations || []).map(automation => (
                                        <SelectItem key={automation.id} value={automation.id}>{automation.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Select which automation campaign to start when this block is activated.</p>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
