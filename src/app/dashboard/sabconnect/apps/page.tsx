/**
 * SabConnect — pinned custom apps grid.
 */

import { PageHeader, PageHeading, PageTitle, PageDescription, Card, CardContent, EmptyState } from '@/components/sabcrm/20ui/compat';

import { getSabConnectCustomApps } from '@/app/actions/sabconnect.actions';
import { CreateCustomAppDialog } from './_components/create-custom-app-dialog';

export const dynamic = 'force-dynamic';

export default async function SabConnectAppsPage() {
    const { items } = await getSabConnectCustomApps({ limit: 100 });

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeading>
                    <PageTitle>Apps</PageTitle>
                    <PageDescription>
                        Pin internal dashboards, BI links and tools right inside Connect.
                    </PageDescription>
                </PageHeading>
                <CreateCustomAppDialog />
            </PageHeader>

            {items.length === 0 ? (
                <EmptyState
                    title="No apps pinned yet"
                    description="Add the first app to surface it for the team."
                />
            ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {items.map((app) => (
                        <li key={app._id}>
                            <a
                                href={app.url}
                                target={app.openIn === 'iframe' ? '_self' : '_blank'}
                                rel="noopener noreferrer"
                                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                            >
                                <Card className="h-full transition-shadow hover:shadow-md">
                                    <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                                        <div className="grid size-12 place-items-center rounded-lg bg-[var(--st-hover)] text-lg font-semibold text-[var(--st-text)]">
                                            {app.name.charAt(0).toUpperCase()}
                                        </div>
                                        <p className="text-sm font-semibold text-[var(--st-text)]">
                                            {app.name}
                                        </p>
                                        {app.description ? (
                                            <p className="line-clamp-2 text-xs text-[var(--st-bg-muted)]">
                                                {app.description}
                                            </p>
                                        ) : null}
                                    </CardContent>
                                </Card>
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
