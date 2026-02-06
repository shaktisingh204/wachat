export const dynamic = 'force-dynamic';

import { Button } from "@/components/ui/button";
import { Plus, Search, MapPin } from "lucide-react";
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
import { getCrmWarehouses, deleteCrmWarehouse } from "@/app/actions/crm-warehouses.actions";
import { DeleteButton } from "@/components/wabasimplify/delete-button";
import { Badge } from "@/components/ui/badge";

export default async function WarehousesPage() {
    // Note: getCrmWarehouses currently fetches all (no pagination yet in action but structured for it)
    const warehouses = await getCrmWarehouses();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Warehouses</h1>
                    <p className="text-muted-foreground">Manage your storage locations.</p>
                </div>
                {/* 
                  Since we have 'AddWarehouseDialog' for inline creation, we could reuse it here as a main button 
                  OR have a separate /new page.
                  For simplicity given the tool constraints, I'll use a /new page to keep patterns consistent with Items.
                  OR I can just wrap the dialog in a client component "AddWarehouseButton".
                  Let's stick to /new page for full consistency.
                */}
                <Link href="/dashboard/crm/inventory/warehouses/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Warehouse
                    </Button>
                </Link>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {warehouses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    No warehouses found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            warehouses.map((warehouse) => (
                                <TableRow key={warehouse._id.toString()}>
                                    <TableCell className="font-medium">
                                        {warehouse.name}
                                        {warehouse.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center text-muted-foreground">
                                            <MapPin className="mr-1 h-3 w-3" />
                                            {warehouse.address || (warehouse as any).location || '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">Active</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link href={`/dashboard/crm/inventory/warehouses/${warehouse._id}/edit`}>
                                                <Button variant="ghost" size="sm">Edit</Button>
                                            </Link>
                                            <DeleteButton
                                                id={warehouse._id.toString()}
                                                action={deleteCrmWarehouse}
                                                resourceName="Warehouse"
                                                disabled={warehouse.isDefault}
                                            />
                                        </div>
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
