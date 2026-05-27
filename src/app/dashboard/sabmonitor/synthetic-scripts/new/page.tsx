'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { JsonEditorForm } from '../../_components/json-editor-form';

import { createSabmonitorSyntheticScript } from '@/app/actions/sabmonitor.actions';

export default function NewSyntheticScriptPage(): React.JSX.Element {
    const router = useRouter();
    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zoru-ink">New synthetic script</h2>
            <JsonEditorForm
                showScreenshotSwitch
                submitLabel="Create script"
                onSubmit={async ({ name, stepsJson, screenshotOnFailure }) => {
                    await createSabmonitorSyntheticScript({
                        name,
                        stepsJson,
                        screenshotOnFailure: screenshotOnFailure ?? false,
                    });
                    router.push('/dashboard/sabmonitor/synthetic-scripts');
                }}
            />
        </div>
    );
}
