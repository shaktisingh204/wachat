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

import { AlertPolicyForm } from '../../_components/alert-policy-form';

export default function NewAlertPolicyPage(): React.JSX.Element {
    return (
        <div className="flex max-w-[760px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>New alert policy</PageTitle>
                    <PageDescription>
                        Choose which monitors to watch, the failure conditions, and where alerts
                        are delivered.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/alert-policies"
                        className="u-btn u-btn--ghost u-btn--md"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        <span className="u-btn__label">Back to policies</span>
                    </Link>
                </PageActions>
            </PageHeader>
            <AlertPolicyForm />
        </div>
    );
}
