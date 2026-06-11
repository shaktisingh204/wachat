/**
 * `/dashboard/sabrequests/*` layout.
 *
 * Section navigation lives in the app sidebar (20ui shell
 * `SABREQUESTS_SIDEBAR`). 20ui tokens resolve app-wide at `:root`, so no
 * scope provider is needed.
 */
import * as React from 'react';

export default function RequestsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="20ui flex min-h-full flex-col antialiased">
            {children}
        </div>
    );
}
