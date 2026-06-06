import * as React from 'react';
import { notFound } from 'next/navigation';

import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
} from '@/components/sabcrm/20ui';

import { getSabmonitorSyntheticScript } from '@/app/actions/sabmonitor.actions';
import { SyntheticScriptEditClient } from './edit-client';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ scriptId: string }>;
}

export default async function EditSyntheticScriptPage({
    params,
}: PageProps): Promise<React.JSX.Element> {
    const { scriptId } = await params;
    const script = await getSabmonitorSyntheticScript(scriptId);
    if (!script) notFound();
    return (
        <div className="flex flex-col gap-4">
            <PageHeader compact bordered={false} className="p-0">
                <PageHeaderHeading>
                    <PageTitle>{script.name}</PageTitle>
                </PageHeaderHeading>
            </PageHeader>
            <SyntheticScriptEditClient
                id={scriptId}
                initialName={script.name}
                initialSteps={script.stepsJson}
                initialScreenshotOnFailure={script.screenshotOnFailure}
            />
        </div>
    );
}
