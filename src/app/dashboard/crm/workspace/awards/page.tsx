import { Suspense } from 'react';
import Link from 'next/link';
import { Heart, Trophy, Medal } from 'lucide-react';
import {
    getAwards,
    getAppreciations,
    getAwardKpis,
} from '@/app/actions/worksuite/knowledge.actions';
import { AwardsListClient } from './_components/awards-list-client';
import type { WsAward, WsAppreciation } from '@/lib/worksuite/knowledge-types';
import { Card, Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

async function AwardsView() {
    const [awards, appreciations, kpis] = await Promise.all([
        getAwards(),
        getAppreciations(),
        getAwardKpis(),
    ]);

    // hrList + serialize() converts _id from ObjectId to string at runtime.
    const aw = awards as unknown as (WsAward & { _id: string })[];
    const ap = appreciations as unknown as (WsAppreciation & { _id: string })[];

    return (
        <AwardsListClient
            initialAwards={aw}
            initialAppreciations={ap}
            initialKpis={kpis}
        />
    );
}

function AwardsSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between p-4 border border-[var(--st-border)] rounded-[var(--st-radius-lg)] bg-[var(--st-bg)]">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Skeleton className="h-24 w-full rounded-[var(--st-radius-lg)]" />
                <Skeleton className="h-24 w-full rounded-[var(--st-radius-lg)]" />
                <Skeleton className="h-24 w-full rounded-[var(--st-radius-lg)]" />
                <Skeleton className="h-24 w-full rounded-[var(--st-radius-lg)]" />
            </div>
            
            <Skeleton className="h-[400px] w-full rounded-[var(--st-radius-lg)]" />
        </div>
    );
}

export default function AwardsPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="flex items-center gap-4 p-4 hover:border-[var(--st-border)] transition-colors cursor-pointer" role="button">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                        <Trophy className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-medium text-[var(--st-text)]">Top Performers</h3>
                        <p className="text-sm text-[var(--st-text-secondary)]">View this month's stars</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4 p-4 hover:border-[var(--st-border)] transition-colors cursor-pointer" role="button">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                        <Medal className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-medium text-[var(--st-text)]">Recent Badges</h3>
                        <p className="text-sm text-[var(--st-text-secondary)]">Latest granted awards</p>
                    </div>
                </Card>
                <Link href="/dashboard/crm/workspace/awards/appreciations" className="block">
                    <Card className="flex items-center gap-4 p-4 hover:border-[var(--st-border)] transition-colors h-full cursor-pointer">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                            <Heart className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-medium text-[var(--st-text)]">Give Kudos</h3>
                            <p className="text-sm text-[var(--st-text-secondary)]">Appreciate a colleague</p>
                        </div>
                    </Card>
                </Link>
            </div>

            <Suspense fallback={<AwardsSkeleton />}>
                <AwardsView />
            </Suspense>
        </div>
    );
}
