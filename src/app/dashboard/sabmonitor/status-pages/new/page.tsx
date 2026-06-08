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

import { StatusPageForm } from '../../_components/status-page-form';

export default function NewStatusPagePage(): React.JSX.Element {
    return (
        <div className="flex max-w-[760px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>New status page</PageTitle>
                    <PageDescription>
                        Publish a public page that shows the live health of the monitors you
                        choose.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/status-pages"
                        className="u-btn u-btn--ghost u-btn--md"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        <span className="u-btn__label">Back to status pages</span>
                    </Link>
                </PageActions>
            </PageHeader>
            <StatusPageForm />
        </div>
    );
}
