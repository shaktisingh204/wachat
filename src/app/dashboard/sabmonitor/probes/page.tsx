import * as React from 'react';
import { ServerOff, Radio, Wifi, WifiOff } from 'lucide-react';

import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
    Separator,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';

import { listSabmonitorProbes } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function ProbesPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorProbes();
    const total = res.items.length;
    const online = res.items.filter((p) => p.status === 'online').length;

    return (
        <div className="flex max-w-[1000px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Probe agents</PageTitle>
                </PageHeaderHeading>
            </PageHeader>

            {total > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <StatCard
                        label="Agents"
                        value={<span className="tabular-nums">{total}</span>}
                        icon={<Radio aria-hidden="true" />}
                        accent="#3b7af5"
                    />
                    <StatCard
                        label="Online"
                        value={<span className="tabular-nums">{online}</span>}
                        icon={<Wifi aria-hidden="true" />}
                        accent="#1f9d55"
                    />
                    <StatCard
                        label="Offline"
                        value={<span className="tabular-nums">{total - online}</span>}
                        icon={<WifiOff aria-hidden="true" />}
                        accent="#dc2626"
                    />
                </div>
            )}

            <Card padding="none">
                <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Radio
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Regional probes
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={ServerOff}
                            title="No probe agents registered"
                            description="The probe runtime is using the built-in mock probe until real regional agents are wired up."
                        />
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Region</Th>
                                    <Th>Label</Th>
                                    <Th>Status</Th>
                                    <Th>Last seen</Th>
                                    <Th>Version</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((p) => (
                                    <Tr key={p._id}>
                                        <Td className="font-medium text-[var(--st-text)]">
                                            {p.region}
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {p.label}
                                        </Td>
                                        <Td>
                                            <StatusBadge
                                                status={p.status === 'online' ? 'up' : 'down'}
                                            />
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {p.lastSeenAt ? (
                                                <time dateTime={p.lastSeenAt}>
                                                    {new Date(p.lastSeenAt).toLocaleString()}
                                                </time>
                                            ) : (
                                                '—'
                                            )}
                                        </Td>
                                        <Td className="tabular-nums text-[var(--st-text-secondary)]">
                                            {p.version ?? '—'}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
