import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

import { CheckForm } from '../../_components/check-form';

export default function NewSabmonitorCheckPage(): React.JSX.Element {
    return (
        <div className="flex max-w-[760px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>New monitor</PageTitle>
                    <PageDescription>
                        Configure an uptime, SSL, or synthetic monitor. SabMonitor probes the
                        target on your schedule and opens an incident when it fails.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/checks"
                        className="u-btn u-btn--ghost u-btn--md"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        <span className="u-btn__label">Back to monitors</span>
                    </Link>
                </PageActions>
            </PageHeader>
            <CheckForm />
        </div>
    );
}
