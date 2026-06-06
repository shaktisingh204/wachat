import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui/compat';

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
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-semibold text-zoru-ink">{check.name}</h2>
                    <span className="text-[12px] text-zoru-ink-muted">
                        {check.kind} · {check.url ?? check.host ?? '—'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <RunNowButton checkId={checkId} />
                    <Button variant="outline" asChild>
                        <Link href={`/dashboard/sabmonitor/checks/${checkId}/runs`}>
                            View runs
                        </Link>
                    </Button>
                </div>
            </div>
            <CheckForm initial={check} />
        </div>
    );
}
