import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Table, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import { Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function GrnLoading() {
    return (
        <EntityListShell
            title="Goods Receipt (GRN)"
            subtitle="Record incoming stock against purchase orders and reconcile quantities."
            primaryAction={
                <Button disabled>
                    <Plus className="h-4 w-4 mr-2" />
                    New GRN
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                {/* KPI Strip Skeleton */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="p-4 flex flex-col gap-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-16" />
                        </Card>
                    ))}
                </div>

                {/* Table Skeleton */}
                <Card className="overflow-hidden p-0">
                    <div className="p-4 border-b">
                        <Skeleton className="h-9 w-[250px]" />
                    </div>
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow>
                                <ZoruTableHead className="w-[36px]"></ZoruTableHead>
                                <ZoruTableHead>GRN #</ZoruTableHead>
                                <ZoruTableHead>Vendor</ZoruTableHead>
                                <ZoruTableHead>PO ref</ZoruTableHead>
                                <ZoruTableHead>Date</ZoruTableHead>
                                <ZoruTableHead>Vehicle</ZoruTableHead>
                                <ZoruTableHead>Driver</ZoruTableHead>
                                <ZoruTableHead>Status</ZoruTableHead>
                                <ZoruTableHead>Linked Bill</ZoruTableHead>
                                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <ZoruTableRow key={i}>
                                    <ZoruTableCell><Skeleton className="h-4 w-4" /></ZoruTableCell>
                                    <ZoruTableCell><Skeleton className="h-4 w-20" /></ZoruTableCell>
                                    <ZoruTableCell><Skeleton className="h-4 w-24" /></ZoruTableCell>
                                    <ZoruTableCell><Skeleton className="h-4 w-16" /></ZoruTableCell>
                                    <ZoruTableCell><Skeleton className="h-4 w-24" /></ZoruTableCell>
                                    <ZoruTableCell><Skeleton className="h-4 w-16" /></ZoruTableCell>
                                    <ZoruTableCell><Skeleton className="h-4 w-24" /></ZoruTableCell>
                                    <ZoruTableCell><Skeleton className="h-6 w-16 rounded-full" /></ZoruTableCell>
                                    <ZoruTableCell><Skeleton className="h-4 w-16" /></ZoruTableCell>
                                    <ZoruTableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </Table>
                </Card>
            </div>
        </EntityListShell>
    );
}
