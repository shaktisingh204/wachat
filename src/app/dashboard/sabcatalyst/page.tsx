/**
 * SabCatalyst, project list. Top-level entry to the BaaS console.
 */
import React from 'react';
import Link from 'next/link';
import { Boxes, FolderGit2, Cpu, CircleDot } from 'lucide-react';

import { listSabcatalystProjects } from '@/app/actions/sabcatalyst.actions';
import {
    Card,
    CardBody,
    CardTitle,
    CardDescription,
    EmptyState,
    Badge,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    StatCard,
} from '@/components/sabcrm/20ui';
import { NewProjectButton } from './_components/new-project-button';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'SabCatalyst | SabNode',
    description: 'Serverless backend platform: functions, datastore, auth, file store.',
};

export default async function SabcatalystHomePage() {
    const { items } = await listSabcatalystProjects().catch(() => ({ items: [] }));

    const activeCount = items.filter((p) => p.status === 'active').length;
    const runtimeCount = new Set(items.map((p) => p.runtime)).size;

    return (
        <div className="20ui flex-1 space-y-6 p-4 pt-6 md:p-8">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Backend platform</PageEyebrow>
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
                <Card>
                    <CardBody className="p-6">
                        <EmptyState
                            icon={Boxes}
                            title="No projects yet"
                            description="Create your first SabCatalyst project to deploy functions, store data, and authenticate end-users."
                            action={<NewProjectButton />}
                        />
                    </CardBody>
                </Card>
            ) : (
                <>
                    <section
                        aria-label="Project summary"
                        className="grid gap-4 sm:grid-cols-3"
                    >
                        <StatCard
                            label="Projects"
                            value={items.length}
                            icon={FolderGit2}
                            accent="#3b7af5"
                        />
                        <StatCard
                            label="Active"
                            value={activeCount}
                            icon={CircleDot}
                            accent="#1f9d55"
                        />
                        <StatCard
                            label="Runtimes in use"
                            value={runtimeCount}
                            icon={Cpu}
                            accent="#7c3aed"
                        />
                    </section>

                    <ul className="grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
                        {items.map((p) => (
                            <li key={p._id}>
                                <Card variant="interactive" className="h-full">
                                    <CardBody className="flex h-full flex-col p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/dashboard/sabcatalyst/${p._id}`}
                                                    className="after:absolute after:inset-0 focus-visible:outline-none"
                                                >
                                                    <CardTitle className="truncate">{p.name}</CardTitle>
                                                </Link>
                                                <CardDescription className="truncate font-mono">
                                                    {p.slug}
                                                </CardDescription>
                                            </div>
                                            <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>
                                                {p.status}
                                            </Badge>
                                        </div>
                                        {p.description ? (
                                            <p className="mt-3 line-clamp-2 text-sm text-[var(--st-text-secondary)]">
                                                {p.description}
                                            </p>
                                        ) : null}
                                        <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-[var(--st-text-secondary)]">
                                            <span className="inline-flex items-center gap-1">
                                                <Cpu size={12} aria-hidden="true" />
                                                {p.runtime}
                                            </span>
                                            {p.region ? <span>{p.region}</span> : null}
                                        </div>
                                    </CardBody>
                                </Card>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
