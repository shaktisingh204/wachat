/**
 * SabConnect — group directory.
 */

import Link from 'next/link';

import {
    PageHeader,
    PageHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Card,
    CardBody,
    CardTitle,
    Badge,
    EmptyState,
} from '@/components/sabcrm/20ui';

import { getSabConnectGroups } from '@/app/actions/sabconnect.actions';
import { CreateGroupDialog } from './_components/create-group-dialog';

export const dynamic = 'force-dynamic';

export default async function SabConnectGroupsPage() {
    const { items } = await getSabConnectGroups({ limit: 100 });

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeading>
                    <PageTitle>Groups</PageTitle>
                    <PageDescription>
                        Spaces for teams, projects and interest groups.
                    </PageDescription>
                </PageHeading>
                <PageActions>
                    <CreateGroupDialog />
                </PageActions>
            </PageHeader>

            {items.length === 0 ? (
                <EmptyState
                    title="No groups yet"
                    description="Create the first group to start collaborating."
                />
            ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((g) => (
                        <li key={g._id}>
                            <Link
                                href={`/dashboard/sabconnect/groups/${g._id}`}
                                className="block rounded-[var(--st-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                            >
                                <Card variant="interactive" padding="md" className="h-full">
                                    <CardBody className="flex flex-col gap-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <CardTitle>{g.name}</CardTitle>
                                            <Badge tone="neutral" kind="outline">
                                                {g.visibility}
                                            </Badge>
                                        </div>
                                        {g.description ? (
                                            <p className="line-clamp-2 text-sm text-[var(--st-text-secondary)]">
                                                {g.description}
                                            </p>
                                        ) : null}
                                        <p className="text-xs text-[var(--st-text-secondary)]">
                                            {g.memberCount ?? g.memberIds?.length ?? 0} members
                                        </p>
                                    </CardBody>
                                </Card>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
