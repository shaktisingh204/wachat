'use client';

import { useState, useEffect } from 'react';
import { Search, ShoppingBag, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { getCatalogProducts, type Product } from '@/app/actions/catalog.actions';

interface ProductPickerProps {
    projectId: string;
    catalogId: string;
    selectedIds: string[]; // retailer_ids
    onSelectionChange: (ids: string[]) => void;
    maxSelection?: number;
    trigger?: React.ReactNode;
}

export function ProductPicker({ projectId, catalogId, selectedIds, onSelectionChange, maxSelection = 30, trigger }: ProductPickerProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [tempSelected, setTempSelected] = useState<string[]>(selectedIds);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (open && products.length === 0 && catalogId) {
            loadProducts();
        }
        if (open) {
            setTempSelected(selectedIds);
        }
    }, [open, catalogId]);

    const loadProducts = async (cursor?: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await getCatalogProducts(projectId, catalogId, cursor);
            if (res.error) {
                setError(res.error);
            } else {
                setProducts(prev => cursor ? [...prev, ...(res.products || [])] : (res.products || []));
                setNextCursor(res.nextCursor);
            }
        } catch (e) {
            setError('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    const toggleProduct = (retailerId: string) => {
        setTempSelected(prev => {
            if (prev.includes(retailerId)) {
                return prev.filter(id => id !== retailerId);
            } else {
                if (maxSelection && prev.length >= maxSelection) {
                    toast({ title: `Max ${maxSelection} products allowed`, variant: 'destructive' });
                    return prev;
                }
                return [...prev, retailerId];
            }
        });
    };

    const handleConfirm = () => {
        onSelectionChange(tempSelected);
        setOpen(false);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.retailer_id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline"><ShoppingBag className="mr-2 h-4 w-4" /> Select Products</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Select Products</DialogTitle>
                    <DialogDescription>
                        Choose products from your catalog to display in this section.
                    </DialogDescription>
                    <div className="relative mt-2">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search loaded products..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-6 pt-2">
                    {error ? (
                        <div className="flex h-full items-center justify-center text-destructive">{error}</div>
                    ) : (
                        <ScrollArea className="h-full">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                                {filteredProducts.map((product) => {
                                    const isSelected = tempSelected.includes(product.retailer_id);
                                    return (
                                        <Card
                                            key={product.id}
                                            className={`cursor-pointer transition-all hover:border-primary relative overflow-hidden group ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : ''}`}
                                            onClick={() => toggleProduct(product.retailer_id)}
                                        >
                                            <div className="aspect-square bg-muted relative">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="object-cover w-full h-full" />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-muted-foreground"><ShoppingBag className="h-8 w-8" /></div>
                                                )}
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                                                        <Check className="h-3 w-3" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3">
                                                <h4 className="font-medium text-sm line-clamp-1" title={product.name}>{product.name}</h4>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-xs text-muted-foreground line-clamp-1">{product.retailer_id}</span>
                                                    <span className="text-xs font-semibold">{product.price}</span>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>

                            {!loading && filteredProducts.length === 0 && (
                                <div className="text-center py-10 text-muted-foreground">No products found.</div>
                            )}

                            {nextCursor && (
                                <div className="flex justify-center py-4">
                                    <Button variant="ghost" onClick={() => loadProducts(nextCursor)} disabled={loading}>
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
                                    </Button>
                                </div>
                            )}
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="p-4 border-t bg-muted/20">
                    <div className="flex items-center mr-auto text-sm text-muted-foreground">
                        {tempSelected.length} product(s) selected
                    </div>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirm}>Confirm Selection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
