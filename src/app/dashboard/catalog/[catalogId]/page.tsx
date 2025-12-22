
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { WithId } from 'mongodb';
import { useToast } from '@/hooks/use-toast';

import { getProductsForCatalog, deleteProductFromCatalog, listProductSets, createProductSet } from '@/app/actions/catalog.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ChevronLeft, PlusCircle, ShoppingBag, LoaderCircle, Trash2, Edit, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeleteCollectionButton } from '@/components/wabasimplify/delete-collection-button';
import type { ProductSet } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { CreateCollectionDialog } from '@/components/wabasimplify/create-collection-dialog';


const ProductsTable = ({ products, catalogId, onAction }: { products: any[], catalogId: string, onAction: () => void }) => {
    const { toast } = useToast();
    const router = useRouter();

    const handleDeleteProduct = async (productId: string, projectId: string) => {
        const result = await deleteProductFromCatalog(productId, projectId);
        if (result.success) {
            toast({ title: 'Success', description: 'Product deleted successfully.' });
            onAction();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    }

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-20"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Inventory</TableHead>
                        <TableHead>Availability</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.length > 0 ? (
                        products.map(product => (
                            <TableRow key={product.id}>
                                <TableCell>
                                    <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                                        {product.image_url ? 
                                            <Image src={product.image_url} alt={product.name} width={64} height={64} className="object-cover rounded-md" data-ai-hint="product image"/>
                                            : <ShoppingBag className="h-8 w-8 text-muted-foreground"/>
                                        }
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{product.price ? new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currency }).format(product.price / 100) : 'N/A'}</TableCell>
                                <TableCell>{product.inventory?.toLocaleString() || 'N/A'}</TableCell>
                                <TableCell>
                                    <Badge variant={product.availability === 'in_stock' ? 'default' : 'secondary'}>
                                        {product.availability?.replace(/_/g, ' ') || 'N/A'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{product.retailer_id}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" asChild>
                                        <Link href={`/dashboard/catalog/${catalogId}/${product.id}/edit`}><Edit className="h-4 w-4" /></Link>
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the product "{product.name}".</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteProduct(product.id, product.project_id)}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center h-24">No products found in this catalog.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}

const CollectionsTable = ({ collections, projectId, catalogId, onAction }: { collections: ProductSet[], projectId: string, catalogId: string, onAction: () => void }) => {
    return (
        <div className="space-y-4">
             <div className="flex justify-end">
                <CreateCollectionDialog projectId={projectId} catalogId={catalogId} onCollectionCreated={onAction} />
            </div>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Collection Name</TableHead>
                            <TableHead>Product Count</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {collections.length > 0 ? (
                            collections.map(set => (
                                <TableRow key={set.id}>
                                    <TableCell className="font-medium">{set.name}</TableCell>
                                    <TableCell>{set.product_count}</TableCell>
                                    <TableCell className="text-right">
                                        <DeleteCollectionButton setId={set.id} setName={set.name} projectId={projectId} onDeleted={onAction} />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={3} className="text-center h-24">No collections found in this catalog.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

export default function CatalogProductsPage() {
    const params = useParams();
    const catalogId = params.catalogId as string;
    const { activeProjectId } = useProject();
    
    const [products, setProducts] = useState<any[]>([]);
    const [collections, setCollections] = useState<ProductSet[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = useCallback(() => {
        if (activeProjectId && catalogId) {
            startLoading(async () => {
                const [productsData, collectionsData] = await Promise.all([
                    getProductsForCatalog(catalogId, activeProjectId),
                    listProductSets(catalogId, activeProjectId)
                ]);
                setProducts(productsData);
                setCollections(collectionsData);
            });
        }
    }, [activeProjectId, catalogId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    if (isLoading && products.length === 0 && collections.length === 0) {
        return <Skeleton className="h-96 w-full" />;
    }

    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/catalog"><ChevronLeft className="mr-2 h-4 w-4" />Back to Catalogs</Link>
                </Button>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag/> Catalog Management</h1>
                        <p className="text-muted-foreground mt-1">Manage products and collections within your catalog.</p>
                    </div>
                </div>
            </div>
            
            <Tabs defaultValue="products">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="products"><ShoppingBag className="mr-2 h-4 w-4"/>Products</TabsTrigger>
                    <TabsTrigger value="collections"><Package className="mr-2 h-4 w-4"/>Collections</TabsTrigger>
                </TabsList>
                <TabsContent value="products" className="mt-4">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Products</CardTitle>
                                    <CardDescription>A list of products in this catalog.</CardDescription>
                                </div>
                                <Button asChild>
                                    <Link href={`/dashboard/catalog/${catalogId}/new`}>
                                        <PlusCircle className="mr-2 h-4 w-4"/>Add Product
                                    </Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                             {activeProjectId && <ProductsTable products={products} catalogId={catalogId} onAction={fetchData} />}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="collections" className="mt-4">
                    <Card>
                         <CardHeader>
                            <CardTitle>Collections (Product Sets)</CardTitle>
                            <CardDescription>Group products into sets for ads and promotions.</CardDescription>
                         </CardHeader>
                         <CardContent>
                            {activeProjectId && <CollectionsTable collections={collections} projectId={activeProjectId} catalogId={catalogId} onAction={fetchData} />}
                         </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
