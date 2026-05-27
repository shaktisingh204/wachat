'use client';

import {
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
} from '@/components/zoruui';
export function CrmAutomationBlockEditor({ settings, onUpdate, availableAutomations }: { settings: any, onUpdate: (newSettings: any) => void, availableAutomations?: any[] }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['content']}>
                <ZoruAccordionItem value="content">
                    <ZoruAccordionTrigger>Settings</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Automation Trigger</Label>
                            <Select value={settings.triggerId || ''} onValueChange={(val) => handleUpdate('triggerId', val)}>
                                <ZoruSelectTrigger><ZoruSelectValue placeholder="Select a trigger..." /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {(availableAutomations || []).map(automation => (
                                        <ZoruSelectItem key={automation.id} value={automation.id}>{automation.name}</ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Select which automation campaign to start when this block is activated.</p>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </Accordion>
        </div>
    );
}