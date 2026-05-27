import * as React from 'react';

import { SabmonitorNav } from './_components/sabmonitor-nav';

/**
 * SabMonitor module shell. Sub-nav per major surface (overview, checks,
 * incidents, alert policies, status pages, scripts, transactions, APM,
 * probes).
 */
export default function SabmonitorLayout({
    children,
}: {
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <div className="zoruui flex flex-col gap-4 p-4 md:p-6">
            <header className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                    Reliability · Observability
                </p>
                <h1 className="text-2xl font-semibold text-zoru-ink">SabMonitor</h1>
                <p className="max-w-2xl text-sm text-zoru-ink-muted">
                    Synthetic monitoring + APM. Probe public endpoints, run scripted
                    transactions, and trace internal service spans — all in one place.
                </p>
            </header>
            <SabmonitorNav />
            <div>{children}</div>
        </div>
    );
}
