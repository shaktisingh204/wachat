import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListChecks } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

import { getSabmonitorCheck } from '@/app/actions/sabmonitor.actions';
import { CheckForm } from '../../_components/check-form';
import { RunNowButton } from '../../_components/run-now-button';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ checkId: string }>;
}

export default async function SabmonitorCheckDetailPage({
    params,
}: PageProps): Promise<React.JSX.Element> {
    const { checkId } = await params;
    const check = await getSabmonitorCheck(checkId);
    if (!check) notFound();
    return (
        <div className="ui20 flex flex-col gap-4">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>{check.name}</PageTitle>
                    <PageDescription>
                        {check.kind} · {check.url ?? check.host ?? '-'}
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <RunNowButton checkId={checkId} />
                    {/* 20ui Button has no `asChild`, so a navigational link is
                        styled directly with the button classes (outline / md). */}
                    <Link
                        href={`/dashboard/sabmonitor/checks/${checkId}/runs`}
                        className="u-btn u-btn--outline u-btn--md"
                    >
                        <ListChecks size={14} aria-hidden="true" />
                        <span className="u-btn__label">View runs</span>
                    </Link>
                </PageActions>
            </PageHeader>
            <CheckForm initial={check} />
        </div>
    );
}
