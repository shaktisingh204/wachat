/**
 * `/dashboard/sabrequests/*` layout - provides a SabRequests subnav.
 *
 * 20ui tokens resolve app-wide at `:root`, so no scope provider is needed.
 */
import * as React from 'react';
import Link from 'next/link';

export default function RequestsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-full flex-col antialiased">
            <nav className="flex gap-4 border-b border-[var(--st-border)] px-6 py-2 text-sm text-[var(--st-text-secondary)]">
                <Link
                    href="/dashboard/sabrequests"
                    className="hover:text-[var(--st-text)] hover:underline"
                >
                    Inbox
                </Link>
                <Link
                    href="/dashboard/sabrequests/new"
                    className="hover:text-[var(--st-text)] hover:underline"
                >
                    New request
                </Link>
                <Link
                    href="/dashboard/sabrequests/blueprints"
                    className="hover:text-[var(--st-text)] hover:underline"
                >
                    Blueprints
                </Link>
                <Link
                    href="/dashboard/sabrequests/analytics"
                    className="hover:text-[var(--st-text)] hover:underline"
                >
                    Analytics
                </Link>
            </nav>
            {children}
        </div>
    );
}
