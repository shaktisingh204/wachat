'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { JsonEditorForm } from '../../_components/json-editor-form';

import { createSabmonitorApiTransaction } from '@/app/actions/sabmonitor.actions';

export default function NewApiTransactionPage(): React.JSX.Element {
    const router = useRouter();
    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zoru-ink">New API transaction</h2>
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
