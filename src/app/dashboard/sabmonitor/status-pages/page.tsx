import * as React from 'react';
import Link from 'next/link';
import { Globe, Globe2, Plus, ExternalLink, Eye, EyeOff } from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    EmptyState,
    PageActions,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
    Separator,
} from '@/components/sabcrm/20ui';

import { listSabmonitorStatusPages } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function StatusPagesIndex(): Promise<React.JSX.Element> {
    const res = await listSabmonitorStatusPages();
    const total = res.items.length;
    const live = res.items.filter((p) => p.status === 'live').length;

    return (
        <div className="flex max-w-[1000px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Status pages</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/status-pages/new"
                        className="u-btn u-btn--primary u-btn--md"
                    >
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New status page</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {total > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard
                        label="Status pages"
                        value={<span className="tabular-nums">{total}</span>}
                        icon={<Globe2 aria-hidden="true" />}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Published"
                        value={<span className="tabular-nums">{live}</span>}
                        icon={<Eye aria-hidden="true" />}
                        accent="#1f9d55"
                    />
                    <StatCard
                        label="Draft"
                        value={<span className="tabular-nums">{total - live}</span>}
                        icon={<EyeOff aria-hidden="true" />}
                    />
                </div>
            )}

            <Card padding="none">
                <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Globe
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Public pages
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={Globe}
                            title="No status pages yet"
                            description="Publish a status page to share live uptime and incident history with your users."
                            action={
                                <Link
                                    href="/dashboard/sabmonitor/status-pages/new"
                                    className="u-btn u-btn--primary u-btn--md"
                                >
                                    <Plus size={14} aria-hidden="true" />
                                    <span className="u-btn__label">New status page</span>
                                </Link>
                            }
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {res.items.map((p) => (
                                <li
                                    key={p._id}
                                    className="flex items-center justify-between gap-3 px-4 py-3"
                                >
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <Link
                                            className="truncate text-sm font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                            href={`/dashboard/sabmonitor/status-pages/${p._id}`}
                                        >
                                            {p.title}
                                        </Link>
                                        <Link
                                            className="inline-flex w-fit items-center gap-1 text-xs text-[var(--st-accent)] transition-colors hover:text-[var(--st-accent-hover)]"
                                            href={`/uptime/${p.slug}`}
                                        >
                                            /uptime/{p.slug}
                                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                        </Link>
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
