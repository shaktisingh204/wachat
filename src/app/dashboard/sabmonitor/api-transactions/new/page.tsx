'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { JsonEditorForm } from '../../_components/json-editor-form';

import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

import { createSabmonitorApiTransaction } from '@/app/actions/sabmonitor.actions';

export default function NewApiTransactionPage(): React.JSX.Element {
    const router = useRouter();
    return (
        <div className="flex flex-col gap-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>New API transaction</PageTitle>
                    <PageDescription>
                        Define a name and the ordered JSON steps for this synthetic API check.
                    </PageDescription>
                </PageHeaderHeading>
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
