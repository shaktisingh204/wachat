import { Inbox, MessagesSquare, Boxes, CircleDot } from 'lucide-react';
import {
    Badge,
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
    EmptyState,
    PageDescription,
    PageHeader,
    PageHeading,
    PageTitle,
    StatCard,
} from '@/components/sabcrm/20ui';
import { listInboxes, listConversations } from '@/app/actions/sabchat-v2.actions';
import { InboxV2Client } from './_components/inbox-v2-client';

export const dynamic = 'force-dynamic';

/**
 * /dashboard/sabchat/inbox-v2 — omnichannel inbox (Rust BFF).
 *
 * Server component renders the page chrome (breadcrumb, header band, KPI strip)
 * and delegates the live multi-pane conversation surface to InboxV2Client. The
 * realtime client is untouched: listInboxes / listConversations and every
 * server action it calls run exactly as before.
 */
export default async function SabChatInboxV2Page({
    searchParams,
}: {
    searchParams: Promise<{ inboxId?: string; status?: string; selected?: string }>;
}) {
    const sp = await searchParams;
    const inboxesResp = await listInboxes();
    const inboxes = inboxesResp.items ?? [];
    const status = (sp.status as 'open' | 'pending' | 'resolved' | 'snoozed' | undefined) ?? 'open';
    const inboxId = sp.inboxId ?? inboxes[0]?._id;

    const convsResp = inboxId
        ? await listConversations({ inboxId, status })
        : { items: [] as Awaited<ReturnType<typeof listConversations>>['items'] };

    const conversations = convsResp.items ?? [];
    const activeInbox = inboxes.find((i) => i._id === inboxId);

    return (
        <div className="20ui mx-auto flex h-[calc(100vh-4rem)] w-full max-w-[1480px] flex-col gap-4 px-6 pt-6 pb-4">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/sabchat/inbox">SabChat</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Omnichannel inbox</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <PageHeader>
                <PageHeading>
                    <div className="flex items-center gap-3">
                        <PageTitle>Omnichannel inbox</PageTitle>
                        <Badge tone="info" kind="soft" dot>
                            Inbox v2
                        </Badge>
                    </div>
                    <PageDescription>
                        Route conversations from every channel through one shared queue.
                    </PageDescription>
                </PageHeading>
            </PageHeader>

            {inboxes.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)]">
                    <EmptyState
                        icon={Inbox}
                        title="No inboxes yet"
                        description="Create your first inbox in admin to start routing conversations across channels."
                    />
                </div>
            ) : (
                <>
                    <section
                        aria-label="Inbox summary"
                        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                    >
                        <StatCard
                            label="Connected inboxes"
                            value={inboxes.length}
                            icon={Boxes}
                            accent="#6366f1"
                        />
                        <StatCard
                            label={`${status.charAt(0).toUpperCase()}${status.slice(1)} conversations`}
                            value={conversations.length}
                            icon={MessagesSquare}
                            accent="#0ea5e9"
                        />
                        <StatCard
                            label="Active inbox"
                            value={activeInbox?.name ?? '—'}
                            icon={Inbox}
                        />
                        <StatCard
                            label="Current status"
                            value={
                                <span className="capitalize">{status}</span>
                            }
                            icon={CircleDot}
                            accent="#10b981"
                        />
                    </section>

                    <div className="min-h-0 flex-1">
                        <InboxV2Client
                            inboxes={inboxes}
                            selectedInboxId={inboxId ?? ''}
                            status={status}
                            initialConversations={conversations}
                            initialSelectedConversationId={sp.selected}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
