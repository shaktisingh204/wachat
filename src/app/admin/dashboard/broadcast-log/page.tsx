'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { getAllBroadcasts } from '@/app/actions/index.ts';
import { Button } from '@/components/ui/button';
import { RefreshCw, LoaderCircle, Radio } from 'lucide-react';

const BROADCASTS_PER_PAGE = 20;

const STATUS_STYLES: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    queued: 'bg-slate-200 text-slate-700 border-slate-400',
    processing: 'bg-blue-100 text-blue-600 border-blue-200',
    'partial failure': 'bg-amber-100 text-amber-600 border-amber-200',
    cancelled: 'bg-slate-200 text-slate-500 border-slate-300',
    failed: 'bg-red-500/15 text-red-600 border-red-500/30',
};

function statusStyle(status?: string) {
    return STATUS_STYLES[(status || '').toLowerCase()] ?? STATUS_STYLES['queued'];
}

export default function BroadcastLogPage() {
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, startTransition] = useTransition();
    const totalPages = Math.ceil(total / BROADCASTS_PER_PAGE);

    const fetchBroadcasts = useCallback((page: number) => {
        startTransition(async () => {
            try {
                const { broadcasts: data, total: count } = await getAllBroadcasts(page, BROADCASTS_PER_PAGE);
                setBroadcasts(data);
                setTotal(count);
            } catch {
                // ignore
            }
        });
    }, []);

    useEffect(() => { fetchBroadcasts(currentPage); }, [currentPage, fetchBroadcasts]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Broadcast Log</h1>
                    <p className="text-sm text-slate-500 mt-1">System-wide raw log of all broadcasts for debugging.</p>
                </div>
                <Button
                    onClick={() => fetchBroadcasts(currentPage)}
                    disabled={isLoading}
                    className="border border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200 hover:text-slate-900"
                    variant="outline"
                    size="sm"
                >
                    {isLoading
                        ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        : <RefreshCw className="mr-2 h-4 w-4" />
                    }
                    Refresh
                </Button>
            </div>

            {/* Table card */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                    <Radio className="h-4 w-4 text-slate-500" />
                    <span className="font-medium text-slate-900 text-sm">
                        All Broadcasts
                        <span className="ml-2 text-slate-500 font-normal">({total.toLocaleString()} total)</span>
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200">
                                {['Timestamp', 'Status', 'Template', 'Project ID', 'Stats'].map(h => (
                                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider first:pl-6">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {isLoading ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={5} className="px-6 py-3">
                                            <div className="h-4 rounded bg-slate-100 animate-pulse w-full" />
                                        </td>
                                    </tr>
                                ))
                            ) : broadcasts.length > 0 ? (
                                broadcasts.map((b) => (
                                    <tr key={b._id.toString()} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3.5 text-xs text-slate-700 whitespace-nowrap">
                                            {new Date(b.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle(b.status)}`}>
                                                {b.status?.toLowerCase() || 'unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 font-medium text-slate-900">
                                            {b.templateName || '—'}
                                        </td>
                                        <td className="px-6 py-3.5 font-mono text-xs text-slate-500">
                                            {b.projectId?.toString() || '—'}
                                        </td>
                                        <td className="px-6 py-3.5 text-xs">
                                            <span className="text-emerald-600">{b.successCount || 0} sent</span>
                                            <span className="text-slate-500 mx-1">/</span>
                                            <span className="text-red-600">{b.errorCount || 0} failed</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                                        No broadcasts found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline" size="sm"
                            onClick={() => setCurrentPage(p => p - 1)}
                            disabled={currentPage <= 1 || isLoading}
                            className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40"
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline" size="sm"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage >= totalPages || isLoading}
                            className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
