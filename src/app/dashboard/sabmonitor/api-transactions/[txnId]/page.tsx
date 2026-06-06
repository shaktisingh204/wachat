import * as React from 'react';
import { notFound } from 'next/navigation';

import { getSabmonitorApiTransaction } from '@/app/actions/sabmonitor.actions';
import { PageHeader, PageHeaderHeading, PageEyebrow, PageTitle } from '@/components/sabcrm/20ui';
import { ApiTransactionEditClient } from './edit-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ txnId: string }>;
}

export default async function EditApiTxnPage({ params }: PageProps): Promise<React.JSX.Element> {
    const { txnId } = await params;
    const txn = await getSabmonitorApiTransaction(txnId);
    if (!txn) notFound();
    return (
        <div className="flex flex-col gap-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>API transaction</PageEyebrow>
                    <PageTitle>{txn.name}</PageTitle>
                </PageHeaderHeading>
            </PageHeader>
            <ApiTransactionEditClient id={txnId} initialName={txn.name} initialSteps={txn.stepsJson} />
        </div>
    );
}
