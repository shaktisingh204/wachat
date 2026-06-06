import React from 'react';
import Link from 'next/link';
import { ArrowLeft, MonitorPlay, Clapperboard } from 'lucide-react';

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

import { getPagesenseSite, getRecording } from '@/app/actions/sabsense.actions';

import { PagesenseSiteNav } from '../../_site-nav';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ siteId: string; recordingId: string }>;
}

export default async function RecordingDetailPage({ params }: PageProps) {
    const { siteId, recordingId } = await params;
    const [site, recording] = await Promise.all([
        getPagesenseSite(siteId),
        getRecording(recordingId),
    ]);

    if (!site || !recording) {
        return (
            <div className="ui20 p-8">
                <EmptyState
                    icon={Clapperboard}
                    title="Recording not found"
                    description="This session recording does not exist or is no longer available."
                />
            </div>
        );
    }

    return (
        <div className="ui20 p-8 space-y-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Session recording</PageTitle>
                    <PageDescription>
                        {recording.urlPath}
                        {', '}
                        {new Date(recording.startedAt).toLocaleString()}
                        {', '}
                        {recording.durationSecs}s
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            <Card>
                <CardHeader>
                    <CardTitle>Player</CardTitle>
                    <CardDescription>
                        rrweb integration is TODO. The recorder snippet currently
                        captures pointer/scroll events. Once the rrweb finalizer
                        worker writes an event blob to SabFiles, this container
                        will become the actual player.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <div
                        className="flex h-[480px] items-center justify-center rounded-[var(--st-radius)] border border-dashed border-[color:var(--st-border)] bg-[color:var(--st-bg-muted)]"
                        data-rrweb-player-container
                        data-events-file-id={recording.eventsFileId || ''}
                    >
                        <EmptyState
                            icon={MonitorPlay}
                            title={
                                recording.eventsFileId
                                    ? 'rrweb player stub'
                                    : 'No event blob yet'
                            }
                            description={
                                recording.eventsFileId
                                    ? `eventsFileId: ${recording.eventsFileId}`
                                    : 'No rrweb event blob has been written for this session.'
                            }
                        />
                    </div>
                </CardBody>
            </Card>

            <div>
                <Link href={`/dashboard/pagesense/${site._id}/recordings`}>
                    <Button variant="ghost" iconLeft={ArrowLeft}>
                        Back to recordings
                    </Button>
                </Link>
            </div>
        </div>
    );
}
