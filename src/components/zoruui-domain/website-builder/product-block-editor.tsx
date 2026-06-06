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
} from '@/components/sabcrm/20ui/compat';
export function ProductBlockEditor({ settings, onUpdate, blockType }: { settings: any, onUpdate: (newSettings: any) => void, blockType: string }) {
    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const renderSpecificEditor = () => {
        switch (blockType) {
            case 'productTitle':
            case 'productPrice':
            case 'productDescription':
            case 'productBreadcrumbs':
                return (
                     <div className="space-y-2">
                        <Label>Alignment</Label>
                        <Select value={settings.textAlign || 'left'} onValueChange={(val) => handleUpdate('textAlign', val)}>
                            <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="left">Left</ZoruSelectItem>
                                <ZoruSelectItem value="center">Center</ZoruSelectItem>
                                <ZoruSelectItem value="right">Right</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                );
            case 'productImage':
                return (
                    <div className="space-y-2">
                        <Label>Object Fit</Label>
                        <Select value={settings.objectFit || 'cover'} onValueChange={(val) => handleUpdate('objectFit', val)}>
                            <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="cover">Cover</ZoruSelectItem>
                                <ZoruSelectItem value="contain">Contain</ZoruSelectItem>
                                <ZoruSelectItem value="fill">Fill</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                );
            case 'productAddToCart':
                return <p className="text-sm text-zoru-ink-muted">This block has no specific settings.</p>
            default:
                return null;
        }
    };
    
    return (
        <div className="space-y-4">
             <Accordion type="single" collapsible className="w-full" defaultValue={'settings'}>
                <ZoruAccordionItem value="settings">
                    <ZoruAccordionTrigger>Settings</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-2">
                        {renderSpecificEditor()}
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </Accordion>
        </div>
    );
}
