
'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { WithId } from 'mongodb';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';

import { getProductsForCatalog, addProductToCatalog, deleteProductFromCatalog, listProductSets, createProductSet } from '@/app/actions/catalog.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, PlusCircle, ShoppingBag, LoaderCircle, Trash2, Tags, Edit, Package } from 'lucide-react';
import { ViewTaggedMediaDialog } from '@/components/wabasimplify/view-tagged-media-dialog';
import { Badge } from '@/components/ui/badge';
import { EditProductDialog } from '@/components/wabasimplify/edit-product-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeleteCollectionButton } from '@/components/wabasimplify/delete-collection-button';
import type { ProductSet } from '@/lib/definitions';


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

const addCollectionInitialState = { message: null, error: null };

function CollectionSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : 'Create Collection'}
    </Button>
  );
}

function CreateCollectionDialog({ catalogId, projectId, onCollectionCreated }: { catalogId: string, projectId: string, onCollectionCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createProductSet, addCollectionInitialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onCollectionCreated();
    }
    if (state.error) {
      toast({ title: 'Error Creating Collection', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onCollectionCreated]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Collection
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="catalogId" value={catalogId} />
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
            <DialogDescription>
              Create a new product set within this catalog. You can add products later in Commerce Manager.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Collection Name</Label>
              <Input id="name" name="name" placeholder="e.g., Summer Collection" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <CollectionSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ProductsTable = ({ products, projectId, onAction }: { products: any[], projectId: string, onAction: () => void }) => {
    const { toast } = useToast();
    const [viewingProductMedia, setViewingProductMedia] = useState<any | null>(null);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);

    const handleDeleteProduct = async (productId: string) => {
        const result = await deleteProductFromCatalog(productId, projectId);
        if (result.success) {
            toast({ title: 'Success', description: 'Product deleted successfully.' });
            onAction();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    }

    return (
        <>
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
                                        <Button variant="ghost" size="icon" onClick={() => setEditingProduct(product)}>
                                            <Edit className="h-4 w-4" />
                                            <span className="sr-only">Edit Product</span>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setViewingProductMedia(product)}>
                                            <Tags className="h-4 w-4" />
                                            <span className="sr-only">View Tagged Media</span>
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
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
                            <TableRow>
                                <TableCell colSpan={7} className="text-center h-24">No products found in this catalog.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
             {viewingProductMedia && (
                <ViewTaggedMediaDialog
                    isOpen={!!viewingProductMedia}
                    onOpenChange={(open) => !open && setViewingProductMedia(null)}
                    product={viewingProductMedia}
                    projectId={projectId}
                />
            )}
             {editingProduct && (
                <EditProductDialog
                    isOpen={!!editingProduct}
                    onOpenChange={(open) => !open && setEditingProduct(null)}
                    product={editingProduct}
                    projectId={projectId}
                    onProductUpdated={onAction}
                />
            )}
        </>
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
    
    const [products, setProducts] = useState<any[]>([]);
    const [collections, setCollections] = useState<ProductSet[]>([]);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();

    const fetchData = useCallback(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId && catalogId) {
            setProjectId(storedProjectId);
            startLoading(async () => {
                const [productsData, collectionsData] = await Promise.all([
                    getProductsForCatalog(catalogId, storedProjectId),
                    listProductSets(catalogId, storedProjectId)
                ]);
                setProducts(productsData);
                setCollections(collectionsData);
            });
        }
    }, [catalogId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    if (isLoading && products.length === 0 && collections.length === 0) {
        return <Skeleton className="h-96 w-full" />
    }

    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/facebook/commerce/products"><ChevronLeft className="mr-2 h-4 w-4" />Back to Catalogs</Link>
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
                                {projectId && <AddProductDialog catalogId={catalogId} projectId={projectId} onProductAdded={fetchData} />}
                            </div>
                        </CardHeader>
                        <CardContent>
                             {projectId && <ProductsTable products={products} projectId={projectId} onAction={fetchData} />}
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
                            {projectId && <CollectionsTable collections={collections} projectId={projectId} catalogId={catalogId} onAction={fetchData} />}
                         </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
