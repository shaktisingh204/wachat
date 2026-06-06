import * as React from 'react';
import Link from 'next/link';
import { Globe, Plus } from 'lucide-react';

import {
    Card,
    CardBody,
    EmptyState,
    PageActions,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    cn,
} from '@/components/sabcrm/20ui';

import { listSabmonitorStatusPages } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function StatusPagesIndex(): Promise<React.JSX.Element> {
    const res = await listSabmonitorStatusPages();

    return (
        <div className="ui20 flex flex-col gap-4">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Status pages</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/status-pages/new"
                        className={cn('u-btn', 'u-btn--primary', 'u-btn--md')}
                    >
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New status page</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <Card padding="none">
                <CardBody>
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={Globe}
                            title="No status pages yet"
                            description="Create a public status page to share uptime and incidents with your users."
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {res.items.map((p) => (
                                <li
                                    key={p._id}
                                    className="flex items-center justify-between p-3"
                                >
                                    <div className="flex flex-col gap-1">
                                        <Link
                                            className="text-sm font-medium text-[var(--st-text)] hover:underline"
                                            href={`/dashboard/sabmonitor/status-pages/${p._id}`}
                                        >
                                            {p.title}
                                        </Link>
                                        <span className="text-xs text-[var(--st-text-secondary)]">
                                            Public URL:{' '}
                                            <Link
                                                className="text-[var(--st-accent)] hover:underline"
                                                href={`/uptime/${p.slug}`}
                                            >
                                                /uptime/{p.slug}
                                            </Link>
                                        </span>
                                    </div>
                                    <StatusBadge status={p.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
