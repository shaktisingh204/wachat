'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { JsonEditorForm } from '../../_components/json-editor-form';

import { createSabmonitorSyntheticScript } from '@/app/actions/sabmonitor.actions';
import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

export default function NewSyntheticScriptPage(): React.JSX.Element {
    const router = useRouter();
    return (
        <div className="flex flex-col gap-4">
            <PageHeader compact bordered={false}>
                <PageHeaderHeading>
                    <PageEyebrow>SabMonitor</PageEyebrow>
                    <PageTitle>New synthetic script</PageTitle>
                    <PageDescription>
                        Define the steps your monitor runs, then create the script.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
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
