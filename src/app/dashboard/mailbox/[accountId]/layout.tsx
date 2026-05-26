import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Inbox, PencilLine, Filter, Users } from 'lucide-react';

import { getMailAccount } from '@/app/actions/mailbox.actions';
import { Button } from '@/components/zoruui';

/**
 * Account-scoped shell for `/dashboard/mailbox/[accountId]/*`.
 *
 * Resolves the account once, fails to a 404 when unknown, then renders a
 * sticky local nav (no tab UI — segmented buttons per the ZoruUI policy).
 */
export default async function MailboxAccountLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ accountId: string }>;
}) {
    const { accountId } = await params;
    const account = await getMailAccount(accountId);
    if (!account) {
        notFound();
    }

    const email = account.emailAddress ?? account.localPart;
    const links = [
        { href: `/dashboard/mailbox/${accountId}/inbox`, label: 'Inbox', icon: Inbox },
        { href: `/dashboard/mailbox/${accountId}/compose`, label: 'Compose', icon: PencilLine },
        { href: `/dashboard/mailbox/${accountId}/rules`, label: 'Rules', icon: Filter },
        { href: `/dashboard/mailbox/${accountId}/contacts`, label: 'Contacts', icon: Users },
    ];

    return (
        <div className="zoruui flex min-h-full flex-col">
            <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line bg-zoru-bg/95 px-4 py-3 backdrop-blur">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/dashboard/mailbox">
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Mailbox
                        </Link>
                    </Button>
                    <span className="text-sm font-medium text-zoru-ink">
                        {account.displayName ?? email}
                    </span>
                    <span className="text-xs text-zoru-ink-muted">{email}</span>
                </div>
                <nav className="flex flex-wrap gap-1">
                    {links.map((l) => (
                        <Button key={l.href} asChild variant="ghost" size="sm">
                            <Link href={l.href}>
                                <l.icon className="mr-1 h-4 w-4" />
                                {l.label}
                            </Link>
                        </Button>
                    ))}
                </nav>
            </header>
            <div className="flex-1">{children}</div>
        </div>
    );
}
