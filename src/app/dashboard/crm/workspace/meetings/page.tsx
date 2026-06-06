import { Suspense } from 'react';
import { getMeetingSchedulers } from '@/app/actions/crm-advanced/meeting-scheduler';
import { MeetingsListClient } from './_components/meetings-list-client';
import { Card, Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

function MeetingsSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-32" />
            </div>
            <Card className="p-6">
                <div className="space-y-4">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-5/6" />
                    <Skeleton className="h-6 w-4/6" />
                </div>
            </Card>
        </div>
    );
}

async function MeetingsListContainer() {
    const res = await getMeetingSchedulers();
    const meetings = res.success ? res.data : [];

    return <MeetingsListClient initialMeetings={meetings} />;
}

export default function WorkspaceMeetingsPage() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <Suspense fallback={<MeetingsSkeleton />}>
                <MeetingsListContainer />
            </Suspense>
        </div>
    );
}
