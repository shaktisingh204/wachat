/**
 * Webmail — three-pane inbox.
 *
 * Server component loads folders + messages, hands them to the client
 * pane for interactive selection / marking / moving.
 */

import {
    listMailFolders,
    listMailMessages,
} from '@/app/actions/mailbox.actions';

import { InboxClient } from './inbox-client';

export const dynamic = 'force-dynamic';

export default async function MailboxInboxPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    const [folders, messages] = await Promise.all([
        listMailFolders(accountId),
        listMailMessages({ accountId, limit: 100 }),
    ]);

    return (
        <InboxClient
            accountId={accountId}
            initialFolders={folders}
            initialMessages={messages}
        />
    );
}
