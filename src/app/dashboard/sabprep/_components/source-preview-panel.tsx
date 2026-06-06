'use client';

import * as React from 'react';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
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
            <ZoruCardHeader>
                <ZoruCardTitle className="text-sm">
                    Source preview · {rows.length} rows
                </ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
                {cols.length === 0 ? (
                    <p className="text-xs opacity-60">
                        Pick a dataset or upload a CSV to begin.
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
            </ZoruCardContent>
        </Card>
    );
}

function renderCell(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}
