import * as React from 'react';
import { notFound } from 'next/navigation';

import {
    Card,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';

import {
    getSabmonitorTrace,
    listSabmonitorTraceSpans,
} from '@/app/actions/sabmonitor.actions';
import { TraceWaterfall } from '../../../_components/trace-waterfall';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ traceId: string }>;
}

export default async function TraceDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
    const { traceId } = await params;
    const [trace, spans] = await Promise.all([
        getSabmonitorTrace(traceId),
        listSabmonitorTraceSpans({ traceId, limit: 2000 }),
    ]);
    if (!trace) notFound();

    const rootService = trace.rootService ?? 'unknown';
    const rootOperation = trace.rootOperation ?? 'unknown';

    return (
        <div className="flex flex-col gap-4">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageEyebrow>Trace</PageEyebrow>
                    <PageTitle>
                        <span className="font-mono text-[13px] break-all">{traceId}</span>
                    </PageTitle>
                    <PageDescription>
                        {rootService}, {rootOperation}, {trace.durationMs}ms, {trace.spanCount} spans
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <Card>
                <CardBody className="p-4">
                    <TraceWaterfall spans={spans.items} />
                </CardBody>
            </Card>
        </div>
    );
}
