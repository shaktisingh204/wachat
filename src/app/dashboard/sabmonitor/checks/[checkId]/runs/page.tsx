import * as React from 'react';
import Link from 'next/link';

import { Card, CardContent } from '@/components/zoruui';

import { listSabmonitorCheckRuns } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../../../_components/status-badge';
import { ResponseTimeChart } from '../../../_components/response-time-chart';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ checkId: string }>;
}

export default async function CheckRunsPage({ params }: PageProps): Promise<React.JSX.Element> {
    const { checkId } = await params;
    const runs = await listSabmonitorCheckRuns({ checkId, limit: 200 });

    // Ascending for the chart.
    const ascending = [...runs.items].reverse();

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zoru-ink">Recent runs</h2>
                <Link
                    className="text-[12px] text-zoru-brand hover:underline"
                    href={`/dashboard/sabmonitor/checks/${checkId}`}
                >
                    Back to check
                </Link>
            </div>
            <Card className="zoruui">
                <CardContent className="p-4">
                    <ResponseTimeChart
                        points={ascending.map((r) => ({
                            ts: r.ts,
                            ms: r.responseMs,
                            status: r.status,
                        }))}
                    />
                </CardContent>
            </Card>
            <Card className="zoruui">
                <CardContent className="p-0">
                    {runs.items.length === 0 ? (
                        <p className="p-4 text-sm text-zoru-ink-muted">
                            No runs yet — click <span className="font-medium">Run now</span> to
                            collect a first sample.
                        </p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                <tr className="border-b border-zoru-line">
                                    <th className="p-3 text-left font-medium">Time</th>
                                    <th className="p-3 text-left font-medium">Region</th>
                                    <th className="p-3 text-left font-medium">Status</th>
                                    <th className="p-3 text-right font-medium">Response (ms)</th>
                                    <th className="p-3 text-right font-medium">HTTP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.items.map((r) => (
                                    <tr key={r._id} className="border-b border-zoru-line">
                                        <td className="p-3 text-zoru-ink-muted">
                                            {new Date(r.ts).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-zoru-ink-muted">{r.probeRegion}</td>
                                        <td className="p-3">
                                            <StatusBadge status={r.status} />
                                        </td>
                                        <td className="p-3 text-right text-zoru-ink-muted">
                                            {r.responseMs}
                                        </td>
                                        <td className="p-3 text-right text-zoru-ink-muted">
                                            {r.httpStatusCode ?? '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
