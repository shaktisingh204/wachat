
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, ShoppingBag, Settings } from 'lucide-react';
import { getEcommProducts, getEcommSettings } from '@/app/actions/custom-ecommerce.actions';
import { getProjectById } from '@/app/actions';
import type { WithId, Project, EcommProduct, EcommSettings } from '@/lib/definitions';
import { EcommProductDialog } from '@/components/wabasimplify/ecomm-product-dialog';
import { EcommProductCard } from '@/components/wabasimplify/ecomm-product-card';
import { SyncCustomProductsDialog } from '@/components/wabasimplify/sync-custom-products-dialog';
import { EcommQuickSetupDialog } from '@/components/wabasimplify/ecomm-quick-setup-dialog';


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

export default function ProductsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [products, setProducts] = useState<WithId<EcommProduct>[]>([]);
    const [settings, setSettings] = useState<EcommSettings | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<WithId<EcommProduct> | null>(null);

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoading(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
                if (projectData) {
                    const [productsData, settingsData] = await Promise.all([
                        getEcommProducts(storedProjectId),
                        getEcommSettings(storedProjectId),
                    ]);
                    setProducts(productsData);
                    setSettings(settingsData);
                }
            });
        } else {
            startLoading(() => {}); // Set loading to false if no project
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

    if (!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its products.</AlertDescription>
            </Alert>
        );
    }

    if (!settings?.shopName) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Shop Not Configured</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                    <span>Please configure your shop name and currency before adding products.</span>
                    <EcommQuickSetupDialog project={project} onSuccess={fetchData}>
                        <Button variant="secondary">
                            <Settings className="mr-2 h-4 w-4" />
                            Configure Shop
                        </Button>
                    </EcommQuickSetupDialog>
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <>
            <EcommProductDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                project={project}
                product={editingProduct}
                onSuccess={fetchData}
            />
            <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag /> Products</h1>
                        <p className="text-muted-foreground">Manage products for your custom shop.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {project.businessId && <SyncCustomProductsDialog projectId={project._id.toString()} />}
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
                                shopSettings={settings}
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
