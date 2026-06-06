import { Suspense } from 'react';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { crmAwardProgramsApi } from '@/lib/rust-client/crm-awards';
import { StatCard } from '@/components/sabcrm/20ui/compat';
import { Skeleton } from '@/components/sabcrm/20ui/compat';
import { Award, Trophy, Users, Star } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

async function AwardSummaryMetrics({ id }: { id: string }) {
    try {
        const award = await crmAwardProgramsApi.getById(id);
        if (!award) return null;

        const totalNominations = award.nominations?.length || 0;
        const totalWinners = award.winners?.length || 0;
        const totalValue = award.cashValue || award.pointsValue || 0;
        const valueLabel = award.cashValue ? 'Cash Value' : (award.pointsValue ? 'Points Value' : 'Value');

        return (
            <div className="mb-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Status"
                    value={<span className="capitalize">{award.status}</span>}
                    icon={<Award className="h-4 w-4" />}
                />
                <StatCard
                    label="Nominations"
                    value={totalNominations}
                    icon={<Users className="h-4 w-4" />}
                />
                <StatCard
                    label="Winners"
                    value={totalWinners}
                    icon={<Trophy className="h-4 w-4" />}
                />
                <StatCard
                    label={valueLabel}
                    value={totalValue}
                    icon={<Star className="h-4 w-4" />}
                />
            </div>
        );
    } catch (error) {
        console.error("Failed to load award metrics:", error);
        return null;
    }
}

function MetricsSkeleton() {
    return (
        <div className="mb-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[var(--st-border)] bg-white p-6 shadow-sm dark:border-[var(--st-border)] dark:bg-[var(--st-text)]">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                    <Skeleton className="mt-4 h-8 w-16" />
                </div>
            ))}
        </div>
    );
}

function TimelineSkeleton() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardBody>
                <div className="space-y-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-1" />
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-16 rounded-full" />
                                </div>
                                <Skeleton className="h-3 w-1/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardBody>
        </Card>
    );
}

export default async function AwardActivityPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="p-4 md:p-6 w-full space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-[var(--st-text)]">Award Overview & Activity</h1>
                    <p className="text-sm text-[var(--st-text-secondary)]">Key metrics and recent audit history for this award program.</p>
                </div>
            </div>

            <Suspense fallback={<MetricsSkeleton />}>
                <AwardSummaryMetrics id={id} />
            </Suspense>

            <Suspense fallback={<TimelineSkeleton />}>
                <EntityAuditTimeline entityKind="award" entityId={id} />
            </Suspense>
        </div>
    );
}
