import React from 'react';
import Link from 'next/link';

import { Button, Card, CardBody, CardHeader, CardTitle, CardDescription, PageHeader, PageTitle, PageDescription } from '@/components/sabcrm/20ui';

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
            <div className="zoruui p-8 text-sm text-[color:var(--st-text-secondary)]">
                Recording not found.
            </div>
        );
    }

    return (
        <div className="zoruui p-8 space-y-6">
            <PageHeader>
                <PageTitle>Session recording</PageTitle>
                <PageDescription>
                    {recording.urlPath} ·{' '}
                    {new Date(recording.startedAt).toLocaleString()} ·{' '}
                    {recording.durationSecs}s
                </PageDescription>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            <Card>
                <CardHeader>
                    <CardTitle>Player</CardTitle>
                    <CardDescription>
                        rrweb integration is TODO. The recorder snippet currently
                        captures pointer/scroll events; once the rrweb finalizer
                        worker writes an event blob to SabFiles, this container
                        will become the actual player.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <div
                        className="flex h-[480px] items-center justify-center rounded-md border border-dashed border-[color:var(--st-border)] bg-[color:var(--st-bg-muted)] text-sm text-[color:var(--st-text-secondary)]"
                        data-rrweb-player-container
                        data-events-file-id={recording.eventsFileId || ''}
                    >
                        {recording.eventsFileId
                            ? `rrweb player stub — eventsFileId: ${recording.eventsFileId}`
                            : 'No rrweb event blob yet for this session.'}
                    </div>
                </CardBody>
            </Card>

            <div>
                <Link href={`/dashboard/pagesense/${site._id}/recordings`}>
                    <Button variant="ghost">Back to recordings</Button>
                </Link>
            </div>
        </div>
    );
}
