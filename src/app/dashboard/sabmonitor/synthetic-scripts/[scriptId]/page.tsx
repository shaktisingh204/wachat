import * as React from 'react';
import { notFound } from 'next/navigation';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageActions,
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
        <div className="flex max-w-[820px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageEyebrow>Synthetic script</PageEyebrow>
                    <PageTitle>{script.name}</PageTitle>
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
            <SyntheticScriptEditClient
                id={scriptId}
                initialName={script.name}
                initialSteps={script.stepsJson}
                initialScreenshotOnFailure={script.screenshotOnFailure}
            />
        </div>
    );
}
