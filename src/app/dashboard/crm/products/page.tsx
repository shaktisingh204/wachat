
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, ShoppingBag } from 'lucide-react';
import { getCrmProducts } from '@/app/actions/crm-products.actions';
import type { WithId, EcommProduct } from '@/lib/definitions';
import { CrmProductDialog } from '@/components/wabasimplify/crm-product-dialog';
import { CrmProductCard } from '@/components/wabasimplify/crm-product-card';
import { getProjectById } from '@/app/actions';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><Skeleton className="h-10 w-64" /><Skeleton className="h-10 w-32" /></div>
            <Skeleton className="h-4 w-96"/>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
            </div>
        </div>
    );
}

export default function CrmProductsPage() {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectCurrency, setProjectCurrency] = useState<string>('USD');
    const [products, setProducts] = useState<WithId<EcommProduct>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<WithId<EcommProduct> | null>(null);

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            setProjectId(storedProjectId);
            startLoading(async () => {
                const [projectData, productsData] = await Promise.all([
                    getProjectById(storedProjectId),
                    getCrmProducts(storedProjectId)
                ]);
                setProjectCurrency(projectData?.plan?.currency || 'USD');
                setProducts(productsData);
            });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenDialog = (product: WithId<EcommProduct> | null) => {
        setEditingProduct(product);
        setIsDialogOpen(true);
    };

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (!projectId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Project Not Found</AlertTitle>
                <AlertDescription>Please select a project to manage its products.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <>
            <CrmProductDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                projectId={projectId}
                currency={projectCurrency}
                product={editingProduct}
                onSuccess={fetchData}
            />
            <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag /> Product Catalog</h1>
                        <p className="text-muted-foreground">Manage products for your CRM and sales pipeline.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => handleOpenDialog(null)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Product
                        </Button>
                    </div>
                </div>

                {products.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {products.map(product => (
                            <CrmProductCard 
                                key={product._id.toString()} 
                                product={product}
                                currency={projectCurrency}
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
