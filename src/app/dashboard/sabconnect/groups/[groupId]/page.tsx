/**
 * SabConnect, single group page.
 *
 * Shows a group-scoped feed, the manuals attached to the group, and
 * the member roster.
 */

import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, MessageSquare, Users, Globe, Lock } from 'lucide-react';

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
    type BadgeTone,
} from '@/components/sabcrm/20ui';

import {
    getSabConnectFeed,
    getSabConnectGroup,
    getSabConnectManuals,
} from '@/app/actions/sabconnect.actions';
import { GroupMembershipButton } from '../_components/group-membership-button';
import { SabConnectComposer } from '../../feed/_components/sabconnect-composer';
import { SabConnectFeedList } from '../../feed/_components/sabconnect-feed-list';

export const dynamic = 'force-dynamic';

const VISIBILITY_TONE: Record<string, BadgeTone> = {
    open: 'success',
    closed: 'warning',
    secret: 'neutral',
};

interface PageProps {
    params: Promise<{ groupId: string }>;
}

function SectionHeading({
    id,
    icon: Icon,
    children,
}: {
    id: string;
    icon: typeof Users;
    children: React.ReactNode;
}) {
    return (
        <h2
            id={id}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--st-text)]"
        >
            <Icon size={15} className="text-[var(--st-text-secondary)]" aria-hidden="true" />
            {children}
        </h2>
    );
}

export default async function SabConnectGroupPage({ params }: PageProps) {
    const { groupId } = await params;
    const [group, feed, manuals] = await Promise.all([
        getSabConnectGroup(groupId),
        getSabConnectFeed({ groupId, limit: 25 }),
        getSabConnectManuals({ groupId, limit: 25 }),
    ]);
    if (!group) notFound();

    const members = group.memberCount ?? group.memberIds?.length ?? 0;
    const tone = VISIBILITY_TONE[group.visibility as string] ?? 'neutral';
    const VisIcon = group.visibility === 'open' ? Globe : Lock;

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <a
                        href="/dashboard/sabconnect/groups"
                        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                    >
                        <ArrowLeft size={13} aria-hidden="true" />
                        Back to groups
                    </a>
                    <PageEyebrow>Group</PageEyebrow>
                    <PageTitle>{group.name}</PageTitle>
                    <PageDescription>
                        {group.description ?? 'A space for this team to share and collaborate.'}
                    </PageDescription>
                    <div className="flex items-center gap-2 pt-1">
                        <Badge tone={tone} kind="soft">
                            <VisIcon size={11} aria-hidden="true" />
                            <span className="capitalize">{group.visibility}</span>
                        </Badge>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                            <Users size={13} aria-hidden="true" />
                            <span className="tabular-nums">{members}</span>
                            {members === 1 ? 'member' : 'members'}
                        </span>
                    </div>
                </PageHeaderHeading>
                <PageActions>
                    <GroupMembershipButton groupId={group._id} memberIds={group.memberIds ?? []} />
                </PageActions>
            </PageHeader>

            <SabConnectComposer groups={[]} />

            <section aria-labelledby="group-manuals" className="flex flex-col gap-3">
                <SectionHeading id="group-manuals" icon={BookOpen}>
                    Manuals
                </SectionHeading>
                {manuals.items.length === 0 ? (
                    <Card variant="outlined">
                        <EmptyState
                            icon={BookOpen}
                            size="sm"
                            title="No manuals yet"
                            description="Add documentation to keep the group on the same page."
                        />
                    </Card>
                ) : (
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {manuals.items.map((m) => (
                            <li key={m._id}>
                                <Card className="h-full">
                                    <CardBody className="flex flex-col gap-1 p-3">
                                        <CardTitle className="text-sm">{m.title}</CardTitle>
                                        <p className="line-clamp-2 text-xs text-[var(--st-text-secondary)]">
                                            {m.body}
                                        </p>
                                    </CardBody>
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby="group-feed" className="flex flex-col gap-3">
                <SectionHeading id="group-feed" icon={MessageSquare}>
                    Feed
                </SectionHeading>
                <SabConnectFeedList
                    initialFeed={feed.items}
                    initialAnnouncements={[]}
                    initialRecognitions={[]}
                    initialEvents={[]}
                />
            </section>
        </div>
    );
}
