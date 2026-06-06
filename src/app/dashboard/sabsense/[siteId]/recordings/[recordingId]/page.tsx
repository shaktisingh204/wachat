import React from 'react';
import Link from 'next/link';

import {
    Button,
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCardDescription,
    PageHeader,
    ZoruPageTitle,
    ZoruPageDescription,
} from '@/components/sabcrm/20ui/compat';

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
            <div className="zoruui p-8 text-sm text-[color:var(--zoru-fg-muted)]">
                Recording not found.
            </div>
        );
    }

    return (
        <div className="zoruui p-8 space-y-6">
            <PageHeader>
                <ZoruPageTitle>Session recording</ZoruPageTitle>
                <ZoruPageDescription>
                    {recording.urlPath} ·{' '}
                    {new Date(recording.startedAt).toLocaleString()} ·{' '}
                    {recording.durationSecs}s
                </ZoruPageDescription>
            </PageHeader>

            <PagesenseSiteNav siteId={site._id} />

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Player</ZoruCardTitle>
                    <ZoruCardDescription>
                        rrweb integration is TODO. The recorder snippet currently
                        captures pointer/scroll events; once the rrweb finalizer
                        worker writes an event blob to SabFiles, this container
                        will become the actual player.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div
                        className="flex h-[480px] items-center justify-center rounded-md border border-dashed border-[color:var(--zoru-border)] bg-[color:var(--zoru-surface-2)] text-sm text-[color:var(--zoru-fg-muted)]"
                        data-rrweb-player-container
                        data-events-file-id={recording.eventsFileId || ''}
                    >
                        {recording.eventsFileId
                            ? `rrweb player stub — eventsFileId: ${recording.eventsFileId}`
                            : 'No rrweb event blob yet for this session.'}
                    </div>
                </ZoruCardContent>
            </Card>

            <div>
                <Link href={`/dashboard/pagesense/${site._id}/recordings`}>
                    <Button variant="ghost">Back to recordings</Button>
                </Link>
            </div>
        </div>
    );
}
