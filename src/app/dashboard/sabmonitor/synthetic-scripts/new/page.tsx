'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { JsonEditorForm } from '../../_components/json-editor-form';

import { createSabmonitorSyntheticScript } from '@/app/actions/sabmonitor.actions';
import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

export default function NewSyntheticScriptPage(): React.JSX.Element {
    const router = useRouter();
    return (
        <div className="flex max-w-[820px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>New synthetic script</PageTitle>
                    <PageDescription>
                        Define the browser steps your monitor runs, then create the script.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/synthetic-scripts"
                        className="u-btn u-btn--ghost u-btn--md"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        <span className="u-btn__label">Back to scripts</span>
                    </Link>
                </PageActions>
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
