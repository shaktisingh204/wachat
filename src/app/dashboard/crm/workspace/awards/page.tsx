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
import { Card, Skeleton } from '@/components/zoruui';

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
            <div className="flex items-center justify-between p-4 border border-zoru-line rounded-[var(--zoru-radius-xl)] bg-zoru-bg">
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
                <Skeleton className="h-24 w-full rounded-[var(--zoru-radius-xl)]" />
                <Skeleton className="h-24 w-full rounded-[var(--zoru-radius-xl)]" />
                <Skeleton className="h-24 w-full rounded-[var(--zoru-radius-xl)]" />
                <Skeleton className="h-24 w-full rounded-[var(--zoru-radius-xl)]" />
            </div>
            
            <Skeleton className="h-[400px] w-full rounded-[var(--zoru-radius-xl)]" />
        </div>
    );
}

export default function AwardsPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="flex items-center gap-4 p-4 hover:border-blue-500 transition-colors cursor-pointer" role="button">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                        <Trophy className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-medium text-zoru-ink">Top Performers</h3>
                        <p className="text-sm text-zoru-ink-muted">View this month's stars</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4 p-4 hover:border-green-500 transition-colors cursor-pointer" role="button">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300">
                        <Medal className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="font-medium text-zoru-ink">Recent Badges</h3>
                        <p className="text-sm text-zoru-ink-muted">Latest granted awards</p>
                    </div>
                </Card>
                <Link href="/dashboard/crm/workspace/awards/appreciations" className="block">
                    <Card className="flex items-center gap-4 p-4 hover:border-purple-500 transition-colors h-full cursor-pointer">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
                            <Heart className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-medium text-zoru-ink">Give Kudos</h3>
                            <p className="text-sm text-zoru-ink-muted">Appreciate a colleague</p>
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
