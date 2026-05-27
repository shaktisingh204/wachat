'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { JsonEditorForm } from '../../_components/json-editor-form';
import { updateSabmonitorSyntheticScript } from '@/app/actions/sabmonitor.actions';

export function SyntheticScriptEditClient({
    id,
    initialName,
    initialSteps,
    initialScreenshotOnFailure,
}: {
    id: string;
    initialName: string;
    initialSteps: unknown;
    initialScreenshotOnFailure: boolean;
}): React.JSX.Element {
    const router = useRouter();
    return (
        <JsonEditorForm
            initialName={initialName}
            initialSteps={initialSteps}
            initialScreenshotOnFailure={initialScreenshotOnFailure}
            showScreenshotSwitch
            submitLabel="Save script"
            onSubmit={async ({ name, stepsJson, screenshotOnFailure }) => {
                await updateSabmonitorSyntheticScript(id, {
                    name,
                    stepsJson,
                    screenshotOnFailure,
                });
                router.push('/dashboard/sabmonitor/synthetic-scripts');
            }}
        />
    );
}
