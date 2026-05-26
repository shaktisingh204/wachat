/**
 * Filter rules — server shell.
 */

import {
    listMailFolders,
    listMailRules,
} from '@/app/actions/mailbox.actions';

import { RulesClient } from './rules-client';

export const dynamic = 'force-dynamic';

export default async function MailboxRulesPage({
    params,
}: {
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    const [rules, folders] = await Promise.all([
        listMailRules(accountId),
        listMailFolders(accountId),
    ]);

    return (
        <RulesClient
            accountId={accountId}
            initialRules={rules}
            folders={folders}
        />
    );
}
