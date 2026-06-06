'use client';

import * as React from 'react';
import { Inbox } from 'lucide-react';
import {
    Card,
    CardHeader,
    CardTitle,
    Button,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    EmptyState,
} from '@/components/sabcrm/20ui';
import { ReportExportButton } from './report-export-button';

interface RunResultsTableProps {
    reportName: string;
    columns: string[];
    rows: any[][];
}

function fmtCell(v: unknown): string {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'number') {
        return Number.isInteger(v) ? String(v) : v.toFixed(2);
    }
    if (v instanceof Date) return v.toISOString();
    return String(v);
}

export function RunResultsTable({ reportName, columns, rows }: RunResultsTableProps) {
    const [page, setPage] = React.useState(0);
    const pageSize = 100;
    const totalPages = Math.ceil(rows.length / pageSize);
    const hasNext = page < totalPages - 1;
    const hasPrev = page > 0;

    const exportRows = React.useMemo(() => {
        return rows.map(row => {
            const rowObj: Record<string, any> = {};
            columns.forEach((col, idx) => {
                rowObj[col] = fmtCell(row[idx]);
            });
            return rowObj;
        });
    }, [rows, columns]);

    const visibleRows = React.useMemo(() => {
        return rows.slice(page * pageSize, (page + 1) * pageSize);
    }, [rows, page, pageSize]);

    const [scrollTop, setScrollTop] = React.useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setScrollTop(0);
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, [page]);

    const rowHeight = 36;
    const containerHeight = 600;
    const overscan = 10;

    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(visibleRows.length, Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan);

    const virtualRows = visibleRows.slice(startIndex, endIndex);
    const paddingTop = startIndex * rowHeight;
    const paddingBottom = (visibleRows.length - endIndex) * rowHeight;

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    return (
        <Card padding="none" className="flex flex-col">
            <CardHeader className="flex items-center justify-between gap-2">
                <CardTitle>Results ({rows.length} rows)</CardTitle>
                <div className="flex items-center gap-2">
                    <ReportExportButton
                        filename={`run-${reportName.toLowerCase().replace(/\s+/g, '-')}`}
                        headers={columns}
                        rows={exportRows}
                    />
                </div>
            </CardHeader>

            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="relative max-h-[600px] overflow-x-auto overflow-y-auto"
            >
                <Table density="compact" hover stickyHeader className="w-full">
                    <THead>
                        <Tr>
                            {columns.map((c) => (
                                <Th key={c}>{c}</Th>
                            ))}
                        </Tr>
                    </THead>
                    <TBody>
                        {visibleRows.length === 0 && (
                            <Tr>
                                <Td colSpan={columns.length || 1} className="p-0">
                                    <EmptyState
                                        icon={Inbox}
                                        title="No rows captured"
                                        description="This run returned no rows. New results will appear here."
                                        size="sm"
                                    />
                                </Td>
                            </Tr>
                        )}
                        {paddingTop > 0 && (
                            <Tr style={{ height: paddingTop }} aria-hidden="true">
                                <Td colSpan={columns.length} />
                            </Tr>
                        )}
                        {virtualRows.map((row, idx) => (
                            <Tr key={startIndex + idx} style={{ height: rowHeight }}>
                                {row.map((cell, ci) => (
                                    <Td key={ci} className="font-mono text-xs whitespace-nowrap">
                                        {fmtCell(cell)}
                                    </Td>
                                ))}
                            </Tr>
                        ))}
                        {paddingBottom > 0 && (
                            <Tr style={{ height: paddingBottom }} aria-hidden="true">
                                <Td colSpan={columns.length} />
                            </Tr>
                        )}
                    </TBody>
                </Table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[var(--st-border)] p-3">
                    <p className="text-xs text-[var(--st-text-secondary)]">
                        Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, rows.length)} of {rows.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={!hasPrev}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={!hasNext}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
