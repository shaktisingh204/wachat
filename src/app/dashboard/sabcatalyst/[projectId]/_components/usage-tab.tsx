'use client';

/** Usage tab — monthly aggregates + billing breakdown. */
import React from 'react';

import { Card, EmptyState } from '@/components/zoruui';
import type { SabcatalystUsageRow } from '@/lib/rust-client/sabcatalyst-usage';

interface Props { projectId: string; initialRows: SabcatalystUsageRow[] }

function fmt(n: number) {
    return n.toLocaleString();
}
function gb(b: number) {
    return (b / 1024 / 1024 / 1024).toFixed(2);
}

export function UsageTab({ initialRows }: Props) {
    const [rows] = React.useState(initialRows);
    const latest = rows[0];

    if (!latest) {
        return (
            <EmptyState
                title="No usage yet"
                description="Once your functions run and your datastore writes happen, monthly rollups appear here."
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="p-4">
                    <p className="text-xs text-[var(--zoru-muted-foreground)]">Function invocations</p>
                    <p className="text-3xl font-bold mt-2">{fmt(latest.functionInvocations)}</p>
                </Card>
                <Card className="p-4">
                    <p className="text-xs text-[var(--zoru-muted-foreground)]">Billable ms</p>
                    <p className="text-3xl font-bold mt-2">{fmt(latest.functionBillableMs)}</p>
                </Card>
                <Card className="p-4">
                    <p className="text-xs text-[var(--zoru-muted-foreground)]">Datastore writes</p>
                    <p className="text-3xl font-bold mt-2">{fmt(latest.datastoreWrites)}</p>
                </Card>
                <Card className="p-4">
                    <p className="text-xs text-[var(--zoru-muted-foreground)]">Datastore reads</p>
                    <p className="text-3xl font-bold mt-2">{fmt(latest.datastoreReads)}</p>
                </Card>
                <Card className="p-4">
                    <p className="text-xs text-[var(--zoru-muted-foreground)]">File storage</p>
                    <p className="text-3xl font-bold mt-2">{gb(latest.fileStorageBytes)} GB</p>
                </Card>
                <Card className="p-4">
                    <p className="text-xs text-[var(--zoru-muted-foreground)]">Bandwidth</p>
                    <p className="text-3xl font-bold mt-2">{gb(latest.bandwidthBytes)} GB</p>
                </Card>
            </div>

            <Card className="p-4">
                <h3 className="font-semibold mb-3">Monthly history</h3>
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left text-xs text-[var(--zoru-muted-foreground)]">
                            <tr>
                                <th className="py-1 pr-4">Period</th>
                                <th className="py-1 pr-4">Invocations</th>
                                <th className="py-1 pr-4">Billable ms</th>
                                <th className="py-1 pr-4">DS writes</th>
                                <th className="py-1 pr-4">DS reads</th>
                                <th className="py-1 pr-4">Storage</th>
                                <th className="py-1 pr-4">Bandwidth</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r._id} className="border-t border-[var(--zoru-border)]">
                                    <td className="py-2 pr-4 font-mono">{r.periodKey}</td>
                                    <td className="py-2 pr-4">{fmt(r.functionInvocations)}</td>
                                    <td className="py-2 pr-4">{fmt(r.functionBillableMs)}</td>
                                    <td className="py-2 pr-4">{fmt(r.datastoreWrites)}</td>
                                    <td className="py-2 pr-4">{fmt(r.datastoreReads)}</td>
                                    <td className="py-2 pr-4">{gb(r.fileStorageBytes)} GB</td>
                                    <td className="py-2 pr-4">{gb(r.bandwidthBytes)} GB</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
