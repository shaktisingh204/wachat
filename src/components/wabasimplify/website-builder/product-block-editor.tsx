'use client';

import { ZoruLabel } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';

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
                        <ZoruLabel>Alignment</ZoruLabel>
                        <ZoruSelect value={settings.textAlign || 'left'} onValueChange={(val) => handleUpdate('textAlign', val)}>
                            <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="left">Left</ZoruSelectItem>
                                <ZoruSelectItem value="center">Center</ZoruSelectItem>
                                <ZoruSelectItem value="right">Right</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                );
            case 'productImage':
                return (
                    <div className="space-y-2">
                        <ZoruLabel>Object Fit</ZoruLabel>
                        <ZoruSelect value={settings.objectFit || 'cover'} onValueChange={(val) => handleUpdate('objectFit', val)}>
                            <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="cover">Cover</ZoruSelectItem>
                                <ZoruSelectItem value="contain">Contain</ZoruSelectItem>
                                <ZoruSelectItem value="fill">Fill</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                );
            case 'productAddToCart':
                return <p className="text-sm text-muted-foreground">This block has no specific settings.</p>
            default:
                return null;
        }
    };
    
    return (
        <div className="space-y-4">
             <ZoruAccordion type="single" collapsible className="w-full" defaultValue={'settings'}>
                <ZoruAccordionItem value="settings">
                    <ZoruAccordionTrigger>Settings</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-2">
                        {renderSpecificEditor()}
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </ZoruAccordion>
        </div>
    );
}
