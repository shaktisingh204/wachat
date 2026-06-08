/**
 * SabConnect, pinned custom apps grid.
 */

import { AppWindow, ExternalLink, LayoutGrid, SquareArrowOutUpRight } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Card,
    CardBody,
    Badge,
    EmptyState,
    StatCard,
} from '@/components/sabcrm/20ui';

import { getSabConnectCustomApps } from '@/app/actions/sabconnect.actions';
import { CreateCustomAppDialog } from './_components/create-custom-app-dialog';

export const dynamic = 'force-dynamic';

export default async function SabConnectAppsPage() {
    const { items } = await getSabConnectCustomApps({ limit: 100 });

    const embedded = items.filter((a) => a.openIn === 'iframe').length;
    const external = items.length - embedded;

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Connect</PageEyebrow>
                    <PageTitle>Apps</PageTitle>
                    <PageDescription>
                        Pin internal dashboards, BI links, and tools right inside Connect.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <CreateCustomAppDialog />
                </PageActions>
            </PageHeader>

            {items.length === 0 ? (
                <Card variant="outlined" className="min-h-[240px]">
                    <EmptyState
                        icon={LayoutGrid}
                        title="No apps pinned yet"
                        description="Pin the first app to surface it for the team."
                        action={<CreateCustomAppDialog />}
                    />
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <StatCard
                            label="Pinned apps"
                            value={items.length}
                            icon={LayoutGrid}
                            accent="#3b7af5"
                        />
                        <StatCard
                            label="Embedded"
                            value={embedded}
                            icon={AppWindow}
                            accent="#7c3aed"
                        />
                        <StatCard
                            label="External link"
                            value={external}
                            icon={ExternalLink}
                            accent="#1f9d55"
                        />
                    </div>

                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {items.map((app) => (
                            <li key={app._id}>
                                <a
                                    href={app.url}
                                    target={app.openIn === 'iframe' ? '_self' : '_blank'}
                                    rel="noopener noreferrer"
                                    aria-label={`Open ${app.name}`}
                                    className="block h-full rounded-[var(--st-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                                >
                                    <Card variant="interactive" className="h-full">
                                        <CardBody className="flex h-full flex-col items-center gap-2 p-4 text-center">
                                            <div className="grid size-12 place-items-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-lg font-semibold text-[var(--st-accent)]">
                                                {app.name.charAt(0).toUpperCase()}
                                            </div>
                                            <p className="flex items-center gap-1 text-sm font-semibold text-[var(--st-text)]">
                                                {app.name}
                                                {app.openIn !== 'iframe' ? (
                                                    <SquareArrowOutUpRight
                                                        size={12}
                                                        className="text-[var(--st-text-secondary)]"
                                                        aria-hidden="true"
                                                    />
                                                ) : null}
                                            </p>
                                            {app.description ? (
                                                <p className="line-clamp-2 text-xs text-[var(--st-text-secondary)]">
                                                    {app.description}
                                                </p>
                                            ) : null}
                                            <Badge
                                                tone="neutral"
                                                kind="outline"
                                                className="mt-auto"
                                            >
                                                {app.openIn === 'iframe' ? 'Embedded' : 'New tab'}
                                            </Badge>
                                        </CardBody>
                                    </Card>
                                </a>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
