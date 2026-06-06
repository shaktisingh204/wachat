import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/sabcrm/20ui';

export default function InventoryItemDetailLoading() {
    return (
        <EntityDetailShell
            eyebrow="INVENTORY ITEM"
            title="Loading item..."
            back={{ href: '/dashboard/crm/inventory/items', label: 'Back to all items' }}
        >
            <Card>
                <CardHeader>
                    <CardTitle>
                        <Skeleton className="h-4 w-32" />
                    </CardTitle>
                </CardHeader>
                <CardBody>
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i}>
                                <dt className="mb-1">
                                    <Skeleton className="h-3 w-16" />
                                </dt>
                                <dd>
                                    <Skeleton className="h-4 w-32" />
                                </dd>
                            </div>
                        ))}
                    </dl>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>
                        <Skeleton className="h-4 w-32" />
                    </CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                    <div className="p-4">
                        <Skeleton className="mb-4 h-8 w-full" />
                        <Skeleton className="mb-2 h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                </CardBody>
            </Card>
        </EntityDetailShell>
    );
}
