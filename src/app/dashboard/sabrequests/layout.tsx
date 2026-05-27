/**
 * `/dashboard/sabrequests/*` layout — provides ZoruUI scope + a SabRequests subnav.
 */
import * as React from 'react';
import Link from 'next/link';

import { ZoruProvider } from '@/components/zoruui';

export default function RequestsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ZoruProvider>
            <div className="zoruui flex flex-col">
                <nav className="flex gap-4 border-b border-zoru-line px-6 py-2 text-sm">
                    <Link
                        href="/dashboard/sabrequests"
                        className="hover:underline"
                    >
                        Inbox
                    </Link>
                    <Link
                        href="/dashboard/sabrequests/new"
                        className="hover:underline"
                    >
                        New request
                    </Link>
                    <Link
                        href="/dashboard/sabrequests/blueprints"
                        className="hover:underline"
                    >
                        Blueprints
                    </Link>
                    <Link
                        href="/dashboard/sabrequests/analytics"
                        className="hover:underline"
                    >
                        Analytics
                    </Link>
                </nav>
                {children}
            </div>
        </ZoruProvider>
    );
}
