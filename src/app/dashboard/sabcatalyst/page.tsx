/**
 * SabCatalyst — project list. Top-level entry to the BaaS console.
 */
import React from 'react';
import Link from 'next/link';

import { listSabcatalystProjects } from '@/app/actions/sabcatalyst.actions';
import { Button, Card, EmptyState, Badge } from '@/components/zoruui';
import { NewProjectButton } from './_components/new-project-button';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'SabCatalyst | SabNode',
    description: 'Serverless backend platform — functions, datastore, auth, file store.',
};

export default async function SabcatalystHomePage() {
    const { items } = await listSabcatalystProjects().catch(() => ({ items: [] }));

    return (
        <div className="zoruui flex-1 space-y-6 p-4 md:p-8 pt-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">SabCatalyst</h1>
                    <p className="text-sm text-[var(--zoru-muted-foreground)] mt-1">
                        Spin up project-scoped functions, datastore tables, auth users,
                        file stores, and HTTP APIs — all in one place.
                    </p>
                </div>
                <NewProjectButton />
            </div>

            {items.length === 0 ? (
                <EmptyState
                    title="No projects yet"
                    description="Create your first SabCatalyst project to deploy functions, store data, and authenticate end-users."
                />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((p) => (
                        <Link key={p._id} href={`/dashboard/sabcatalyst/${p._id}`}>
                            <Card className="p-4 hover:bg-[var(--zoru-accent)] transition-colors h-full">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="font-semibold truncate">{p.name}</h3>
                                        <p className="text-xs text-[var(--zoru-muted-foreground)] font-mono mt-0.5 truncate">
                                            {p.slug}
                                        </p>
                                    </div>
                                    <Badge variant={p.status === 'active' ? 'default' : 'secondary'}>
                                        {p.status}
                                    </Badge>
                                </div>
                                {p.description ? (
                                    <p className="text-sm text-[var(--zoru-muted-foreground)] mt-3 line-clamp-2">
                                        {p.description}
                                    </p>
                                ) : null}
                                <div className="flex items-center gap-3 mt-4 text-xs text-[var(--zoru-muted-foreground)]">
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
