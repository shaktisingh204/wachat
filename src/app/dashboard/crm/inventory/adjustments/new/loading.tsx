import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityFormShell } from '@/components/crm/entity-form-shell';

export default function AdjustmentNewLoading() {
    return (
        <EntityFormShell
            title="New Stock Adjustment"
            subtitle="Record an inventory correction. Approval workflow tracked separately."
            action={async () => {}}
            cancelHref="/dashboard/crm/inventory/adjustments"
            submitLabel="Create adjustment"
            sections={[
                {
                    id: 'header',
                    title: 'Header',
                    description: 'Date, warehouse, reason, and an optional reference doc.',
                    children: (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-12 mb-2" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-20 mb-2" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-16 mb-2" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div className="space-y-1">
                                <Skeleton className="h-4 w-24 mb-2" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'lines',
                    title: 'Line items',
                    description: 'Add one row per item. Delta is qtyAfter − qtyBefore.',
                    children: (
                        <div className="space-y-4">
                            <Skeleton className="h-[200px] w-full rounded-md" />
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                        </div>
                    ),
                },
            ]}
        />
    );
}
