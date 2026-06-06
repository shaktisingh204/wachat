'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import {
    Avatar,
    AvatarFallback,
    Badge,
    Card,
    CardBody,
    EmptyState,
    SegmentedControl,
    type BadgeVariant,
    type SegmentedItem,
} from '@/components/sabcrm/20ui';

import type { SabConnectFeedItemDoc } from '@/lib/rust-client/sabconnect-feed';
import { SabConnectFeedItemActions } from './sabconnect-feed-item-actions';

const KIND_VARIANTS: Record<string, { label: string; variant: BadgeVariant }> = {
    post: { label: 'Post', variant: 'default' },
    announcement: { label: 'Announcement', variant: 'secondary' },
    recognition: { label: 'Recognition', variant: 'outline' },
    event: { label: 'Event', variant: 'outline' },
};

type FeedFilter = 'all' | 'post' | 'announcement' | 'recognition' | 'event';

const FILTER_ITEMS: ReadonlyArray<SegmentedItem<FeedFilter>> = [
    { value: 'all', label: 'All' },
    { value: 'post', label: 'Post' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'recognition', label: 'Recognition' },
    { value: 'event', label: 'Event' },
];

type FeedRow = {
    id: string;
    kind: string;
    title?: string;
    body: string;
    authorName?: string;
    createdAt: string;
    href?: string;
};

interface Props {
    initialFeed: SabConnectFeedItemDoc[];
    initialAnnouncements: Array<{ _id: string; title: string; body: string; authorName?: string; createdAt?: string }>;
    initialRecognitions: Array<{ _id: string; message?: string; recipientName?: string; createdAt?: string }>;
    initialEvents: Array<{ _id: string; title: string; description?: string; startAt?: string; createdAt?: string }>;
}

function toFeedRows(props: Props): FeedRow[] {
    const rows: FeedRow[] = [];
    for (const f of props.initialFeed) {
        rows.push({
            id: f._id,
            kind: f.kind ?? 'post',
            body: f.body,
            authorName: f.authorName,
            createdAt: f.createdAt ?? new Date(0).toISOString(),
        });
    }
    for (const a of props.initialAnnouncements) {
        rows.push({
            id: `ann-${a._id}`,
            kind: 'announcement',
            title: a.title,
            body: a.body,
            authorName: a.authorName,
            createdAt: a.createdAt ?? new Date(0).toISOString(),
            href: `/dashboard/sabconnect/announcements/${a._id}`,
        });
    }
    for (const r of props.initialRecognitions) {
        rows.push({
            id: `rec-${r._id}`,
            kind: 'recognition',
            body: r.message ?? `Kudos to ${r.recipientName ?? 'a teammate'}`,
            createdAt: r.createdAt ?? new Date(0).toISOString(),
            href: `/dashboard/crm/workspace/awards/${r._id}`,
        });
    }
    for (const e of props.initialEvents) {
        rows.push({
            id: `evt-${e._id}`,
            kind: 'event',
            title: e.title,
            body: e.description ?? '',
            createdAt: e.startAt ?? e.createdAt ?? new Date(0).toISOString(),
            href: `/dashboard/crm/workspace/events/${e._id}`,
        });
    }
    rows.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    return rows;
}

export function SabConnectFeedList(props: Props) {
    const [filter, setFilter] = useState<FeedFilter>('all');
    const rows = useMemo(() => toFeedRows(props), [props]);
    const visible = useMemo(
        () => (filter === 'all' ? rows : rows.filter((r) => r.kind === filter)),
        [rows, filter],
    );

    return (
        <div className="flex flex-col gap-4">
            <SegmentedControl
                items={FILTER_ITEMS}
                value={filter}
                onChange={setFilter}
                aria-label="Filter feed"
            />

            {visible.length === 0 ? (
                <EmptyState
                    title="Nothing here yet"
                    description="Be the first to post an update for the team."
                />
            ) : (
                <ul className="flex flex-col gap-3">
                    {visible.map((row) => {
                        const kind = KIND_VARIANTS[row.kind] ?? KIND_VARIANTS.post;
                        const initial = (row.authorName ?? 'U').charAt(0).toUpperCase();
                        return (
                            <li key={row.id}>
                                <Card>
                                    <CardBody className="flex flex-col gap-3 p-4">
                                        <header className="flex items-start gap-3">
                                            <Avatar className="size-9">
                                                <AvatarFallback>{initial}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-1 flex-col">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold text-[var(--st-text)]">
                                                        {row.authorName ?? 'Team'}
                                                    </span>
                                                    <Badge variant={kind.variant}>{kind.label}</Badge>
                                                </div>
                                                <time
                                                    className="text-xs text-[var(--st-text-secondary)]"
                                                    dateTime={row.createdAt}
                                                >
                                                    {new Date(row.createdAt).toLocaleString()}
                                                </time>
                                            </div>
                                        </header>
                                        {row.title ? (
                                            <h3 className="text-base font-semibold text-[var(--st-text)]">
                                                {row.href ? (
                                                    <Link href={row.href} className="hover:underline">
                                                        {row.title}
                                                    </Link>
                                                ) : (
                                                    row.title
                                                )}
                                            </h3>
                                        ) : null}
                                        <p className="whitespace-pre-wrap text-sm text-[var(--st-text)]">
                                            {row.body}
                                        </p>
                                        {/* Reactions + comments only on canonical feed items.
                                         The spawned proxies for announcement/recognition/event
                                         link out to their module pages. */}
                                        {row.kind === 'post' || !row.href ? (
                                            <SabConnectFeedItemActions itemId={row.id} />
                                        ) : (
                                            <Link
                                                href={row.href}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--st-accent)] hover:underline"
                                            >
                                                Open in workspace
                                                <ArrowUpRight size={13} aria-hidden="true" />
                                            </Link>
                                        )}
                                    </CardBody>
                                </Card>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
