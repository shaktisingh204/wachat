/**
 * SabConnect — group directory.
 */

import Link from 'next/link';

import {
    PageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
    ZoruPageDescription,
    Card,
    CardContent,
    Badge,
    EmptyState,
} from '@/components/sabcrm/20ui/compat';

import { getSabConnectGroups } from '@/app/actions/sabconnect.actions';
import { CreateGroupDialog } from './_components/create-group-dialog';

export const dynamic = 'force-dynamic';

export default async function SabConnectGroupsPage() {
    const { items } = await getSabConnectGroups({ limit: 100 });

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Groups</ZoruPageTitle>
                    <ZoruPageDescription>
                        Spaces for teams, projects and interest groups.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <CreateGroupDialog />
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
                                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                            >
                                <Card className="h-full transition-shadow hover:shadow-md">
                                    <CardContent className="flex flex-col gap-2 p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="text-base font-semibold text-zoru-text">
                                                {g.name}
                                            </h3>
                                            <Badge variant="outline">{g.visibility}</Badge>
                                        </div>
                                        {g.description ? (
                                            <p className="line-clamp-2 text-sm text-[var(--st-bg-muted)]">
                                                {g.description}
                                            </p>
                                        ) : null}
                                        <p className="text-xs text-[var(--st-bg-muted)]">
                                            {g.memberCount ?? g.memberIds?.length ?? 0} members
                                        </p>
                                    </CardContent>
                                </Card>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
