/**
 * /portal/support layout — customer self-service helpdesk shell.
 *
 * Authentication boundary: portal session required (not staff session).
 * If no session, redirect to `/login?return=/portal/support`. Anyone with
 * a session can use the support surface (it is by design open to all
 * authenticated users, including clients), but the requester scoping in
 * `listSupportTicketsForRequester` ensures users only see their own
 * tickets.
 */

export const dynamic = 'force-dynamic';

import 'server-only';
import '@/styles/zoruui.css';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/app/actions/user.actions';

export default async function SupportPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login?return=/portal/support');
  }

  return (
    <div className="zoruui min-h-screen bg-[var(--st-bg)] text-[var(--st-text)]">
      <header className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link
            href="/portal/support"
            className="text-[15px] font-semibold tracking-tight"
          >
            Help &amp; Support
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-[var(--st-text-secondary)]">
            <Link href="/portal/support" className="hover:text-[var(--st-text)]">My tickets</Link>
            <Link href="/portal/support/kb" className="hover:text-[var(--st-text)]">Knowledge base</Link>
            <Link href="/portal/support/new" className="hover:text-[var(--st-text)]">New request</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
