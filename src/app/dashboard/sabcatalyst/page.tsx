/**
 * SabCatalyst, project list. Top-level entry to the BaaS console.
 */
import React from 'react';
import Link from 'next/link';

import { listSabcatalystProjects } from '@/app/actions/sabcatalyst.actions';
import {
    Card,
    CardTitle,
    CardDescription,
    EmptyState,
    Badge,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';
import { NewProjectButton } from './_components/new-project-button';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'SabCatalyst | SabNode',
    description: 'Serverless backend platform: functions, datastore, auth, file store.',
};

export default async function SabcatalystHomePage() {
    const { items } = await listSabcatalystProjects().catch(() => ({ items: [] }));

    return (
        <div className="ui20 flex-1 space-y-6 p-4 md:p-8 pt-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>SabCatalyst</PageTitle>
                    <PageDescription>
                        Spin up project-scoped functions, datastore tables, auth users,
                        file stores, and HTTP APIs, all in one place.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <NewProjectButton />
                </PageActions>
            </PageHeader>

            {items.length === 0 ? (
                <EmptyState
                    title="No projects yet"
                    description="Create your first SabCatalyst project to deploy functions, store data, and authenticate end-users."
                    action={<NewProjectButton />}
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((p) => (
                        <Link
                            key={p._id}
                            href={`/dashboard/sabcatalyst/${p._id}`}
                            className="block h-full focus:outline-none"
                        >
                            <Card variant="interactive" className="h-full">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <CardTitle className="truncate">{p.name}</CardTitle>
                                        <CardDescription className="font-mono truncate">
                                            {p.slug}
                                        </CardDescription>
                                    </div>
                                    <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>
                                        {p.status}
                                    </Badge>
                                </div>
                                {p.description ? (
                                    <p className="text-sm text-[var(--st-text-secondary)] mt-3 line-clamp-2">
                                        {p.description}
                                    </p>
                                ) : null}
                                <div className="flex items-center gap-3 mt-4 text-xs text-[var(--st-text-secondary)]">
                                    <span>Runtime: {p.runtime}</span>
                                    {p.region ? <span>Region: {p.region}</span> : null}
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
