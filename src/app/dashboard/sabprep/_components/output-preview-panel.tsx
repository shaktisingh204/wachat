'use client';

import * as React from 'react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Badge,
    EmptyState,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from '@/components/sabcrm/20ui';
import { Table2 } from 'lucide-react';
import type { Row, StepRunSummary } from '@/lib/rust-client/sabprep-steps';

const ROW_LIMIT = 50;

export function OutputPreviewPanel({
    rows,
    summaries,
}: {
    rows: Row[];
    summaries: StepRunSummary[];
}) {
    const cols = React.useMemo(
        () => (rows.length > 0 ? Object.keys(rows[0]) : []),
        [rows],
    );
    const slice = React.useMemo(() => rows.slice(0, ROW_LIMIT), [rows]);
    const totalErrors = React.useMemo(
        () => summaries.reduce((acc, s) => acc + (s.errors?.length ?? 0), 0),
        [summaries],
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                    <Table2 size={15} aria-hidden="true" className="text-[var(--st-accent)]" />
                    <span>Output preview</span>
                    {totalErrors > 0 ? (
                        <Badge tone="danger" dot className="ml-auto tabular-nums">
                            {totalErrors} error{totalErrors === 1 ? '' : 's'}
                        </Badge>
                    ) : (
                        <Badge tone="success" dot className="ml-auto tabular-nums">
                            {rows.length.toLocaleString()} rows
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardBody>
                {cols.length === 0 ? (
                    <EmptyState
                        icon={Table2}
                        size="sm"
                        title="No output yet"
                        description="Add a source dataset and at least one step to see output."
                    />
                ) : (
                    <div className="overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
                        <Table density="compact" className="text-xs">
                            <THead>
                                <Tr>
                                    {cols.map((c) => (
                                        <Th key={c}>{c}</Th>
                                    ))}
                                </Tr>
                            </THead>
                            <TBody>
                                {slice.map((r, i) => (
                                    <Tr key={i}>
                                        {cols.map((c) => (
                                            <Td key={c}>{renderCell(r[c])}</Td>
                                        ))}
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </div>
                )}

                {summaries.length > 0 ? (
                    <Collapsible className="mt-3 text-xs">
                        <CollapsibleTrigger className="text-[var(--st-text-secondary)]">
                            Per-step summary
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <ul className="mt-2 space-y-1">
                                {summaries.map((s) => (
                                    <li
                                        key={s.stepIndex}
                                        className="font-mono text-[var(--st-text-secondary)]"
                                    >
                                        #{s.stepIndex} {s.stepKind}: {s.rowsIn} → {s.rowsOut}
                                        {(s.errors?.length ?? 0) > 0
                                            ? ` · ${s.errors!.length} err`
                                            : ''}
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleContent>
                    </Collapsible>
                ) : null}
            </CardBody>
        </Card>
    );
}

function renderCell(v: unknown): string {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}
