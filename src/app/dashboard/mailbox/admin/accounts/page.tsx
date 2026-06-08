/**
 * Hosted Mail - mailbox account admin.
 *
 * Server component shell: fetches domains + accounts via the actions
 * layer, then renders the interactive list/form in the client child.
 */

import Link from 'next/link';
import { ArrowLeft, AtSign, Plus, ShieldCheck } from 'lucide-react';

import {
    listMailAccounts,
    listMailDomains,
} from '@/app/actions/mailbox.actions';
import {
    EmptyState,
    PageActions,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
} from '@/components/sabcrm/20ui';

import { AccountsClient } from './accounts-client';

export const dynamic = 'force-dynamic';

/** Next.js Link styled as a 20ui button (Button renders a <button>, so a real
 *  anchor carries the canonical `u-btn` classes for navigation). */
function LinkButton({
    href,
    children,
    variant = 'secondary',
}: {
    href: string;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline';
}) {
    return (
        <Link href={href} className={`u-btn u-btn--${variant} u-btn--md`}>
            <span className="u-btn__label">{children}</span>
        </Link>
    );
}

export default async function MailboxAccountsAdminPage() {
    const [domains, accounts] = await Promise.all([
        listMailDomains(),
        listMailAccounts({ limit: 200 }),
    ]);

    const activeCount = accounts.filter(
        (a) => (a.status ?? 'active') === 'active',
    ).length;

    return (
        <div className="20ui mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Mailbox admin</PageEyebrow>
                    <PageTitle>Mailbox accounts</PageTitle>
                    <PageDescription>
                        Create and manage individual mailboxes on your verified domains.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <LinkButton href="/dashboard/mailbox" variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                        Back to mailbox
                    </LinkButton>
                </PageActions>
            </PageHeader>

            {domains.length === 0 ? (
                <EmptyState
                    icon={ShieldCheck}
                    title="Add a domain first"
                    description="Mailboxes are scoped to a domain you own. Connect one to begin."
                    action={
                        <LinkButton
                            href="/dashboard/mailbox/admin/domains"
                            variant="primary"
                        >
                            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                            Add domain
                        </LinkButton>
                    }
                />
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard
                            label="Mailboxes"
                            value={String(accounts.length)}
                            icon={AtSign}
                            accent="#3b7af5"
                        />
                        <StatCard
                            label="Active"
                            value={String(activeCount)}
                            icon={ShieldCheck}
                            accent="#1f9d55"
                        />
                        <StatCard
                            label="Domains"
                            value={String(domains.length)}
                            icon={ShieldCheck}
                        />
                    </div>
                    <AccountsClient domains={domains} initialAccounts={accounts} />
                </>
            )}
        </div>
    );
}
