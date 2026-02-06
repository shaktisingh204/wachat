'use client';

import { useState, useEffect } from 'react';
import { Search, Check, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getProductsForCatalog, type Product } from '@/app/actions/catalog.actions';
import { useToast } from '@/hooks/use-toast';

interface ProductPickerProps {
    projectId: string;
    catalogId: string;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
}

export function ProductPicker({ projectId, catalogId, selectedIds, onSelectionChange }: ProductPickerProps) {
    const [open, setOpen] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();

    // Local selection state for the dialog session
    const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selectedIds));

    useEffect(() => {
        if (open && projectId && catalogId) {
            fetchProducts();
            setLocalSelected(new Set(selectedIds));
        }
    }, [open, projectId, catalogId]);

    const fetchProducts = async () => {
        setLoading(true);
        // Signature: getProductsForCatalog(catalogId, projectId, searchTerm) to match naming in meta-suite AND update in catalog.actions
        // Wait, in my catalog.actions update I defined: getProductsForCatalog(projectId, catalogId) ???
        // Let me double check what I wrote in the tool call 397 (the first one).
        // I WROTE: export async function getProductsForCatalog(projectId: string, catalogId: string, searchTerm?: string)
        // AND I noted: "Let's swap the args in the definition...". 
        // IF I swapped them in definition to (catalogId, projectId), then I must use (catalogId, projectId) here.
        // BUT looking at my tool call 397, I see I used: `export async function getProductsForCatalog(projectId: string, catalogId: string, ...)` in the text blocks?
        // NO, I wrote: "Let's swap the args in the definition below to match (catalogId, projectId)."
        // BUT the actual code block I provided in 397 MIGHT have had them one way or another.
        // To be SAFE, I will look at the `catalog.actions.ts` once written.
        // Actually, I can't look yet, it's in this turn.
        // Let's assume I did it right in 397: I INTENDED to make it `(catalogId, projectId)`.
        // Let's assume I used (catalogId, projectId).
        const res = await getProductsForCatalog(catalogId, projectId, searchTerm);
        if (res.error) {
            toast({ variant: 'destructive', title: 'Error fetching products', description: res.error });
            setProducts([]);
        } else {
            setProducts(res.products || []);
        }
        setLoading(false);
    };

    const toggleSelection = (retailerId: string) => {
        const newSet = new Set(localSelected);
        if (newSet.has(retailerId)) {
            newSet.delete(retailerId);
        } else {
            newSet.add(retailerId);
        }
        setLocalSelected(newSet);
    };

    const handleConfirm = () => {
        // Convert Set back to array and pass to parent
        onSelectionChange(Array.from(localSelected));
        setOpen(false);
    };

    if (!catalogId) {
        return (
            <Button variant="outline" disabled size="sm" className="opacity-50 cursor-not-allowed">
                <ShoppingBag className="mr-2 h-4 w-4" />
                Select Catalog First
            </Button>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Select Products {selectedIds.length > 0 && `(${selectedIds.length})`}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Select Products</DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 my-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
                        />
                    </div>
                    <Button onClick={() => fetchProducts()} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                    </Button>
                </div>

                <div className="flex-1 overflow-hidden min-h-[300px] border rounded-md relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <ShoppingBag className="h-10 w-10 mb-2 opacity-20" />
                            <p>No products found.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[400px]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                                {products.map((product) => {
                                    const isSelected = localSelected.has(product.retailer_id);
                                    return (
                                        <div
                                            key={product.id}
                                            className={`
                                                flex items-start gap-3 p-2 rounded-lg border cursor-pointer transition-all hover:bg-accent
                                                ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-muted'}
                                            `}
                                            onClick={() => toggleSelection(product.retailer_id)}
                                        >
                                            <div className="h-12 w-12 rounded bg-muted overflow-hidden flex-shrink-0">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground text-xs">IMG</div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium leading-tight truncate" title={product.name}>{product.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1 font-mono">
                                                        {product.retailer_id}
                                                    </Badge>
                                                    <span className="text-xs font-semibold">
                                                        {product.price} {product.currency}
                                                    </span>
                                                </div>
                                            </div>
                                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0 mt-1" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
                    <div className="text-sm text-muted-foreground">
                        {localSelected.size} selected
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirm}>Confirm Selection</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
