'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { JsonEditorForm } from '../../_components/json-editor-form';

import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

import { createSabmonitorApiTransaction } from '@/app/actions/sabmonitor.actions';

export default function NewApiTransactionPage(): React.JSX.Element {
    const router = useRouter();
    return (
        <div className="flex max-w-[820px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>New API transaction</PageTitle>
                    <PageDescription>
                        Name the flow and define its ordered JSON steps. Each step is one HTTP
                        request in the journey.
                    </PageDescription>
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
            <JsonEditorForm
                submitLabel="Create transaction"
                onSubmit={async ({ name, stepsJson }) => {
                    await createSabmonitorApiTransaction({ name, stepsJson });
                    router.push('/dashboard/sabmonitor/api-transactions');
                }}
            />
        </div>
    );
}
