/**
 * Hosted Mail landing — overview + entry points.
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
    Button,
    Card,
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardHeader,
    ZoruCardTitle,
    EmptyState,
    PageHeader,
    StatCard,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

export default async function MailboxLandingPage() {
    const [accounts, domains] = await Promise.all([
        listMailAccounts({ limit: 50 }),
        listMailDomains(),
    ]);

    const verifiedDomains = domains.filter((d) => d.mxStatus === 'verified').length;
    const noDomains = domains.length === 0;

    return (
        <div className="zoruui mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
            <PageHeader
                title="Mailbox"
                description="Hosted email on your own domain — inbox, compose, rules, address book."
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href="/dashboard/mailbox/admin/domains">
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Domains
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/dashboard/mailbox/admin/accounts">
                                <Plus className="mr-2 h-4 w-4" />
                                Mailbox accounts
                            </Link>
                        </Button>
                    </div>
                }
            />

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Domains"
                    value={String(domains.length)}
                    icon={<ShieldCheck className="h-5 w-5" />}
                />
                <StatCard
                    label="Verified"
                    value={`${verifiedDomains}/${domains.length || 0}`}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                />
                <StatCard
                    label="Mailboxes"
                    value={String(accounts.length)}
                    icon={<AtSign className="h-5 w-5" />}
                />
            </div>

            {noDomains ? (
                <EmptyState
                    icon={<ShieldCheck className="h-10 w-10" />}
                    title="Connect your domain"
                    description="Add a domain you own to start receiving mail and provisioning mailboxes."
                    action={
                        <Button asChild>
                            <Link href="/dashboard/mailbox/admin/domains">
                                <Plus className="mr-2 h-4 w-4" />
                                Add domain
                            </Link>
                        </Button>
                    }
                />
            ) : accounts.length === 0 ? (
                <EmptyState
                    icon={<Mail className="h-10 w-10" />}
                    title="No mailboxes yet"
                    description="Create your first mailbox account on one of your domains."
                    action={
                        <Button asChild>
                            <Link href="/dashboard/mailbox/admin/accounts">
                                Create a mailbox
                            </Link>
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {accounts.map((account) => {
                        const id = account._id!;
                        const email = account.emailAddress ?? account.localPart;
                        return (
                            <Card key={id}>
                                <ZoruCardHeader>
                                    <ZoruCardTitle className="flex items-center gap-2">
                                        <Mail className="h-4 w-4" />
                                        {account.displayName ?? email}
                                    </ZoruCardTitle>
                                    <ZoruCardDescription>{email}</ZoruCardDescription>
                                </ZoruCardHeader>
                                <ZoruCardContent className="flex gap-2">
                                    <Button asChild size="sm" className="flex-1">
                                        <Link href={`/dashboard/mailbox/${id}/inbox`}>
                                            Open inbox
                                        </Link>
                                    </Button>
                                    <Button asChild size="sm" variant="outline">
                                        <Link href={`/dashboard/mailbox/${id}/compose`}>
                                            Compose
                                        </Link>
                                    </Button>
                                </ZoruCardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
