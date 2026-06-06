import * as React from 'react';
import { notFound } from 'next/navigation';

import { Card, CardContent } from '@/components/sabcrm/20ui/compat';

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
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-zoru-ink">
                    Trace <span className="font-mono text-[12px]">{traceId}</span>
                </h2>
                <span className="text-[12px] text-zoru-ink-muted">
                    {trace.rootService ?? '—'} · {trace.rootOperation ?? '—'} · {trace.durationMs}ms ·{' '}
                    {trace.spanCount} spans
                </span>
            </div>
            <Card className="zoruui">
                <CardContent className="p-4">
                    <TraceWaterfall spans={spans.items} />
                </CardContent>
            </Card>
        </div>
    );
}
