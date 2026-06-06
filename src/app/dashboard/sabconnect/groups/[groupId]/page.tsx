/**
 * SabConnect — single group page.
 *
 * Shows a group-scoped feed, the manuals attached to the group, and
 * the member roster.
 */

import { notFound } from 'next/navigation';

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

import {
    getSabConnectFeed,
    getSabConnectGroup,
    getSabConnectManuals,
} from '@/app/actions/sabconnect.actions';
import { GroupMembershipButton } from '../_components/group-membership-button';
import { SabConnectComposer } from '../../feed/_components/sabconnect-composer';
import { SabConnectFeedList } from '../../feed/_components/sabconnect-feed-list';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ groupId: string }>;
}

export default async function SabConnectGroupPage({ params }: PageProps) {
    const { groupId } = await params;
    const [group, feed, manuals] = await Promise.all([
        getSabConnectGroup(groupId),
        getSabConnectFeed({ groupId, limit: 25 }),
        getSabConnectManuals({ groupId, limit: 25 }),
    ]);
    if (!group) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>{group.name}</ZoruPageTitle>
                    <ZoruPageDescription>
                        {group.description ?? `${group.visibility} group`}
                    </ZoruPageDescription>
                    <div className="flex items-center gap-2 pt-1">
                        <Badge variant="outline">{group.visibility}</Badge>
                        <span className="text-xs text-[var(--st-bg-muted)]">
                            {group.memberCount ?? group.memberIds?.length ?? 0} members
                        </span>
                    </div>
                </ZoruPageHeading>
                <GroupMembershipButton groupId={group._id} memberIds={group.memberIds ?? []} />
            </PageHeader>

            <SabConnectComposer groups={[]} />

            <section aria-labelledby="group-manuals" className="flex flex-col gap-2">
                <h2 id="group-manuals" className="text-sm font-semibold text-[var(--st-bg-muted)]">
                    Manuals
                </h2>
                {manuals.items.length === 0 ? (
                    <EmptyState
                        title="No manuals yet"
                        description="Add documentation to keep the group on the same page."
                    />
                ) : (
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {manuals.items.map((m) => (
                            <li key={m._id}>
                                <Card>
                                    <CardContent className="p-3">
                                        <p className="text-sm font-semibold text-zoru-text">
                                            {m.title}
                                        </p>
                                        <p className="line-clamp-2 text-xs text-[var(--st-bg-muted)]">
                                            {m.body}
                                        </p>
                                    </CardContent>
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section aria-labelledby="group-feed">
                <h2 id="group-feed" className="pb-2 text-sm font-semibold text-[var(--st-bg-muted)]">
                    Feed
                </h2>
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
