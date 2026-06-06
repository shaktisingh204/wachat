'use client';

import {
  Label,
  Button,
  Input,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  Badge,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Switch,
} from '@/components/sabcrm/20ui/compat';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { WithId,
  EcommProduct } from '@/lib/definitions';

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
            <Accordion type="multiple" defaultValue={['content']} className="w-full">
                <ZoruAccordionItem value="content">
                    <ZoruAccordionTrigger>Content</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor={`title-${settings.id}`}>Section Title</Label>
                            <Input id={`title-${settings.id}`} value={settings.title || 'Featured Products'} onChange={(e) => handleUpdate('title', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`subtitle-${settings.id}`}>Subtitle</Label>
                            <Input id={`subtitle-${settings.id}`} value={settings.subtitle || ''} onChange={(e) => handleUpdate('subtitle', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Number of Columns</Label>
                            <Select value={settings.columns || '3'} onValueChange={(val) => handleUpdate('columns', val)}>
                                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="3">3 Columns</ZoruSelectItem>
                                    <ZoruSelectItem value="4">4 Columns</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Select Products</Label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <ZoruPopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between h-auto">
                                        <div className="flex flex-wrap gap-1">
                                            {selectedProductIds.length > 0 ? (
                                                availableProducts
                                                    .filter(p => selectedProductIds.includes(p._id.toString()))
                                                    .map(p => <Badge key={p._id.toString()} variant="secondary">{p.name}</Badge>)
                                            ) : (
                                                <span>Select products...</span>
                                            )}
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
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
                            </Popover>
                        </div>
                        <div className="flex items-center space-x-2 pt-4">
                            <Switch id="showViewAllButton" checked={settings.showViewAllButton} onCheckedChange={(val) => handleUpdate('showViewAllButton', val)} />
                            <Label htmlFor="showViewAllButton">Show "View All" Button</Label>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                <ZoruAccordionItem value="layout">
                    <ZoruAccordionTrigger>Sizing &amp; Layout</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="space-y-4 pt-2">
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
                                <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="visible">Visible</ZoruSelectItem>
                                    <ZoruSelectItem value="hidden">Hidden</ZoruSelectItem>
                                    <ZoruSelectItem value="scroll">Scroll</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                        </div>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </Accordion>
        </div>
    );
}

    