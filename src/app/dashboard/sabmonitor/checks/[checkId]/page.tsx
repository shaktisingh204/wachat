import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListChecks, Clock, MapPin } from 'lucide-react';

import {
    Card,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Badge,
} from '@/components/sabcrm/20ui';

import { getSabmonitorCheck } from '@/app/actions/sabmonitor.actions';
import { CheckForm } from '../../_components/check-form';
import { RunNowButton } from '../../_components/run-now-button';
import { StatusBadge } from '../../_components/status-badge';

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
        <div className="flex max-w-[760px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>{check.name}</PageTitle>
                    <PageDescription>
                        <span className="uppercase tracking-wide">{check.kind}</span> ·{' '}
                        {check.url ?? check.host ?? 'No target'}
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

            <Card>
                <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                            Last status
                        </span>
                        <StatusBadge status={check.lastStatus ?? 'unknown'} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] text-[var(--st-text-secondary)]">State</span>
                        <Badge
                            tone={check.status === 'active' ? 'success' : 'neutral'}
                            kind="soft"
                        >
                            {check.status}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[13px] text-[var(--st-text-secondary)]">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="tabular-nums">{check.intervalSecs}s</span> interval
                    </div>
                    {check.regions && check.regions.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[13px] text-[var(--st-text-secondary)]">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            {check.regions.join(', ')}
                        </div>
                    )}
                </CardBody>
            </Card>

            <CheckForm initial={check} />
        </div>
    );
}
