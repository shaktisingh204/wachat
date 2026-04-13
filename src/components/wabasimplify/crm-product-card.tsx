
'use client';

import Image from 'next/image';
import { Edit, Trash2, ShoppingBag } from 'lucide-react';
import type { WithId, EcommProduct, CrmProduct } from '@/lib/definitions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteCrmProduct } from '@/app/actions/crm-products.actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';

interface CrmProductCardProps {
    product: WithId<EcommProduct> | WithId<CrmProduct>;
    currency: string;
    onEdit: () => void;
    onDelete: () => void;
    shopSlug?: string;
}

export function CrmProductCard({ product, currency, onEdit, onDelete, shopSlug }: CrmProductCardProps) {
    const { toast } = useToast();

    const handleDelete = async () => {
        const result = await deleteCrmProduct(product._id.toString());
        if (result.success) {
            toast({ title: 'Success', description: 'Product deleted.' });
            onDelete();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const stockStatus = () => {
        // This is a simplified sum for display. Real logic would be per-warehouse.
        const totalStock = product.inventory?.reduce((sum, inv) => sum + inv.stock, 0) ?? ('totalStock' in product ? product.totalStock : ('stock' in product ? product.stock : 0)) ?? 0;

        if (totalStock <= 0) {
            return <ClayBadge tone="red" dot>Out of Stock</ClayBadge>;
        }
        if (totalStock <= 10) {
            return <ClayBadge tone="amber" dot>Low Stock ({totalStock})</ClayBadge>;
        }
        return <ClayBadge tone="green" dot>{totalStock} in Stock</ClayBadge>;
    }

    // Helper to get consistent fields
    const getPrice = () => {
        if ('sellingPrice' in product) return product.sellingPrice;
        if ('price' in product) return product.price;
        return 0;
    };

    const getImage = () => {
        if ('images' in product && product.images && product.images.length > 0) return product.images[0];
        if ('imageUrl' in product) return product.imageUrl;
        return 'https://placehold.co/400x500.png';
    };

    return (
        <ClayCard className="flex flex-col" padded={false}>
            <div className="group block flex-grow flex flex-col">
                <div className="p-0">
                    <div className="relative aspect-[4/5] bg-clay-surface-2 rounded-t-clay-lg overflow-hidden">
                        <Image src={getImage() || 'https://placehold.co/400x500.png'} alt={product.name} layout="fill" objectFit="cover" data-ai-hint="product photo" />
                    </div>
                    <div className="p-4">
                        <h3 className="text-lg font-semibold text-clay-ink">{product.name}</h3>
                    </div>
                </div>
                <div className="p-4 pt-0 flex-grow">
                    <p className="text-sm text-clay-ink-muted line-clamp-2 h-10">{product.description}</p>
                    <div className="flex justify-between items-center mt-4">
                        <p className="text-lg font-semibold text-clay-ink">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(getPrice())}</p>
                        {stockStatus()}
                    </div>
                </div>
            </div>
            <div className="p-4 flex justify-end gap-2 border-t border-clay-border">
                <ClayButton variant="pill" size="sm" onClick={onEdit} leading={<Edit className="h-4 w-4" />}>Edit</ClayButton>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <ClayButton variant="rose" size="sm" leading={<Trash2 className="h-4 w-4" />}>Delete</ClayButton>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle className="text-clay-ink">Delete Product?</AlertDialogTitle><AlertDialogDescription className="text-clay-ink-muted">This will permanently delete "{product.name}".</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </ClayCard>
    );
}
