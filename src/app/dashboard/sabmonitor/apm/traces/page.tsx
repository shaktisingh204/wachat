import * as React from 'react';
import Link from 'next/link';
import { Activity, Network, AlertTriangle, Timer, Filter } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Checkbox,
    EmptyState,
    Field,
    Input,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    StatCard,
    Separator,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';

import { listSabmonitorTraces } from '@/app/actions/sabmonitor.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ erroredOnly?: string; slowMs?: string; service?: string }>;
}

export default async function ApmTracesPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
    const sp = await searchParams;
    const res = await listSabmonitorTraces({
        erroredOnly: sp.erroredOnly === 'true',
        slowMs: sp.slowMs ? Number(sp.slowMs) : undefined,
        service: sp.service,
        limit: 100,
    });

    const erroredCount = res.items.filter((t) => t.errored).length;
    const avgDuration =
        res.items.length > 0
            ? Math.round(
                  res.items.reduce((s, t) => s + (t.durationMs ?? 0), 0) / res.items.length,
              )
            : 0;

    return (
        <div className="flex max-w-[1200px] flex-col gap-5">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>APM traces</PageTitle>
                </PageHeaderHeading>
            </PageHeader>

            <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                    label="Traces"
                    value={<span className="tabular-nums">{res.items.length}</span>}
                    icon={<Network aria-hidden="true" />}
                    accent="#3b7af5"
                />
                <StatCard
                    label="Errored"
                    value={<span className="tabular-nums">{erroredCount}</span>}
                    icon={<AlertTriangle aria-hidden="true" />}
                    accent="#dc2626"
                />
                <StatCard
                    label="Avg duration"
                    value={
                        <span className="tabular-nums">
                            {avgDuration}
                            <span className="ml-0.5 text-[13px] font-normal text-[var(--st-text-secondary)]">
                                ms
                            </span>
                        </span>
                    }
                    icon={<Timer aria-hidden="true" />}
                    accent="#7c3aed"
                />
            </div>

            <Card>
                <CardBody className="py-3">
                    <form className="flex flex-wrap items-end gap-3">
                        <Checkbox
                            name="erroredOnly"
                            value="true"
                            defaultChecked={sp.erroredOnly === 'true'}
                            label="Errored only"
                        />
                        <Field label="Slow ms">
                            <Input
                                name="slowMs"
                                type="number"
                                inputSize="sm"
                                defaultValue={sp.slowMs}
                                placeholder="e.g. 500"
                            />
                        </Field>
                        <Field label="Service">
                            <Input
                                name="service"
                                inputSize="sm"
                                defaultValue={sp.service}
                                placeholder="checkout-api"
                            />
                        </Field>
                        <Button type="submit" variant="secondary">
                            <Filter size={14} aria-hidden="true" />
                            Apply filters
                        </Button>
                    </form>
                </CardBody>
            </Card>

            <Card padding="none">
                <CardHeader className="px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Network
                            className="h-4 w-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                        />
                        Recent traces
                    </CardTitle>
                </CardHeader>
                <Separator />
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={Activity}
                            title="No traces yet"
                            description="Traces appear here once your services start reporting spans to SabMonitor."
                        />
                    ) : (
                        <Table density="compact">
                            <THead>
                                <Tr>
                                    <Th>Started</Th>
                                    <Th>Trace</Th>
                                    <Th>Service</Th>
                                    <Th>Operation</Th>
                                    <Th align="right">Duration</Th>
                                    <Th align="right">Spans</Th>
                                    <Th align="right">Result</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((t) => (
                                    <Tr key={t.traceId}>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {t.startedAt ? (
                                                <time dateTime={t.startedAt}>
                                                    {new Date(t.startedAt).toLocaleString()}
                                                </time>
                                            ) : (
                                                '—'
                                            )}
                                        </Td>
                                        <Td>
                                            <Link
                                                className="font-mono text-[12px] text-[var(--st-accent)] transition-colors hover:text-[var(--st-accent-hover)]"
                                                href={`/dashboard/sabmonitor/apm/traces/${t.traceId}`}
                                            >
                                                {t.traceId.slice(0, 16)}…
                                            </Link>
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {t.rootService ?? '—'}
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {t.rootOperation ?? '—'}
                                        </Td>
                                        <Td
                                            align="right"
                                            className="tabular-nums text-[var(--st-text)]"
                                        >
                                            {t.durationMs} ms
                                        </Td>
                                        <Td
                                            align="right"
                                            className="tabular-nums text-[var(--st-text-secondary)]"
                                        >
                                            {t.spanCount}
                                        </Td>
                                        <Td align="right">
                                            {t.errored ? (
                                                <Badge tone="danger" kind="soft" dot>
                                                    Error
                                                </Badge>
                                            ) : (
                                                <Badge tone="success" kind="soft" dot>
                                                    OK
                                                </Badge>
                                            )}
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
