/**
 * Hosted Mail — mailbox account admin.
 *
 * Server component shell: fetches domains + accounts via the actions
 * layer, then renders the interactive list/form in the client child.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import {
    listMailAccounts,
    listMailDomains,
} from '@/app/actions/mailbox.actions';
import { Button, EmptyState, PageHeader } from '@/components/sabcrm/20ui/compat';

import { AccountsClient } from './accounts-client';

export const dynamic = 'force-dynamic';

export default async function MailboxAccountsAdminPage() {
    const [domains, accounts] = await Promise.all([
        listMailDomains(),
        listMailAccounts({ limit: 200 }),
    ]);

    return (
        <div className="zoruui mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
            <PageHeader
                title="Mailbox accounts"
                description="Create individual mailboxes against your verified domains."
                actions={
                    <Button asChild variant="outline">
                        <Link href="/dashboard/mailbox">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Link>
                    </Button>
                }
            />

            {domains.length === 0 ? (
                <EmptyState
                    title="Add a domain first"
                    description="Mailboxes are scoped to a domain you own."
                    action={
                        <Button asChild>
                            <Link href="/dashboard/mailbox/admin/domains">
                                Add domain
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <AccountsClient domains={domains} initialAccounts={accounts} />
            )}
        </div>
    );
}
