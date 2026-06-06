import * as React from 'react';
import { notFound } from 'next/navigation';

import { getSabmonitorAlertPolicy } from '@/app/actions/sabmonitor.actions';
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
            <h2 className="text-sm font-semibold text-[var(--st-text)]">{policy.name}</h2>
            <AlertPolicyForm initial={policy} />
        </div>
    );
}
