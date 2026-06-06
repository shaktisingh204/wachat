'use client';

import * as React from 'react';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, Badge } from '@/components/sabcrm/20ui/compat';
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
            <ZoruCardHeader>
                <ZoruCardTitle className="flex items-center justify-between gap-2 text-sm">
                    <span>Output preview · {rows.length} rows</span>
                    {totalErrors > 0 ? (
                        <Badge variant="destructive">{totalErrors} error(s)</Badge>
                    ) : null}
                </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
                {cols.length === 0 ? (
                    <p className="text-xs opacity-60">
                        Add a source dataset and at least one step to see output.
                    </p>
                ) : (
                    <div className="overflow-auto rounded-md border border-[var(--zoru-border,#e5e7eb)]">
                        <table className="w-full text-xs">
                            <thead className="bg-[var(--zoru-muted,#f6f6f7)]">
                                <tr>
                                    {cols.map((c) => (
                                        <th
                                            key={c}
                                            className="border-b px-2 py-1 text-left font-medium"
                                        >
                                            {c}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {slice.map((r, i) => (
                                    <tr key={i} className="border-b last:border-b-0">
                                        {cols.map((c) => (
                                            <td key={c} className="px-2 py-1">
                                                {renderCell(r[c])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {summaries.length > 0 ? (
                    <details className="mt-3 text-xs">
                        <summary className="cursor-pointer opacity-70">
                            Per-step summary
                        </summary>
                        <ul className="mt-2 space-y-1">
                            {summaries.map((s) => (
                                <li key={s.stepIndex} className="font-mono">
                                    #{s.stepIndex} {s.stepKind}: {s.rowsIn} → {s.rowsOut}
                                    {(s.errors?.length ?? 0) > 0
                                        ? ` · ${s.errors!.length} err`
                                        : ''}
                                </li>
                            ))}
                        </ul>
                    </details>
                ) : null}
            </ZoruCardContent>
        </Card>
    );
}

function renderCell(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}
