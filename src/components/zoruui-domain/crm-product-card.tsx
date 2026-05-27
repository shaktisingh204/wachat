'use client';

import {
  Button,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Card,
  Badge,
  useZoruToast,
} from '@/components/zoruui';
import { Edit, Trash2, ShoppingBag } from 'lucide-react';
import type { WithId,
  EcommProduct,
  CrmProduct } from '@/lib/definitions';

import Image from 'next/image';

import { deleteCrmProduct } from '@/app/actions/crm-products.actions';
import Link from 'next/link';

interface CrmProductCardProps {
    product: WithId<EcommProduct> | WithId<CrmProduct>;
    currency: string;
    onEdit: () => void;
    onDelete: () => void;
    shopSlug?: string;
}

export function CrmProductCard({ product, currency, onEdit, onDelete, shopSlug }: CrmProductCardProps) {
    const { toast } = useZoruToast();

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
            return <Badge variant="danger">Out of Stock</Badge>;
        }
        if (totalStock <= 10) {
            return <Badge variant="warning">Low Stock ({totalStock})</Badge>;
        }
        return <Badge variant="success">{totalStock} in Stock</Badge>;
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
        <Card className="flex flex-col p-0">
            <div className="group block flex-grow flex flex-col">
                <div className="p-0">
                    <div className="relative aspect-[4/5] bg-zoru-surface-2 rounded-t-xl overflow-hidden">
                        <Image src={getImage() || 'https://placehold.co/400x500.png'} alt={product.name} layout="fill" objectFit="cover" data-ai-hint="product photo" />
                    </div>
                    <div className="p-4">
                        <h3 className="text-lg font-semibold text-zoru-ink">{product.name}</h3>
                    </div>
                </div>
                <div className="p-4 pt-0 flex-grow">
                    <p className="text-sm text-zoru-ink-muted line-clamp-2 h-10">{product.description}</p>
                    <div className="flex justify-between items-center mt-4">
                        <p className="text-lg font-semibold text-zoru-ink">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(getPrice())}</p>
                        {stockStatus()}
                    </div>
                </div>
            </div>
            <div className="p-4 flex justify-end gap-2 border-t border-zoru-line">
                <Button variant="outline" size="sm" onClick={onEdit} leading={<Edit className="h-4 w-4" />}>Edit</Button>
                <ZoruAlertDialog>
                    <ZoruAlertDialogTrigger asChild>
                        <Button size="sm" leading={<Trash2 className="h-4 w-4" />}>Delete</Button>
                    </ZoruAlertDialogTrigger>
                    <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader><ZoruAlertDialogTitle className="text-zoru-ink">Delete Product?</ZoruAlertDialogTitle><ZoruAlertDialogDescription className="text-zoru-ink-muted">This will permanently delete "{product.name}".</ZoruAlertDialogDescription></ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                </ZoruAlertDialog>
            </div>
        </Card>
    );
}
