'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { getWebhookLogs, getWebhookLogPayload } from '@/app/actions/index.ts';
import type { FlowLog } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebouncedCallback } from 'use-debounce';
import { Eye, Search, LoaderCircle, GitFork, Copy, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const dynamic = 'force-dynamic';
const LOGS_PER_PAGE = 20;

export default function FlowLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState<WithId<FlowLog> | null>(null);
    const [loadingPayload, setLoadingPayload] = useState(false);
    const { toast } = useToast();

    const fetchLogs = useCallback((page: number, query: string) => {
        startTransition(async () => {
            try {
                // @ts-ignore
                const { logs: newLogs, total } = await getWebhookLogs(page, LOGS_PER_PAGE, query);
                setLogs(newLogs);
                setTotalPages(Math.ceil(total / LOGS_PER_PAGE));
            } catch {
                toast({ title: 'Error', description: 'Failed to fetch flow logs.', variant: 'destructive' });
            }
        });
    }, [toast]);

    useEffect(() => { fetchLogs(currentPage, searchQuery); }, [currentPage, searchQuery, fetchLogs]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 500);

    const handleViewLog = async (log: Omit<WithId<FlowLog>, 'entries'>) => {
        setSelectedLog(null);
        setLoadingPayload(true);
        // @ts-ignore
        const full = await getWebhookLogPayload(log._id.toString());
        setSelectedLog(full);
        setLoadingPayload(false);
    };

    const handleCopy = (data: any) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() =>
            toast({ title: 'Copied!', description: 'Log data copied to clipboard.' })
        );
    };

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Flow Execution Logs</h1>
                    <p className="text-sm text-slate-500 mt-1">Detailed log of every flow run for every contact.</p>
                </div>

                {/* Table card */}
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <GitFork className="h-4 w-4 text-slate-500" />
                            <span className="font-medium text-slate-900 text-sm">All Executions</span>
                        </div>
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <input
                                placeholder="Search by flow name or contact ID…"
                                onChange={(e) => handleSearch(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-slate-100 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    {['Timestamp', 'Flow Name', 'Contact ID', 'Project ID', ''].map((h, i) => (
                                        <th key={i} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
                                                <div className="h-4 rounded bg-slate-100 animate-pulse" />
                                            </td>
                                        </tr>
                                    ))
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <tr key={log._id.toString()} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3.5 font-medium text-slate-900">{log.flowName}</td>
                                            <td className="px-6 py-3.5 font-mono text-xs text-slate-500">{log.contactId?.toString()}</td>
                                            <td className="px-6 py-3.5 font-mono text-xs text-slate-500">{log.projectId?.toString()}</td>
                                            <td className="px-6 py-3.5 text-right">
                                                <button
                                                    onClick={() => handleViewLog(log)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-all"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                                            No flow logs found.
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
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1 || isLoading}
                                className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40">
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages || isLoading}
                                className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40">
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Log detail modal */}
            {(selectedLog || loadingPayload) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                        {/* Modal header */}
                        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
                            <div>
                                <h2 className="font-semibold text-slate-900">Flow Log Details</h2>
                                {selectedLog && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedLog.flowName} · {new Date(selectedLog.createdAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedLog && (
                                    <button
                                        onClick={() => handleCopy(selectedLog.entries)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-all"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        Copy
                                    </button>
                                )}
                                <button
                                    onClick={() => { setSelectedLog(null); setLoadingPayload(false); }}
                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        {/* Modal body */}
                        <div className="p-4">
                            {loadingPayload ? (
                                <div className="flex items-center justify-center py-12">
                                    <LoaderCircle className="h-6 w-6 animate-spin text-slate-500" />
                                </div>
                            ) : selectedLog ? (
                                <ScrollArea className="max-h-[60vh]">
                                    <div className="space-y-2 pr-2">
                                        {selectedLog.entries.map((entry, i) => (
                                            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono">
                                                <p>
                                                    <span className="text-amber-600 font-semibold">
                                                        [{new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 3 })}]
                                                    </span>
                                                    {' '}
                                                    <span className="text-slate-900">{entry.message}</span>
                                                </p>
                                                {entry.data && (
                                                    <details className="mt-1.5">
                                                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700 transition-colors">View Data</summary>
                                                        <pre className="mt-1 p-2 rounded-lg bg-white text-slate-700 text-xs whitespace-pre-wrap max-h-48 overflow-auto">
                                                            {JSON.stringify(entry.data, null, 2)}
                                                        </pre>
                                                    </details>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
