import { Skeleton, Card } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function VoucherBookLoading() {
    return (
        <EntityDetailShell
            back={{ href: '/dashboard/crm/accounting/vouchers', label: 'Back to Voucher Books' }}
            eyebrow="VOUCHER BOOK"
            title="Loading..."
            status={{
                label: 'Loading',
                tone: 'neutral',
            }}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-24" />
                </div>
            }
            rightRail={
                <div className="flex flex-col gap-4">
                    <Card className="p-4">
                        <Skeleton className="h-4 w-24 mb-4" />
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                    </Card>
                    <Card className="p-4">
                        <Skeleton className="h-4 w-24 mb-4" />
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                    </Card>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-3">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-6 w-16" />
                        </div>
                        <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-3">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-6 w-16" />
                        </div>
                        <div className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-3">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-6 w-16" />
                        </div>
                    </div>
                </Card>
                <Card className="p-0">
                    <div className="px-4 py-3">
                        <Skeleton className="h-5 w-32 mb-1" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <div className="overflow-x-auto border-t border-zoru-line p-4">
                        <div className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>
                </Card>
            </div>
        </EntityDetailShell>
    );
}
