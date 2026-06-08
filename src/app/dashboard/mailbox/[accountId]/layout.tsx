import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Inbox, PencilLine, Filter, Users } from 'lucide-react';

import { getMailAccount } from '@/app/actions/mailbox.actions';

/**
 * Account-scoped shell for `/dashboard/mailbox/[accountId]/*`.
 *
 * Resolves the account once, fails to a 404 when unknown, then renders a
 * sticky local nav (segmented ghost links per the 20ui policy). Link controls
 * carry the canonical `u-btn` ghost classes so navigation stays a real anchor
 * (Button does not support `asChild`), while the styling matches the system.
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
        <div className="20ui flex min-h-full flex-col">
            <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg)]/95 px-4 py-3 backdrop-blur">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/mailbox" className="u-btn u-btn--ghost u-btn--sm">
                        <ArrowLeft size={13} aria-hidden="true" />
                        <span className="u-btn__label">Mailbox</span>
                    </Link>
                    <span className="text-sm font-medium text-[var(--st-text)]">
                        {account.displayName ?? email}
                    </span>
                    <span className="text-xs text-[var(--st-text-secondary)]">{email}</span>
                </div>
                <nav className="flex flex-wrap gap-1">
                    {links.map((l) => (
                        <Link
                            key={l.href}
                            href={l.href}
                            className="u-btn u-btn--ghost u-btn--sm"
                        >
                            <l.icon size={13} aria-hidden="true" />
                            <span className="u-btn__label">{l.label}</span>
                        </Link>
                    ))}
                </nav>
            </header>
            <div className="flex-1">{children}</div>
        </div>
    );
}
