export const dynamic = 'force-dynamic';

import { Button } from "@/components/ui/button";
import { Plus, Search, Package } from "lucide-react";
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

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function InventoryItemsPage(
    props: {
        searchParams: Promise<{ query?: string; page?: string }>;
    }
) {
    const searchParams = await props.searchParams;
    const query = searchParams?.query || '';
    const currentPage = Number(searchParams?.page) || 1;

    const { products } = await getCrmProducts(currentPage, 20, query);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Inventory Items"
                subtitle="Manage your products and stock levels."
                icon={Package}
                actions={
                    <Link href="/dashboard/crm/inventory/items/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            Add Item
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4 relative max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search items..."
                        className="h-10 rounded-lg border-border bg-card pl-9 text-[13px]"
                        defaultValue={query}
                    />
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground w-[80px]">Image</TableHead>
                                <TableHead className="text-muted-foreground">Name</TableHead>
                                <TableHead className="text-muted-foreground">SKU</TableHead>
                                <TableHead className="text-muted-foreground">Price</TableHead>
                                <TableHead className="text-muted-foreground">Stock</TableHead>
                                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {products.length === 0 ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No items found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                products.map((product) => (
                                    <TableRow key={product._id.toString()} className="border-border">
                                        <TableCell>
                                            <Avatar className="h-10 w-10 rounded-sm">
                                                <AvatarImage src={product.images?.[0] || (product as any).imageUrl} alt={product.name} />
                                                <AvatarFallback className="rounded-sm bg-accent text-accent-foreground">{product.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span className="text-foreground">{product.name}</span>
                                                {product.itemType && <span className="text-[11.5px] text-muted-foreground capitalize">{product.itemType}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-foreground">{product.sku || '-'}</TableCell>
                                        <TableCell className="text-foreground">
                                            {product.currency} {product.sellingPrice}
                                        </TableCell>
                                        <TableCell>
                                            {product.isTrackInventory ? (
                                                <span className={product.totalStock <= 5 ? "text-destructive font-medium" : "text-foreground"}>
                                                    {product.totalStock}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-[12.5px]">N/A</span>
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
            </ClayCard>
        </div>
    );
}
