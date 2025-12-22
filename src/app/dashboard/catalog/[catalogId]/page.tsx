
'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { WithId } from 'mongodb';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';

import { getProductsForCatalog, addProductToCatalog, deleteProductFromCatalog } from '@/app/actions/catalog.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, PlusCircle, ShoppingBag, LoaderCircle, Trash2, Edit } from 'lucide-react';
import { useProject } from '@/context/project-context';

const addProductInitialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : null}
            Add Product
        </Button>
    )
}

function AddProductDialog({ catalogId, projectId, onProductAdded }: { catalogId: string, projectId: string, onProductAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [state, formAction] = useActionState(addProductToCatalog, addProductInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            setOpen(false);
            onProductAdded();
        }
        if (state.error) {
            toast({ title: 'Error Creating Product', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onProductAdded]);
    
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/>Add Product</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="catalogId" value={catalogId} />
                    <DialogHeader>
                        <DialogTitle>Add New Product</DialogTitle>
                        <DialogDescription>Enter the details for your new product. This will add it to your Meta catalog.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2"><Label htmlFor="name">Product Name</Label><Input id="name" name="name" required /></div>
                        <div className="space-y-2"><Label htmlFor="retailer_id">SKU / Retailer ID</Label><Input id="retailer_id" name="retailer_id" required /></div>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2"><Label htmlFor="price">Price</Label><Input id="price" name="price" type="number" step="0.01" required /></div>
                             <div className="space-y-2"><Label htmlFor="currency">Currency</Label><Select name="currency" defaultValue="USD" required><SelectTrigger id="currency"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="INR">INR</SelectItem></SelectContent></Select></div>
                        </div>
                        <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" /></div>
                        <div className="space-y-2"><Label htmlFor="image_url">Image URL</Label><Input id="image_url" name="image_url" type="url" required /></div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function CatalogProductsPage() {
    const params = useParams();
    const catalogId = params.catalogId as string;
    const { activeProjectId } = useProject();
    
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, startLoading] = useTransition();
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        if (activeProjectId && catalogId) {
            startLoading(async () => {
                const productsData = await getProductsForCatalog(catalogId, activeProjectId);
                setProducts(productsData);
            });
        }
    }, [activeProjectId, catalogId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const handleDeleteProduct = async (productId: string) => {
        if (!activeProjectId) return;
        const result = await deleteProductFromCatalog(productId, activeProjectId);
        if (result.success) {
            toast({ title: 'Success', description: 'Product deleted successfully.' });
            fetchData();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    }

    if (isLoading && products.length === 0) {
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
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><ShoppingBag/> Catalog Products</h1>
                        <p className="text-muted-foreground mt-1">Manage products within your catalog.</p>
                    </div>
                    {activeProjectId && <AddProductDialog catalogId={catalogId} projectId={activeProjectId} onProductAdded={fetchData} />}
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Products</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-20"></TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Price</TableHead>
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
                                                        <Image src={product.image_url} alt={product.name} width={64} height={64} className="object-cover rounded-md" data-ai-hint="product photo"/>
                                                        : <ShoppingBag className="h-8 w-8 text-muted-foreground"/>
                                                    }
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell>{new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currency }).format(product.price / 100)}</TableCell>
                                            <TableCell>{product.availability?.replace(/_/g, ' ') || 'N/A'}</TableCell>
                                            <TableCell className="font-mono text-xs">{product.retailer_id}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" disabled><Edit className="h-4 w-4"/></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the product "{product.name}".</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteProduct(product.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={6} className="text-center h-24">No products found in this catalog.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
