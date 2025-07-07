
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, ShoppingBag, Settings } from 'lucide-react';
import { getEcommProducts, getEcommShopById } from '@/app/actions/custom-ecommerce.actions';
import type { WithId, EcommProduct, EcommShop } from '@/lib/definitions';
import { EcommProductDialog } from '@/components/wabasimplify/ecomm-product-dialog';
import { EcommProductCard } from '@/components/wabasimplify/ecomm-product-card';
import { SyncCustomProductsDialog } from '@/components/wabasimplify/sync-custom-products-dialog';
import { useParams } from 'next/navigation';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><Skeleton className="h-10 w-32" /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
            </div>
        </div>
    );
}

export default function ProductsPage() {
    const params = useParams();
    const shopId = params.shopId as string;
    const [shop, setShop] = useState<WithId<EcommShop> | null>(null);
    const [products, setProducts] = useState<WithId<EcommProduct>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<WithId<EcommProduct> | null>(null);

    const fetchData = () => {
        if (shopId) {
            startLoading(async () => {
                 const [shopData, productsData] = await Promise.all([
                    getEcommShopById(shopId),
                    getEcommProducts(shopId),
                ]);
                setShop(shopData);
                setProducts(productsData);
            });
        }
    };

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopId]);

    const handleOpenDialog = (product: WithId<EcommProduct> | null) => {
        setEditingProduct(product);
        setIsDialogOpen(true);
    };

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!shop) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Shop Not Found</AlertTitle>
                <AlertDescription>Please select a valid shop to manage its products.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <>
            <EcommProductDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                shop={shop}
                product={editingProduct}
                onSuccess={fetchData}
            />
            <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold">Products</h2>
                        <p className="text-muted-foreground">Manage products for your custom shop.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {shop.projectId && <SyncCustomProductsDialog projectId={shop.projectId.toString()} shopId={shop._id.toString()} />}
                        <Button onClick={() => handleOpenDialog(null)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Product
                        </Button>
                    </div>
                </div>

                {products.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {products.map(product => (
                            <EcommProductCard 
                                key={product._id.toString()} 
                                product={product}
                                shopSettings={shop}
                                onEdit={() => handleOpenDialog(product)}
                                onDelete={fetchData}
                            />
                        ))}
                    </div>
                ) : (
                     <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                        <ShoppingBag className="mx-auto h-12 w-12" />
                        <h3 className="mt-4 text-lg font-semibold">No Products Yet</h3>
                        <p className="mt-1 text-sm">Click "Add Product" to get started.</p>
                    </div>
                )}
            </div>
        </>
    );
}
