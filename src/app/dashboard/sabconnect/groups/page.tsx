/**
 * SabConnect — group directory.
 */

import Link from 'next/link';
import { Users, UsersRound, Globe, Lock } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Card,
    CardBody,
    CardTitle,
    Badge,
    EmptyState,
    StatCard,
    type BadgeTone,
} from '@/components/sabcrm/20ui';

import { getSabConnectGroups } from '@/app/actions/sabconnect.actions';
import { CreateGroupDialog } from './_components/create-group-dialog';

export const dynamic = 'force-dynamic';

const VISIBILITY_TONE: Record<string, BadgeTone> = {
    open: 'success',
    closed: 'warning',
    secret: 'neutral',
};

export default async function SabConnectGroupsPage() {
    const { items } = await getSabConnectGroups({ limit: 100 });

    const totalMembers = items.reduce(
        (acc, g) => acc + (g.memberCount ?? g.memberIds?.length ?? 0),
        0,
    );
    const openGroups = items.filter((g) => g.visibility === 'open').length;

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Connect</PageEyebrow>
                    <PageTitle>Groups</PageTitle>
                    <PageDescription>
                        Spaces for teams, projects, and interest groups across the workspace.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <CreateGroupDialog />
                </PageActions>
            </PageHeader>

            {items.length === 0 ? (
                <Card variant="outlined" className="min-h-[240px]">
                    <EmptyState
                        icon={UsersRound}
                        title="No groups yet"
                        description="Create the first group to start collaborating with your team."
                        action={<CreateGroupDialog />}
                    />
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <StatCard
                            label="Groups"
                            value={items.length}
                            icon={UsersRound}
                            accent="#3b7af5"
                        />
                        <StatCard
                            label="Total members"
                            value={totalMembers}
                            icon={Users}
                            accent="#1f9d55"
                        />
                        <StatCard
                            label="Open to join"
                            value={openGroups}
                            icon={Globe}
                            accent="#7c3aed"
                        />
                    </div>

                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((g) => {
                            const members =
                                g.memberCount ?? g.memberIds?.length ?? 0;
                            const tone =
                                VISIBILITY_TONE[g.visibility as string] ?? 'neutral';
                            const VisIcon = g.visibility === 'open' ? Globe : Lock;
                            return (
                                <li key={g._id}>
                                    <Link
                                        href={`/dashboard/sabconnect/groups/${g._id}`}
                                        className="block h-full rounded-[var(--st-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                                    >
                                        <Card variant="interactive" padding="md" className="h-full">
                                            <CardBody className="flex flex-col gap-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <CardTitle className="flex items-center gap-2">
                                                        <span
                                                            className="grid size-7 shrink-0 place-items-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                                                            aria-hidden="true"
                                                        >
                                                            <UsersRound size={15} />
                                                        </span>
                                                        {g.name}
                                                    </CardTitle>
                                                    <Badge tone={tone} kind="soft">
                                                        <VisIcon size={11} aria-hidden="true" />
                                                        <span className="capitalize">{g.visibility}</span>
                                                    </Badge>
                                                </div>
                                                {g.description ? (
                                                    <p className="line-clamp-2 text-sm text-[var(--st-text-secondary)]">
                                                        {g.description}
                                                    </p>
                                                ) : null}
                                                <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-[var(--st-text-secondary)]">
                                                    <Users size={13} aria-hidden="true" />
                                                    <span className="tabular-nums">{members}</span>
                                                    {members === 1 ? 'member' : 'members'}
                                                </p>
                                            </CardBody>
                                        </Card>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
}
