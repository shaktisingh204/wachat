import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default async function StockAdjustmentsPage() {
    const adjustments = await getCrmStockAdjustments();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Stock Adjustments</h1>
                    <p className="text-muted-foreground">History of stock changes and movements.</p>
                </div>
                <Link href="/dashboard/crm/inventory/adjustments/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Adjustment
                    </Button>
                </Link>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Warehouse</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {adjustments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No adjustments found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            adjustments.map((adj) => (
                                <TableRow key={adj._id.toString()}>
                                    <TableCell>
                                        {format(new Date(adj.date), 'dd MMM yyyy')}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {(adj as any).productName || 'Unknown Product'}
                                    </TableCell>
                                    <TableCell>
                                        {(adj as any).warehouseName || 'Unknown Warehouse'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{adj.reason}</Badge>
                                    </TableCell>
                                    <TableCell className={`text-right font-medium ${adj.quantity > 0 ? "text-green-600" : "text-red-600"}`}>
                                        {adj.quantity > 0 ? "+" : ""}{adj.quantity}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
