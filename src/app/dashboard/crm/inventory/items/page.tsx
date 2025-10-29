
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, ShoppingBag, Package, Search, Settings, Edit } from 'lucide-react';
import { getCrmProducts } from '@/app/actions/crm-products.actions';
import type { WithId, EcommProduct, User, Plan } from '@/lib/definitions';
import { getSession } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><Skeleton className="h-10 w-64" /><Skeleton className="h-10 w-32" /></div>
            <Skeleton className="h-4 w-96"/>
            <div className="border rounded-md">
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    );
}

const getStockStatus = (stock?: number) => {
    if (stock === undefined || stock === null) {
        return <Badge variant="secondary">N/A</Badge>;
    }
    if (stock <= 0) {
        return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (stock <= 10) { 
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Low Stock</Badge>;
    }
    return <Badge variant="default">In Stock</Badge>;
};

export default function AllItemsPage() {
    const [user, setUser] = useState<(Omit<User, 'password'> & { _id: string, plan?: WithId<Plan> | null }) | null>(null);
    const [products, setProducts] = useState<WithId<EcommProduct>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const [sessionData, productsData] = await Promise.all([
                getSession(),
                getCrmProducts()
            ]);
            setUser(sessionData?.user as any);
            setProducts(productsData);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (!user) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Not Logged In</AlertTitle>
                <AlertDescription>Please log in to manage your inventory.</AlertDescription>
            </Alert>
        );
    }

    if (products.length === 0 && !isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Card className="text-center max-w-2xl">
                    <CardHeader>
                        <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                             <Package className="h-12 w-12 text-primary" />
                        </div>
                        <CardTitle className="mt-4 text-2xl">Your Inventory is Empty</CardTitle>
                        <CardDescription>
                            Add products to start tracking stock, manage suppliers, and streamline your sales process.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button asChild>
                            <Link href="/dashboard/crm/inventory/items/new">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Your First Item
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    const currency = user?.plan?.currency || 'USD';

    return (
        <div className="flex flex-col gap-8">
             <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Package /> All Items</h1>
                    <p className="text-muted-foreground">A comprehensive view of all your inventory items.</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="outline"><Settings className="mr-2 h-4 w-4"/>Item Preferences</Button>
                    <Button asChild>
                        <Link href="/dashboard/crm/inventory/items/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Item
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search items..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            
             <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-20">Image</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Selling Price</TableHead>
                            <TableHead className="text-right">Total Stock</TableHead>
                            <TableHead>Stock Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.map(product => (
                            <TableRow key={product._id.toString()}>
                                <TableCell>
                                    <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                                        {product.imageUrl ? 
                                            <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="object-cover rounded-md" data-ai-hint="product photo"/>
                                            : <Package className="h-8 w-8 text-muted-foreground"/>
                                        }
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell className="font-mono text-xs">{product.sku || 'N/A'}</TableCell>
                                <TableCell className="text-right font-mono">{new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(product.price)}</TableCell>
                                <TableCell className="text-right font-medium">
                                    {product.inventory?.reduce((sum, inv) => sum + inv.stock, 0) ?? product.stock ?? 0}
                                </TableCell>
                                <TableCell>
                                    {getStockStatus(product.inventory?.reduce((sum, inv) => sum + inv.stock, 0) ?? product.stock)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="ghost" size="icon">
                                        <Link href={`/dashboard/crm/inventory/items/${product._id.toString()}/edit`}>
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
        </div>
    );
}
