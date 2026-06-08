import * as React from 'react';
import { notFound } from 'next/navigation';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { getSabmonitorApiTransaction } from '@/app/actions/sabmonitor.actions';
import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageActions,
} from '@/components/sabcrm/20ui';
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
        <div className="flex max-w-[820px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageEyebrow>API transaction</PageEyebrow>
                    <PageTitle>{txn.name}</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/api-transactions"
                        className="u-btn u-btn--ghost u-btn--md"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        <span className="u-btn__label">Back to transactions</span>
                    </Link>
                </PageActions>
            </PageHeader>
            <ApiTransactionEditClient id={txnId} initialName={txn.name} initialSteps={txn.stepsJson} />
        </div>
    );
}
