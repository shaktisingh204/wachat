'use client';

import * as React from 'react';
import { ArrowRight, Inbox } from 'lucide-react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Badge,
    Button,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
    useToast,
} from '@/components/sabcrm/20ui';
import { bulkDeleteOldRuns } from '@/app/actions/crm-reports.actions';
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
    if (!d) return '-';
    const x = typeof d === 'string' ? new Date(d) : d;
    if (!(x instanceof Date) || isNaN(x.getTime())) return '-';
    return x.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function durationMs(start: string | Date | undefined, end: string | Date | null | undefined): string {
    if (!start || !end) return '-';
    const a = typeof start === 'string' ? new Date(start) : start;
    const b = typeof end === 'string' ? new Date(end) : end;
    if (!(a instanceof Date) || !(b instanceof Date)) return '-';
    const ms = b.getTime() - a.getTime();
    if (!Number.isFinite(ms) || ms < 0) return '-';
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
    return `${(ms / 60_000).toFixed(1)} min`;
}

export function RunsListClient({ definitionId, runs }: RunsListClientProps) {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleDeleteOld = async () => {
        if (!confirm('Are you sure you want to delete runs older than 30 days?')) return;
        setIsDeleting(true);
        const res = await bulkDeleteOldRuns(definitionId, 30);
        setIsDeleting(false);
        if (res.success) {
            toast({ title: 'Success', description: `Deleted ${res.deletedCount} old runs.`, tone: 'success' });
            router.refresh();
        } else {
            toast({ title: 'Error', description: res.error || 'Failed to delete runs', tone: 'danger' });
        }
    };

    // Prepare chart data (reverse for chronological order)
    const chartData = React.useMemo(() => {
        return runs
            .map((r) => {
                const d = new Date(r.startedAt);
                const dateStr = isNaN(d.getTime())
                    ? '-'
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
                <Button variant="outline" size="sm" onClick={handleDeleteOld} loading={isDeleting} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Bulk Delete Old Runs (>30 days)'}
                </Button>
            </div>

            {chartData.length > 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Row Count Over Time</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="h-[120px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <Line type="monotone" dataKey="rows" stroke="var(--st-accent)" strokeWidth={2} dot={false} />
                                    <XAxis dataKey="date" hide />
                                    <RechartsTooltip
                                        contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid var(--st-border)' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardBody>
                </Card>
            )}

            <Card padding="none">
                <div className="overflow-x-auto">
                    <Table>
                        <THead>
                            <Tr>
                                <Th>Started</Th>
                                <Th>Status</Th>
                                <Th>Trigger</Th>
                                <Th>Rows</Th>
                                <Th>Duration</Th>
                                <Th>Delivery</Th>
                                <Th aria-label="Actions" />
                            </Tr>
                        </THead>
                        <TBody>
                            {runs.length === 0 && (
                                <Tr>
                                    <Td colSpan={7}>
                                        <EmptyState
                                            icon={Inbox}
                                            title="No runs yet"
                                            description="Trigger one from the report page."
                                            size="sm"
                                        />
                                    </Td>
                                </Tr>
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
                                    <Tr key={r._id}>
                                        <Td className="font-mono text-xs">
                                            {fmtDate(r.startedAt)}
                                        </Td>
                                        <Td>
                                            <Badge variant={tone}>{r.status}</Badge>
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {r.trigger}
                                        </Td>
                                        <Td className="font-mono">{r.rowCount ?? 0}</Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {durationMs(r.startedAt, r.finishedAt)}
                                        </Td>
                                        <Td className="text-xs text-[var(--st-text-secondary)]">
                                            {emailOk === null ? '-' : emailOk ? 'email ok' : 'email fail'}
                                            {' , '}
                                            {webhookOk === null ? '-' : webhookOk ? 'webhook ok' : 'webhook fail'}
                                        </Td>
                                        <Td align="right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                iconRight={ArrowRight}
                                                onClick={() =>
                                                    router.push(
                                                        `/dashboard/sabbi/reports/${definitionId}/runs/${r._id}`
                                                    )
                                                }
                                            >
                                                View
                                            </Button>
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </TBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
