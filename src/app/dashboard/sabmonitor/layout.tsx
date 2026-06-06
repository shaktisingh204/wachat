import * as React from 'react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

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
        <div className="ui20 flex flex-col gap-4 p-4 md:p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Reliability, Observability</PageEyebrow>
                    <PageTitle>SabMonitor</PageTitle>
                    <PageDescription>
                        Synthetic monitoring and APM. Probe public endpoints, run scripted
                        transactions, and trace internal service spans, all in one place.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <SabmonitorNav />
            <div>{children}</div>
        </div>
    );
}
