export const dynamic = 'force-dynamic';

import { Button } from "@/components/ui/button";
import { Plus, MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import Link from "next/link";
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

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function WarehousesPage() {
    const warehouses = await getCrmWarehouses();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Warehouses"
                subtitle="Manage your storage locations."
                icon={WarehouseIcon}
                actions={
                    <Link href="/dashboard/crm/inventory/warehouses/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            Add Warehouse
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Name</TableHead>
                                <TableHead className="text-muted-foreground">Location</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {warehouses.length === 0 ? (
                                <TableRow className="border-border">
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No warehouses found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                warehouses.map((warehouse) => (
                                    <TableRow key={warehouse._id.toString()} className="border-border">
                                        <TableCell className="font-medium">
                                            <span className="text-foreground">{warehouse.name}</span>
                                            {warehouse.isDefault && <ClayBadge tone="rose-soft" className="ml-2">Default</ClayBadge>}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center text-muted-foreground">
                                                <MapPin className="mr-1 h-3 w-3" />
                                                {warehouse.address || (warehouse as any).location || '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <ClayBadge tone="green">Active</ClayBadge>
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
            </ClayCard>
        </div>
    );
}
