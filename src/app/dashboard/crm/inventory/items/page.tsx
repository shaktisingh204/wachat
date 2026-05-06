import { ZoruAvatar, ZoruAvatarFallback, ZoruAvatarImage, ZoruButton, ZoruCard, ZoruInput, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { Plus, Search, Package } from "lucide-react";
import Link from "next/link";

import { getCrmProducts, deleteCrmProduct } from "@/app/actions/crm-products.actions";
import { DeleteButton } from "@/components/wabasimplify/delete-button";

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
                        <ZoruButton>
                            Add Item
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard>
                <div className="mb-4 relative max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <ZoruInput
                        placeholder="Search items..."
                        className="h-10 rounded-lg border-border bg-card pl-9 text-[13px]"
                        defaultValue={query}
                    />
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground w-[80px]">Image</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Name</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">SKU</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Price</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Stock</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {products.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No items found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                products.map((product) => (
                                    <ZoruTableRow key={product._id.toString()} className="border-border">
                                        <ZoruTableCell>
                                            <ZoruAvatar className="h-10 w-10 rounded-sm">
                                                <ZoruAvatarImage src={product.images?.[0] || (product as any).imageUrl} alt={product.name} />
                                                <ZoruAvatarFallback className="rounded-sm bg-accent text-accent-foreground">{product.name.charAt(0)}</ZoruAvatarFallback>
                                            </ZoruAvatar>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span className="text-foreground">{product.name}</span>
                                                {product.itemType && <span className="text-[11.5px] text-muted-foreground capitalize">{product.itemType}</span>}
                                            </div>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{product.sku || '-'}</ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {product.currency} {product.sellingPrice}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {product.isTrackInventory ? (
                                                <span className={product.totalStock <= 5 ? "text-destructive font-medium" : "text-foreground"}>
                                                    {product.totalStock}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-[12.5px]">N/A</span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/dashboard/crm/inventory/items/${product._id}/edit`}>
                                                    <ZoruButton variant="ghost" size="sm">Edit</ZoruButton>
                                                </Link>
                                                <DeleteButton
                                                    id={product._id.toString()}
                                                    action={deleteCrmProduct}
                                                    resourceName="Product"
                                                />
                                            </div>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
