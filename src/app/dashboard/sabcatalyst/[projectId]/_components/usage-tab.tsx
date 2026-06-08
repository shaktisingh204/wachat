'use client';

/** Usage tab. Monthly aggregates plus billing breakdown. */
import React from 'react';
import { Activity, Clock, Database, DownloadCloud, HardDrive, Wifi } from 'lucide-react';

import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    EmptyState,
    StatCard,
    TBody,
    THead,
    Table,
    Td,
    Th,
    Tr,
} from '@/components/sabcrm/20ui';
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
            <Card>
                <CardBody className="p-6">
                    <EmptyState
                        icon={Activity}
                        title="No usage yet"
                        description="Once your functions run and your datastore writes land, monthly rollups appear here."
                    />
                </CardBody>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard icon={Activity} label="Function invocations" value={fmt(latest.functionInvocations)} />
                <StatCard icon={Clock} label="Billable ms" value={fmt(latest.functionBillableMs)} />
                <StatCard icon={Database} label="Datastore writes" value={fmt(latest.datastoreWrites)} />
                <StatCard icon={DownloadCloud} label="Datastore reads" value={fmt(latest.datastoreReads)} />
                <StatCard icon={HardDrive} label="File storage" value={`${gb(latest.fileStorageBytes)} GB`} />
                <StatCard icon={Wifi} label="Bandwidth" value={`${gb(latest.bandwidthBytes)} GB`} />
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Activity size={16} aria-hidden="true" />
                        <CardTitle>Monthly history</CardTitle>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className="overflow-auto">
                        <Table density="compact">
                            <THead>
                                <Tr>
                                    <Th>Period</Th>
                                    <Th align="right">Invocations</Th>
                                    <Th align="right">Billable ms</Th>
                                    <Th align="right">DS writes</Th>
                                    <Th align="right">DS reads</Th>
                                    <Th align="right">Storage</Th>
                                    <Th align="right">Bandwidth</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {rows.map((r) => (
                                    <Tr key={r._id}>
                                        <Td className="font-mono">{r.periodKey}</Td>
                                        <Td align="right">{fmt(r.functionInvocations)}</Td>
                                        <Td align="right">{fmt(r.functionBillableMs)}</Td>
                                        <Td align="right">{fmt(r.datastoreWrites)}</Td>
                                        <Td align="right">{fmt(r.datastoreReads)}</Td>
                                        <Td align="right">{gb(r.fileStorageBytes)} GB</Td>
                                        <Td align="right">{gb(r.bandwidthBytes)} GB</Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
