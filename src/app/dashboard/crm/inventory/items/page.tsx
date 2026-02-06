export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { getCrmProducts, deleteCrmProduct } from "@/app/actions/crm-products.actions";
import { DeleteButton } from "@/components/wabasimplify/delete-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function InventoryItemsPage({
    searchParams,
}: {
    searchParams: { query?: string; page?: string };
}) {
    const query = searchParams?.query || '';
    const currentPage = Number(searchParams?.page) || 1;

    // Note: getCrmProducts expects generic args (page, limit, query)
    const { products, total } = await getCrmProducts(currentPage, 20, query);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
                    <p className="text-muted-foreground">Manage your products and stock levels.</p>
                </div>
                <Link href="/dashboard/crm/inventory/items/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Item
                    </Button>
                </Link>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search items..." className="pl-8" defaultValue={query} />
                    {/* Implementation note: Proper search requires client component or form submission */}
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Image</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            products.map((product) => (
                                <TableRow key={product._id.toString()}>
                                    <TableCell>
                                        <Avatar className="h-10 w-10 rounded-sm">
                                            {/* Handle legacy imageUrl or new images array */}
                                            <AvatarImage src={product.images?.[0] || (product as any).imageUrl} alt={product.name} />
                                            <AvatarFallback className="rounded-sm">{product.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{product.name}</span>
                                            {product.itemType && <span className="text-xs text-muted-foreground capitalize">{product.itemType}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>{product.sku || '-'}</TableCell>
                                    <TableCell>
                                        {product.currency} {product.sellingPrice}
                                    </TableCell>
                                    <TableCell>
                                        {product.isTrackInventory ? (
                                            /* Simple check for total stock vs 0 if reorderPoint logic is complex to display per warehouse here */
                                            <span className={product.totalStock <= 5 ? "text-red-500 font-medium" : ""}>
                                                {product.totalStock}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">N/A</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link href={`/dashboard/crm/inventory/items/${product._id}/edit`}>
                                                <Button variant="ghost" size="sm">Edit</Button>
                                            </Link>
                                            <DeleteButton
                                                id={product._id.toString()}
                                                action={deleteCrmProduct}
                                                resourceName="Product"
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            {/* Pagination Implementation needed here */}
        </div>
    );
}
