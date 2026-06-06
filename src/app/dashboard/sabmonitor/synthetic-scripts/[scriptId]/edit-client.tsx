'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

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
        <div className="flex flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabMonitor</PageEyebrow>
                    <PageTitle>Edit synthetic script</PageTitle>
                    <PageDescription>
                        Update the script name, its JSON steps, and screenshot
                        behavior. Changes apply to the next scheduled run.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
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
        </div>
    );
}
