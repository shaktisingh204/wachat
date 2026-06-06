import * as React from 'react';
import Link from 'next/link';

import { Button, Card, CardBody } from '@/components/sabcrm/20ui';
import { listSabmonitorChecks, listSabmonitorCheckRuns } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function SabmonitorChecksPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorChecks({ status: 'all', limit: 50 });

    // Cheap uptime estimate — for each check, sample last 200 runs and
    // count up. Real impl will pre-aggregate.
    const uptimeByCheck: Record<string, number> = {};
    await Promise.all(
        res.items.map(async (c) => {
            if (!c._id) return;
            try {
                const runs = await listSabmonitorCheckRuns({ checkId: c._id, limit: 200 });
                if (runs.items.length === 0) {
                    uptimeByCheck[c._id] = 0;
                    return;
                }
                const ups = runs.items.filter((r) => r.status === 'up').length;
                uptimeByCheck[c._id] = (ups / runs.items.length) * 100;
            } catch {
                uptimeByCheck[c._id] = 0;
            }
        }),
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">Checks</h2>
                <Button asChild>
                    <Link href="/dashboard/sabmonitor/checks/new">New check</Link>
                </Button>
            </div>
            <Card className="zoruui">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-[var(--st-text-secondary)]">No checks yet.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                <tr className="border-b border-[var(--st-border)]">
                                    <th className="p-3 text-left font-medium">Name</th>
                                    <th className="p-3 text-left font-medium">Kind</th>
                                    <th className="p-3 text-left font-medium">Target</th>
                                    <th className="p-3 text-left font-medium">Last status</th>
                                    <th className="p-3 text-left font-medium">Uptime</th>
                                </tr>
                            </thead>
                            <tbody>
                                {res.items.map((c) => (
                                    <tr key={c._id} className="border-b border-[var(--st-border)]">
                                        <td className="p-3">
                                            <Link
                                                className="font-medium text-[var(--st-text)] hover:underline"
                                                href={`/dashboard/sabmonitor/checks/${c._id}`}
                                            >
                                                {c.name}
                                            </Link>
                                        </td>
                                        <td className="p-3 text-[var(--st-text-secondary)]">{c.kind}</td>
                                        <td className="p-3 text-[var(--st-text-secondary)]">
                                            {c.url ?? c.host ?? '—'}
                                        </td>
                                        <td className="p-3">
                                            <StatusBadge status={c.lastStatus ?? 'unknown'} />
                                        </td>
                                        <td className="p-3 text-[var(--st-text-secondary)]">
                                            {c._id && uptimeByCheck[c._id] !== undefined
                                                ? `${uptimeByCheck[c._id].toFixed(2)}%`
                                                : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
