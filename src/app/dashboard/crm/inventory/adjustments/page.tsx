import { ZoruBadge, ZoruButton, ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import { Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { getCrmStockAdjustments } from "@/app/actions/crm-inventory.actions";

import { format } from "date-fns";

import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function StockAdjustmentsPage() {
    const adjustments = await getCrmStockAdjustments();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Stock Adjustments"
                subtitle="History of stock changes and movements."
                icon={SlidersHorizontal}
                actions={
                    <Link href="/dashboard/crm/inventory/adjustments/new">
                        <ZoruButton>
                            New Adjustment
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Product</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Warehouse</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reason</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Quantity</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {adjustments.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No adjustments found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                adjustments.map((adj) => (
                                    <ZoruTableRow key={adj._id.toString()} className="border-border">
                                        <ZoruTableCell className="text-foreground">
                                            {format(new Date(adj.date), 'dd MMM yyyy')}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-foreground">
                                            {(adj as any).productName || 'Unknown Product'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {(adj as any).warehouseName || 'Unknown Warehouse'}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruBadge variant="ghost">{adj.reason}</ZoruBadge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className={`text-right font-medium ${adj.quantity > 0 ? "text-emerald-500" : "text-destructive"}`}>
                                            {adj.quantity > 0 ? "+" : ""}{adj.quantity}
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
