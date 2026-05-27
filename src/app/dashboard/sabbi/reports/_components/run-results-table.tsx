'use client';

import * as React from 'react';
import { Card, Button } from '@/components/zoruui';
import { ReportExportButton } from './report-export-button';

interface RunResultsTableProps {
    reportName: string;
    columns: string[];
    rows: any[][];
}

function fmtCell(v: unknown): string {
    if (v === null || v === undefined) return '—';
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
        <Card className="flex flex-col">
            <div className="flex items-center justify-between border-b border-zoru-line/50 p-3">
                <h3 className="text-[14px] font-semibold">Results ({rows.length} rows)</h3>
                <div className="flex items-center gap-2">
                    <ReportExportButton 
                        filename={`run-${reportName.toLowerCase().replace(/\s+/g, '-')}`}
                        headers={columns}
                        rows={exportRows}
                    />
                </div>
            </div>
            
            <div 
                ref={containerRef}
                onScroll={handleScroll}
                className="overflow-x-auto overflow-y-auto relative" 
                style={{ maxHeight: containerHeight }}
            >
                <table className="w-full text-sm relative border-collapse">
                    <thead className="text-left text-zoru-ink-muted sticky top-0 bg-zoru-bg z-10 shadow-[0_1px_0_var(--zoru-line)]">
                        <tr>
                            {columns.map((c) => (
                                <th key={c} className="px-3 py-2 font-medium">
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={columns.length || 1}
                                    className="px-3 py-6 text-center text-zoru-ink-muted"
                                >
                                    No rows captured.
                                </td>
                            </tr>
                        )}
                        {paddingTop > 0 && (
                            <tr style={{ height: paddingTop }} aria-hidden="true">
                                <td colSpan={columns.length} />
                            </tr>
                        )}
                        {virtualRows.map((row, idx) => (
                            <tr key={startIndex + idx} style={{ height: rowHeight }} className="border-t border-zoru-line/50 hover:bg-zoru-surface-2/50">
                                {row.map((cell, ci) => (
                                    <td key={ci} className="px-3 py-1 font-mono text-xs whitespace-nowrap">
                                        {fmtCell(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {paddingBottom > 0 && (
                            <tr style={{ height: paddingBottom }} aria-hidden="true">
                                <td colSpan={columns.length} />
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-zoru-line/50 p-3">
                    <p className="text-xs text-zoru-ink-muted">
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
