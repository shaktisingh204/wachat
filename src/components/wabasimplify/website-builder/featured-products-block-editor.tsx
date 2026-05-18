
'use client';

import { ZoruLabel, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruCommand, ZoruCommandEmpty, ZoruCommandGroup, ZoruCommandInput, ZoruCommandItem, ZoruCommandList } from '@/components/zoruui';
import { ZoruPopover, ZoruPopoverContent, ZoruPopoverTrigger } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruBadge } from '@/components/zoruui';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { WithId, EcommProduct } from '@/lib/definitions';
import { ZoruSelect, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from '@/components/zoruui';
import { ZoruAccordion, ZoruAccordionContent, ZoruAccordionItem, ZoruAccordionTrigger } from '@/components/zoruui';
import { ZoruSwitch } from '@/components/zoruui';

export function FeaturedProductsBlockEditor({ settings, onUpdate, availableProducts }: { settings: any, onUpdate: (newSettings: any) => void, availableProducts: WithId<EcommProduct>[] }) {
    const [open, setOpen] = useState(false);
    const selectedProductIds = settings.productIds || [];

    const handleUpdate = (field: string, value: any) => {
        onUpdate({ ...settings, [field]: value });
    };

    const handleSelectProduct = (productId: string) => {
        const newSelected = selectedProductIds.includes(productId)
            ? selectedProductIds.filter((id: string) => id !== productId)
            : [...selectedProductIds, productId];
        handleUpdate('productIds', newSelected);
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

    return (
        <div className="space-y-4">
            <ZoruAccordion type="multiple" defaultValue={['content']} className="w-full">
                <ZoruAccordionItem value="content">
                    <ZoruAccordionTrigger>Content</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor={`title-${settings.id}`}>Section Title</ZoruLabel>
                            <ZoruInput id={`title-${settings.id}`} value={settings.title || 'Featured Products'} onChange={(e) => handleUpdate('title', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel htmlFor={`subtitle-${settings.id}`}>Subtitle</ZoruLabel>
                            <ZoruInput id={`subtitle-${settings.id}`} value={settings.subtitle || ''} onChange={(e) => handleUpdate('subtitle', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Number of Columns</ZoruLabel>
                            <ZoruSelect value={settings.columns || '3'} onValueChange={(val) => handleUpdate('columns', val)}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="3">3 Columns</ZoruSelectItem>
                                    <ZoruSelectItem value="4">4 Columns</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>ZoruSelect Products</ZoruLabel>
                            <ZoruPopover open={open} onOpenChange={setOpen}>
                                <ZoruPopoverTrigger asChild>
                                    <ZoruButton variant="outline" role="combobox" className="w-full justify-between h-auto">
                                        <div className="flex flex-wrap gap-1">
                                            {selectedProductIds.length > 0 ? (
                                                availableProducts
                                                    .filter(p => selectedProductIds.includes(p._id.toString()))
                                                    .map(p => <ZoruBadge key={p._id.toString()} variant="secondary">{p.name}</ZoruBadge>)
                                            ) : (
                                                <span>ZoruSelect products...</span>
                                            )}
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </ZoruButton>
                                </ZoruPopoverTrigger>
                                <ZoruPopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <ZoruCommand>
                                        <ZoruCommandInput placeholder="Search products..." />
                                        <ZoruCommandList>
                                            <ZoruCommandEmpty>No products found.</ZoruCommandEmpty>
                                            <ZoruCommandGroup>
                                                {availableProducts.map((product) => (
                                                    <ZoruCommandItem
                                                        key={product._id.toString()}
                                                        value={product.name}
                                                        onSelect={() => handleSelectProduct(product._id.toString())}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", selectedProductIds.includes(product._id.toString()) ? "opacity-100" : "opacity-0")} />
                                                        {product.name}
                                                    </ZoruCommandItem>
                                                ))}
                                            </ZoruCommandGroup>
                                        </ZoruCommandList>
                                    </ZoruCommand>
                                </ZoruPopoverContent>
                            </ZoruPopover>
                        </div>
                        <div className="flex items-center space-x-2 pt-4">
                            <ZoruSwitch id="showViewAllButton" checked={settings.showViewAllButton} onCheckedChange={(val) => handleUpdate('showViewAllButton', val)} />
                            <ZoruLabel htmlFor="showViewAllButton">Show "View All" ZoruButton</ZoruLabel>
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

    