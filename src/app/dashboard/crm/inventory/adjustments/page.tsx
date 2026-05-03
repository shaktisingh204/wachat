import { Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { getCrmStockAdjustments } from "@/app/actions/crm-inventory.actions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
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
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Adjustment
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Product</TableHead>
                                <TableHead className="text-muted-foreground">Warehouse</TableHead>
                                <TableHead className="text-muted-foreground">Reason</TableHead>
                                <TableHead className="text-muted-foreground text-right">Quantity</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {adjustments.length === 0 ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No adjustments found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                adjustments.map((adj) => (
                                    <TableRow key={adj._id.toString()} className="border-border">
                                        <TableCell className="text-foreground">
                                            {format(new Date(adj.date), 'dd MMM yyyy')}
                                        </TableCell>
                                        <TableCell className="font-medium text-foreground">
                                            {(adj as any).productName || 'Unknown Product'}
                                        </TableCell>
                                        <TableCell className="text-foreground">
                                            {(adj as any).warehouseName || 'Unknown Warehouse'}
                                        </TableCell>
                                        <TableCell>
                                            <ClayBadge tone="neutral">{adj.reason}</ClayBadge>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${adj.quantity > 0 ? "text-emerald-500" : "text-destructive"}`}>
                                            {adj.quantity > 0 ? "+" : ""}{adj.quantity}
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
