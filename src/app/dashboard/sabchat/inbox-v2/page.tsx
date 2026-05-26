import {
    Card,
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui';
import { listInboxes, listConversations } from '@/app/actions/sabchat-v2.actions';
import { InboxV2Client } from './_components/inbox-v2-client';

export const dynamic = 'force-dynamic';

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

    return (
        <div className="zoruui flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>SabChat — Inbox v2</ZoruCardTitle>
                    <ZoruCardDescription>
                        Omnichannel inbox backed by the Rust BFF. {inboxes.length} inbox(es).
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {inboxes.length === 0 ? (
                        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
                            No inboxes yet. Create one via{' '}
                            <code>POST /v1/sabchat/inboxes</code> or the admin UI.
                        </div>
                    ) : (
                        <InboxV2Client
                            inboxes={inboxes}
                            selectedInboxId={inboxId ?? ''}
                            status={status}
                            initialConversations={convsResp.items ?? []}
                            initialSelectedConversationId={sp.selected}
                        />
                    )}
                </ZoruCardContent>
            </Card>
        </div>
    );
}
