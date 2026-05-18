'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruButton,
  ZoruBadge,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
} from '@/components/zoruui';
import { Edit, Trash2, ShoppingBag } from 'lucide-react';
import type { WithId,
  EcommProduct,
  EcommShop } from '@/lib/definitions';

import Image from 'next/image';

import { deleteEcommProduct } from '@/app/actions/custom-ecommerce.actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface EcommProductCardProps {
    product: WithId<EcommProduct>;
    shopSettings: WithId<EcommShop> | null;
    onEdit: () => void;
    onDelete: () => void;
    shopSlug?: string;
}

export function EcommProductCard({ product, shopSettings, onEdit, onDelete, shopSlug }: EcommProductCardProps) {
    const { toast } = useToast();

    const handleDelete = async () => {
        const result = await deleteEcommProduct(product._id.toString());
        if (result.success) {
            toast({ title: 'Success', description: 'Product deleted.' });
            onDelete();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };
    
    const currency = shopSettings?.currency || 'USD';
    
    const CardContentWrapper = ({ children }: { children: React.ReactNode }) => {
        if (shopSlug) {
            return <Link href={`/shop/${shopSlug}/product/${product._id.toString()}`} className="group block flex-grow flex flex-col">{children}</Link>;
        }
        return <>{children}</>;
    }

    return (
        <ZoruCard className="flex flex-col">
           <CardContentWrapper>
                <ZoruCardHeader className="p-0">
                    <div className="relative aspect-[4/5] bg-muted">
                        <Image src={product.imageUrl || 'https://placehold.co/400x500.png'} alt={product.name} layout="fill" objectFit="cover" className="rounded-t-lg transition-transform group-hover:scale-105" data-ai-hint="product photo"/>
                    </div>
                     <div className="p-4">
                        <ZoruCardTitle className="text-lg">{product.name}</ZoruCardTitle>
                    </div>
                </ZoruCardHeader>
                <ZoruCardContent className="p-4 pt-0 flex-grow">
                    <p className="text-sm text-muted-foreground line-clamp-2 h-10">{product.description}</p>
                    <div className="flex justify-between items-center mt-4">
                        <p className="text-lg font-semibold">{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(product.price)}</p>
                        <ZoruBadge variant={product.stock && product.stock > 0 ? 'default' : 'destructive'}>
                            {product.stock && product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </ZoruBadge>
                    </div>
                </ZoruCardContent>
            </CardContentWrapper>
            <ZoruCardFooter className="p-4 flex justify-end gap-2">
                <ZoruButton variant="outline" size="sm" onClick={onEdit}><Edit className="mr-2 h-4 w-4"/>Edit</ZoruButton>
                <ZoruAlertDialog>
                    <ZoruAlertDialogTrigger asChild><ZoruButton variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4"/>Delete</ZoruButton></ZoruAlertDialogTrigger>
                    <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader><ZoruAlertDialogTitle>Delete Product?</ZoruAlertDialogTitle><ZoruAlertDialogDescription>This will permanently delete "{product.name}".</ZoruAlertDialogDescription></ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                </ZoruAlertDialog>
            </ZoruCardFooter>
        </ZoruCard>
    );
}
