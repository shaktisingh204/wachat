/**
 * SabConnect — unified feed.
 *
 * Pulls in `intranet-feed` items (kind = post|announcement|recognition|
 * event) plus a parallel rollup of the existing workspace modules so
 * users see one timeline. Composing a post writes a `kind: "post"`
 * feed item; announcements / recognition / events continue to live in
 * their own modules and back-populate the feed.
 */

import Link from 'next/link';
import { Award, Megaphone } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

import {
    getSabConnectFeed,
    getSabConnectGroups,
} from '@/app/actions/sabconnect.actions';
import { getAnnouncements } from '@/app/actions/crm-announcements.actions';
import { getRecognitions } from '@/app/actions/crm-recognitions.actions';
import { getEvents } from '@/app/actions/crm-events.actions';

import { SabConnectComposer } from './_components/sabconnect-composer';
import { SabConnectFeedList } from './_components/sabconnect-feed-list';

export const dynamic = 'force-dynamic';

export default async function SabConnectFeedPage() {
    const [feed, groups, announcements, recognitions, events] = await Promise.all([
        getSabConnectFeed({ limit: 25 }),
        getSabConnectGroups({ limit: 50 }),
        getAnnouncements().catch(() => ({ items: [] as any[] })),
        getRecognitions().catch(() => ({ items: [] as any[] })),
        getEvents().catch(() => ({ items: [] as any[] })),
    ]);

    return (
        <div className="20ui flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Connect</PageEyebrow>
                    <PageTitle>Feed</PageTitle>
                    <PageDescription>
                        One timeline for posts, announcements, recognition, and events across the workspace.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabconnect/announcements/new"
                        className="u-btn u-btn--outline u-btn--md"
                    >
                        <Megaphone size={14} aria-hidden="true" />
                        <span className="u-btn__label">New announcement</span>
                    </Link>
                    <Link
                        href="/dashboard/crm/workspace/awards/new"
                        className="u-btn u-btn--outline u-btn--md"
                    >
                        <Award size={14} aria-hidden="true" />
                        <span className="u-btn__label">Give recognition</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <SabConnectComposer groups={groups.items} />

            <SabConnectFeedList
                initialFeed={feed.items}
                initialAnnouncements={(announcements as any).items ?? []}
                initialRecognitions={(recognitions as any).items ?? []}
                initialEvents={(events as any).items ?? []}
            />
        </div>
    );
}
