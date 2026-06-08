import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
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
        <div className="20ui flex flex-col gap-4 p-4 md:p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Reliability, Observability</PageEyebrow>
                    <PageTitle>SabMonitor</PageTitle>
                    <PageDescription>
                        Synthetic monitoring and APM. Probe public endpoints, run scripted
                        transactions, and trace internal service spans, all in one place.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/checks/new"
                        className="u-btn u-btn--primary u-btn--md"
                    >
                        <Plus size={14} aria-hidden="true" />
                        <span className="u-btn__label">New monitor</span>
                    </Link>
                </PageActions>
            </PageHeader>
            <SabmonitorNav />
            <div>{children}</div>
        </div>
    );
}
