/**
 * Hosted Mail landing - overview + entry points.
 *
 * Server component. Reads domain + account state via the mailbox actions
 * layer and renders:
 *   - StatCards (domains, verified domains, accounts)
 *   - "Connect your domain" CTA when no domains exist
 *   - One card per mailbox account linking to inbox / compose
 */

import Link from 'next/link';
import { Mail, Plus, ShieldCheck, AtSign, CheckCircle2 } from 'lucide-react';

import {
    listMailAccounts,
    listMailDomains,
} from '@/app/actions/mailbox.actions';
import {
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
} from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

/**
 * A Next.js Link styled as a 20ui button. Button has no `asChild`, and a real
 * `<a>` is the correct element for navigation, so links use the `u-btn` classes
 * directly (the canonical 20ui link-as-button pattern).
 */
function LinkButton({
    href,
    children,
    variant = 'secondary',
    size = 'md',
    block = false,
    className,
}: {
    href: string;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'outline';
    size?: 'sm' | 'md';
    block?: boolean;
    className?: string;
}) {
    const cls = [
        'u-btn',
        `u-btn--${variant}`,
        `u-btn--${size}`,
        block && 'u-btn--block',
        className,
    ]
        .filter(Boolean)
        .join(' ');
    return (
        <Link href={href} className={cls}>
            <span className="u-btn__label">{children}</span>
        </Link>
    );
}

export default async function MailboxLandingPage() {
    const [accounts, domains] = await Promise.all([
        listMailAccounts({ limit: 50 }),
        listMailDomains(),
    ]);

    const verifiedDomains = domains.filter((d) => d.mxStatus === 'verified').length;
    const noDomains = domains.length === 0;

    return (
        <div className="20ui mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Mailbox</PageTitle>
                    <PageDescription>
                        Hosted email on your own domain. Inbox, compose, rules, address book.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <LinkButton href="/dashboard/mailbox/admin/domains" variant="outline">
                        <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                        Domains
                    </LinkButton>
                    <LinkButton href="/dashboard/mailbox/admin/accounts" variant="primary">
                        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                        Mailbox accounts
                    </LinkButton>
                </PageActions>
            </PageHeader>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Domains" value={String(domains.length)} icon={ShieldCheck} />
                <StatCard
                    label="Verified"
                    value={`${verifiedDomains}/${domains.length || 0}`}
                    icon={CheckCircle2}
                />
                <StatCard label="Mailboxes" value={String(accounts.length)} icon={AtSign} />
            </div>

            {noDomains ? (
                <EmptyState
                    icon={ShieldCheck}
                    title="Connect your domain"
                    description="Add a domain you own to start receiving mail and provisioning mailboxes."
                    action={
                        <LinkButton href="/dashboard/mailbox/admin/domains" variant="primary">
                            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                            Add domain
                        </LinkButton>
                    }
                />
            ) : accounts.length === 0 ? (
                <EmptyState
                    icon={Mail}
                    title="No mailboxes yet"
                    description="Create your first mailbox account on one of your domains."
                    action={
                        <LinkButton href="/dashboard/mailbox/admin/accounts" variant="primary">
                            Create a mailbox
                        </LinkButton>
                    }
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {accounts.map((account) => {
                        const id = account._id!;
                        const email = account.emailAddress ?? account.localPart;
                        return (
                            <Card key={id}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Mail className="h-4 w-4" aria-hidden="true" />
                                        {account.displayName ?? email}
                                    </CardTitle>
                                    <CardDescription>{email}</CardDescription>
                                </CardHeader>
                                <CardBody className="flex gap-2">
                                    <LinkButton
                                        href={`/dashboard/mailbox/${id}/inbox`}
                                        variant="primary"
                                        size="sm"
                                        block
                                        className="flex-1"
                                    >
                                        Open inbox
                                    </LinkButton>
                                    <LinkButton
                                        href={`/dashboard/mailbox/${id}/compose`}
                                        variant="outline"
                                        size="sm"
                                    >
                                        Compose
                                    </LinkButton>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
