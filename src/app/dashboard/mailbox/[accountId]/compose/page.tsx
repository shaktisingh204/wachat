/**
 * Compose — server shell.
 *
 * Resolves the active account + the drafts folder id so the client
 * composer can save drafts and send.
 */

import { notFound } from 'next/navigation';

import {
    getMailAccount,
    listMailFolders,
} from '@/app/actions/mailbox.actions';

import { ComposeClient } from './compose-client';

export const dynamic = 'force-dynamic';

export default async function MailboxComposePage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    const [account, folders] = await Promise.all([
        getMailAccount(accountId),
        listMailFolders(accountId),
    ]);
    if (!account) notFound();

    const draftsFolder = folders.find((f) => f.type === 'drafts');
    const sentFolder = folders.find((f) => f.type === 'sent');
    const email = account.emailAddress ?? account.localPart;

    return (
        <ComposeClient
            accountId={accountId}
            fromAddress={email}
            fromName={account.displayName ?? undefined}
            draftsFolderId={draftsFolder?._id ?? null}
            sentFolderId={sentFolder?._id ?? null}
        />
    );
}
