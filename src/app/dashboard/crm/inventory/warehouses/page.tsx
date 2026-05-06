import { ZoruBadge, ZoruButton, ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { Plus, MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import Link from "next/link";

import { getCrmWarehouses, deleteCrmWarehouse } from "@/app/actions/crm-warehouses.actions";
import { DeleteButton } from "@/components/wabasimplify/delete-button";

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
                        <ZoruButton>
                            Add Warehouse
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Name</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Location</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {warehouses.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No warehouses found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                warehouses.map((warehouse) => (
                                    <ZoruTableRow key={warehouse._id.toString()} className="border-border">
                                        <ZoruTableCell className="font-medium">
                                            <span className="text-foreground">{warehouse.name}</span>
                                            {warehouse.isDefault && <ZoruBadge variant="ghost" className="ml-2">Default</ZoruBadge>}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <div className="flex items-center text-muted-foreground">
                                                <MapPin className="mr-1 h-3 w-3" />
                                                {warehouse.address || (warehouse as any).location || '-'}
                                            </div>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruBadge variant="success">Active</ZoruBadge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/dashboard/crm/inventory/warehouses/${warehouse._id}/edit`}>
                                                    <ZoruButton variant="ghost" size="sm">Edit</ZoruButton>
                                                </Link>
                                                <DeleteButton
                                                    id={warehouse._id.toString()}
                                                    action={deleteCrmWarehouse}
                                                    resourceName="Warehouse"
                                                    disabled={warehouse.isDefault}
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
