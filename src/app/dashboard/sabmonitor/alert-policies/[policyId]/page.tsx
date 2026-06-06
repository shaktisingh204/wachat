import * as React from 'react';
import { notFound } from 'next/navigation';

import { getSabmonitorAlertPolicy } from '@/app/actions/sabmonitor.actions';
import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
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
        <div className="flex flex-col gap-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Alert policy</PageEyebrow>
                    <PageTitle>{policy.name}</PageTitle>
                </PageHeaderHeading>
            </PageHeader>
            <AlertPolicyForm initial={policy} />
        </div>
    );
}
