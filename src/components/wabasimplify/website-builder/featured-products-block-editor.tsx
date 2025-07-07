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

    return (
        <div className="space-y-4">
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
        </div>
    );
}
