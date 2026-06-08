import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    ArrowLeft,
    Timer,
    Layers,
    Server,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
} from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    StatCard,
    Separator,
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
    const serviceCount = new Set(spans.items.map((s) => s.service)).size;

    return (
        <div className="flex max-w-[1200px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageEyebrow>Trace</PageEyebrow>
                    <PageTitle>
                        <span className="font-mono text-[13px] break-all">{traceId}</span>
                    </PageTitle>
                    <PageDescription>
                        {rootService} · {rootOperation}
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabmonitor/apm/traces"
                        className="u-btn u-btn--ghost u-btn--md"
                    >
                        <ArrowLeft size={14} aria-hidden="true" />
                        <span className="u-btn__label">Back to traces</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Duration"
                    value={
                        <span className="tabular-nums">
                            {trace.durationMs}
                            <span className="ml-0.5 text-[13px] font-normal text-[var(--st-text-secondary)]">
                                ms
                            </span>
                        </span>
                    }
                    icon={<Timer aria-hidden="true" />}
                    accent="#3b7af5"
                />
                <StatCard
                    label="Spans"
                    value={<span className="tabular-nums">{trace.spanCount}</span>}
                    icon={<Layers aria-hidden="true" />}
                    accent="#7c3aed"
                />
                <StatCard
                    label="Services"
                    value={<span className="tabular-nums">{serviceCount}</span>}
                    icon={<Server aria-hidden="true" />}
                />
                <StatCard
                    label="Result"
                    value={trace.errored ? 'Error' : 'OK'}
                    icon={
                        trace.errored ? (
                            <AlertTriangle aria-hidden="true" />
                        ) : (
                            <CheckCircle2 aria-hidden="true" />
                        )
                    }
                    accent={trace.errored ? '#dc2626' : '#1f9d55'}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <GitBranch
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Span waterfall
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody>
                    <TraceWaterfall spans={spans.items} />
                </CardBody>
            </Card>
        </div>
    );
}
