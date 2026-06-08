/**
 * `/dashboard/sabrequests/*` layout — persistent icon'd subnav.
 *
 * 20ui tokens resolve app-wide at `:root`, so no scope provider is needed.
 */
import * as React from 'react';

import { RequestsSubnav } from './_components/requests-subnav';

export default function RequestsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="20ui flex min-h-full flex-col antialiased">
            <RequestsSubnav />
            {children}
        </div>
    );
}
