'use client';

import * as React from 'react';
import { Database } from 'lucide-react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Badge,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import type { Row } from '@/lib/rust-client/sabprep-steps';

const ROW_LIMIT = 50;

export function SourcePreviewPanel({ rows }: { rows: Row[] }) {
    const cols = React.useMemo(
        () => (rows.length > 0 ? Object.keys(rows[0]) : []),
        [rows],
    );
    const slice = React.useMemo(() => rows.slice(0, ROW_LIMIT), [rows]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                    <Database size={15} aria-hidden="true" className="text-[var(--st-accent)]" />
                    <span>Source preview</span>
                    <Badge tone="neutral" className="ml-auto tabular-nums">
                        {rows.length.toLocaleString()} rows
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardBody>
                {cols.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={Database}
                        title="No source data yet"
                        description="Pick a dataset or upload a CSV to begin."
                    />
                ) : (
                    <div className="overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
                        <Table density="compact" stickyHeader>
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
            </CardBody>
        </Card>
    );
}

function renderCell(v: unknown): string {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}
