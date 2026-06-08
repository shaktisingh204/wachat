/**
 * Hosted Mail - mailbox account admin.
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
import {
    Button,
    EmptyState,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeading,
    PageTitle,
} from '@/components/sabcrm/20ui';

import { AccountsClient } from './accounts-client';

export const dynamic = 'force-dynamic';

export default async function MailboxAccountsAdminPage() {
    const [domains, accounts] = await Promise.all([
        listMailDomains(),
        listMailAccounts({ limit: 200 }),
    ]);

    return (
        <div className="20ui mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
            <PageHeader>
                <PageHeading>
                    <PageTitle>Mailbox accounts</PageTitle>
                    <PageDescription>
                        Create individual mailboxes against your verified domains.
                    </PageDescription>
                </PageHeading>
                <PageActions>
                    <Button variant="outline" iconLeft={ArrowLeft}>
                        <Link href="/dashboard/mailbox">Back</Link>
                    </Button>
                </PageActions>
            </PageHeader>

            {domains.length === 0 ? (
                <EmptyState
                    title="Add a domain first"
                    description="Mailboxes are scoped to a domain you own."
                    action={
                        <Button variant="primary">
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
