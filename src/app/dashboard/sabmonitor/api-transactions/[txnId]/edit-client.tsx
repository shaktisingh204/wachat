'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { JsonEditorForm } from '../../_components/json-editor-form';
import { updateSabmonitorApiTransaction } from '@/app/actions/sabmonitor.actions';

export function ApiTransactionEditClient({
    id,
    initialName,
    initialSteps,
}: {
    id: string;
    initialName: string;
    initialSteps: unknown;
}): React.JSX.Element {
    const router = useRouter();
    return (
        <JsonEditorForm
            initialName={initialName}
            initialSteps={initialSteps}
            submitLabel="Save transaction"
            onSubmit={async ({ name, stepsJson }) => {
                await updateSabmonitorApiTransaction(id, { name, stepsJson });
                router.push('/dashboard/sabmonitor/api-transactions');
            }}
        />
    );
}
