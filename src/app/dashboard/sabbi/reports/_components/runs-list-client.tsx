'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, Badge, Button } from '@/components/sabcrm/20ui/compat';
import { bulkDeleteOldRuns } from '@/app/actions/crm-reports.actions';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from 'recharts';

interface RunItem {
    _id: string;
    status: string;
    trigger: string;
    startedAt: string;
    finishedAt?: string | null;
    rowCount?: number;
    delivered?: any;
}

interface RunsListClientProps {
    definitionId: string;
    runs: RunItem[];
}

function fmtDate(d: string | Date | undefined | null): string {
    if (!d) return '—';
    const x = typeof d === 'string' ? new Date(d) : d;
    if (!(x instanceof Date) || isNaN(x.getTime())) return '—';
    return x.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function durationMs(start: string | Date | undefined, end: string | Date | null | undefined): string {
    if (!start || !end) return '—';
    const a = typeof start === 'string' ? new Date(start) : start;
    const b = typeof end === 'string' ? new Date(end) : end;
    if (!(a instanceof Date) || !(b instanceof Date)) return '—';
    const ms = b.getTime() - a.getTime();
    if (!Number.isFinite(ms) || ms < 0) return '—';
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
    return `${(ms / 60_000).toFixed(1)} min`;
}

export function RunsListClient({ definitionId, runs }: RunsListClientProps) {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const { toast } = useZoruToast();
    const router = useRouter();

    const handleDeleteOld = async () => {
        if (!confirm('Are you sure you want to delete runs older than 30 days?')) return;
        setIsDeleting(true);
        const res = await bulkDeleteOldRuns(definitionId, 30);
        setIsDeleting(false);
        if (res.success) {
            toast({ title: 'Success', description: `Deleted ${res.deletedCount} old runs.` });
            router.refresh();
        } else {
            toast({ title: 'Error', description: res.error || 'Failed to delete runs', variant: 'destructive' });
        }
    };

    // Prepare chart data (reverse for chronological order)
    const chartData = React.useMemo(() => {
        return runs
            .map((r) => {
                const d = new Date(r.startedAt);
                const dateStr = isNaN(d.getTime())
                    ? '—'
                    : new Intl.DateTimeFormat('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        timeZone: 'UTC'
                      }).format(d);
                return {
                    date: dateStr,
                    rows: r.rowCount || 0,
                };
            })
            .reverse();
    }, [runs]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={handleDeleteOld} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Bulk Delete Old Runs (>30 days)'}
                </Button>
            </div>

            {chartData.length > 1 && (
                <Card className="p-4">
                    <h3 className="mb-2 text-sm font-medium text-[var(--st-text)]">Row Count Over Time</h3>
                    <div className="h-[120px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <Line type="monotone" dataKey="rows" stroke="#8884d8" strokeWidth={2} dot={false} />
                                <XAxis dataKey="date" hide />
                                <RechartsTooltip 
                                    contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid var(--st-border)' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left text-[var(--st-text-secondary)] border-b border-[var(--st-border)]/50">
                            <tr>
                                <th className="px-3 py-2 font-medium">Started</th>
                                <th className="px-3 py-2 font-medium">Status</th>
                                <th className="px-3 py-2 font-medium">Trigger</th>
                                <th className="px-3 py-2 font-medium">Rows</th>
                                <th className="px-3 py-2 font-medium">Duration</th>
                                <th className="px-3 py-2 font-medium">Delivery</th>
                                <th className="px-3 py-2 font-medium" />
                            </tr>
                        </thead>
                        <tbody>
                            {runs.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-6 text-center text-[var(--st-text-secondary)]">
                                        No runs yet. Trigger one from the report page.
                                    </td>
                                </tr>
                            )}
                            {runs.map((r) => {
                                const tone: 'success' | 'destructive' | 'default' =
                                    r.status === 'succeeded'
                                        ? 'success'
                                        : r.status === 'failed'
                                          ? 'destructive'
                                          : 'default';
                                const emailOk = r.delivered?.email?.ok ?? null;
                                const webhookOk = r.delivered?.webhook?.ok ?? null;
                                return (
                                    <tr key={r._id} className="border-b border-[var(--st-border)]/50 last:border-0 hover:bg-[var(--st-bg-muted)]/50">
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {fmtDate(r.startedAt)}
                                        </td>
                                        <td className="px-3 py-2">
                                            <Badge variant={tone}>{r.status}</Badge>
                                        </td>
                                        <td className="px-3 py-2 text-[var(--st-text-secondary)]">
                                            {r.trigger}
                                        </td>
                                        <td className="px-3 py-2 font-mono">{r.rowCount ?? 0}</td>
                                        <td className="px-3 py-2 text-[var(--st-text-secondary)]">
                                            {durationMs(r.startedAt, r.finishedAt)}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-[var(--st-text-secondary)]">
                                            {emailOk === null ? '—' : emailOk ? 'email ok' : 'email fail'}
                                            {' · '}
                                            {webhookOk === null ? '—' : webhookOk ? 'webhook ok' : 'webhook fail'}
                                        </td>
                                        <td className="px-3 py-2">
                                            <Link
                                                href={`/dashboard/sabbi/reports/${definitionId}/runs/${r._id}`}
                                                className="text-xs font-medium text-[var(--st-text)] hover:underline"
                                            >
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
