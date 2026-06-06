import * as React from 'react';
import Link from 'next/link';
import { Activity } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardBody,
    Checkbox,
    EmptyState,
    Field,
    Input,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageActions,
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
    return (
        <div className="flex flex-col gap-4">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>APM traces</PageTitle>
                </PageHeaderHeading>
                <PageActions>
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
                                placeholder="slow ms"
                            />
                        </Field>
                        <Field label="Service">
                            <Input
                                name="service"
                                inputSize="sm"
                                defaultValue={sp.service}
                                placeholder="service"
                            />
                        </Field>
                        <Button type="submit" variant="secondary">
                            Filter
                        </Button>
                    </form>
                </PageActions>
            </PageHeader>
            <Card padding="none">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={Activity}
                            title="No traces yet"
                            description="Traces will appear here once your services start reporting spans."
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
                                    <Th align="right">Errored</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {res.items.map((t) => (
                                    <Tr key={t.traceId}>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {t.startedAt ? new Date(t.startedAt).toLocaleString() : '-'}
                                        </Td>
                                        <Td>
                                            <Link
                                                className="font-mono text-[12px] text-[var(--st-accent)] hover:underline"
                                                href={`/dashboard/sabmonitor/apm/traces/${t.traceId}`}
                                            >
                                                {t.traceId.slice(0, 16)}...
                                            </Link>
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">{t.rootService ?? '-'}</Td>
                                        <Td className="text-[var(--st-text-secondary)]">{t.rootOperation ?? '-'}</Td>
                                        <Td align="right" className="text-[var(--st-text-secondary)]">
                                            {t.durationMs}ms
                                        </Td>
                                        <Td align="right" className="text-[var(--st-text-secondary)]">
                                            {t.spanCount}
                                        </Td>
                                        <Td align="right">
                                            {t.errored ? (
                                                <Badge tone="danger">error</Badge>
                                            ) : (
                                                <Badge tone="success">ok</Badge>
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
