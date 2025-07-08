'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="left">Left</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="right">Right</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                );
            case 'productImage':
                return (
                    <div className="space-y-2">
                        <Label>Object Fit</Label>
                        <Select value={settings.objectFit || 'cover'} onValueChange={(val) => handleUpdate('objectFit', val)}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cover">Cover</SelectItem>
                                <SelectItem value="contain">Contain</SelectItem>
                                <SelectItem value="fill">Fill</SelectItem>
                            </SelectContent>
                        </Select>
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
             <Accordion type="single" collapsible className="w-full" defaultValue={'settings'}>
                <AccordionItem value="settings">
                    <AccordionTrigger>Settings</AccordionTrigger>
                    <AccordionContent className="pt-2">
                        {renderSpecificEditor()}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
