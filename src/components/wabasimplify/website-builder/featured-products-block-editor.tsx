
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { WithId, EcommProduct } from '@/lib/definitions';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';

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
                <AccordionItem value="content">
                    <AccordionTrigger>Content</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
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
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="3">3 Columns</SelectItem>
                                    <SelectItem value="4">4 Columns</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Select Products</Label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
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
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search products..." />
                                        <CommandList>
                                            <CommandEmpty>No products found.</CommandEmpty>
                                            <CommandGroup>
                                                {availableProducts.map((product) => (
                                                    <CommandItem
                                                        key={product._id.toString()}
                                                        value={product.name}
                                                        onSelect={() => handleSelectProduct(product._id.toString())}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", selectedProductIds.includes(product._id.toString()) ? "opacity-100" : "opacity-0")} />
                                                        {product.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex items-center space-x-2 pt-4">
                            <Switch id="showViewAllButton" checked={settings.showViewAllButton} onCheckedChange={(val) => handleUpdate('showViewAllButton', val)} />
                            <Label htmlFor="showViewAllButton">Show "View All" Button</Label>
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
