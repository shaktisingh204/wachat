import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, Card, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import { Plus } from 'lucide-react';
import { Skeleton } from '@/components/sabcrm/20ui';

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
                        <THead>
                            <Tr>
                                <Th className="w-[36px]"></Th>
                                <Th>GRN #</Th>
                                <Th>Vendor</Th>
                                <Th>PO ref</Th>
                                <Th>Date</Th>
                                <Th>Vehicle</Th>
                                <Th>Driver</Th>
                                <Th>Status</Th>
                                <Th>Linked Bill</Th>
                                <Th className="text-right">Actions</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Tr key={i}>
                                    <Td><Skeleton className="h-4 w-4" /></Td>
                                    <Td><Skeleton className="h-4 w-20" /></Td>
                                    <Td><Skeleton className="h-4 w-24" /></Td>
                                    <Td><Skeleton className="h-4 w-16" /></Td>
                                    <Td><Skeleton className="h-4 w-24" /></Td>
                                    <Td><Skeleton className="h-4 w-16" /></Td>
                                    <Td><Skeleton className="h-4 w-24" /></Td>
                                    <Td><Skeleton className="h-6 w-16 rounded-full" /></Td>
                                    <Td><Skeleton className="h-4 w-16" /></Td>
                                    <Td className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            </div>
        </EntityListShell>
    );
}
