import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { getSabmonitorAlertPolicy } from '@/app/actions/sabmonitor.actions';
import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageActions,
} from '@/components/sabcrm/20ui';
import { AlertPolicyForm } from '../../_components/alert-policy-form';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ policyId: string }>;
}

export default async function EditAlertPolicyPage({
    params,
}: PageProps): Promise<React.JSX.Element> {
    const { policyId } = await params;
    const policy = await getSabmonitorAlertPolicy(policyId);
    if (!policy) notFound();
    return (
        <div className="flex max-w-[760px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageEyebrow>Alert policy</PageEyebrow>
                    <PageTitle>{policy.name}</PageTitle>
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
            <AlertPolicyForm initial={policy} />
        </div>
    );
}
