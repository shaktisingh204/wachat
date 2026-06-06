'use client';

import { Button, ScrollArea, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { getFlowLogsForAdmin, getFlowLogPayloadForAdmin, replayFlowLog } from '@/app/actions/admin-hardening.actions';
import type { FlowLog, FlowLogEntry } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { useDebouncedCallback } from 'use-debounce';
import { Eye, Search, LoaderCircle, GitFork, Copy, X, RefreshCw } from 'lucide-react';

const LOGS_PER_PAGE = 20;

export default function FlowLogsPage() {
    const [logs, setLogs] = useState<Omit<WithId<FlowLog>, 'entries'>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState<WithId<FlowLog> | null>(null);
    const [loadingPayload, setLoadingPayload] = useState(false);
    const { toast } = useZoruToast();

    const fetchLogs = useCallback((page: number, query: string) => {
        startTransition(async () => {
            try {
                const { logs: newLogs, total } = await getFlowLogsForAdmin(page, LOGS_PER_PAGE, query);
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
        const full = await getFlowLogPayloadForAdmin(log._id.toString());
        setSelectedLog(full);
        setLoadingPayload(false);
    };

    const handleCopy = (data: FlowLogEntry[]) => {
        navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() =>
            toast({ title: 'Copied!', description: 'Log data copied to clipboard.' })
        );
    };

    const handleRetry = async (logId: string) => {
        try {
            const res = await replayFlowLog(logId);
            if (res.success) {
                toast({ title: 'Success', description: 'Flow queued for replay.' });
                fetchLogs(currentPage, searchQuery);
            } else {
                toast({ title: 'Error', description: res.error || 'Failed to replay flow.', variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to replay flow.', variant: 'destructive' });
        }
    };

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-[var(--st-text)]">Flow Execution Logs</h1>
                    <p className="text-sm text-[var(--st-text-secondary)] mt-1">Detailed log of every flow run for every contact.</p>
                </div>

                {/* Table card */}
                <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--st-border)] flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <GitFork className="h-4 w-4 text-[var(--st-text-secondary)]" />
                            <span className="font-medium text-[var(--st-text)] text-sm">All Executions</span>
                        </div>
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--st-text-secondary)]" />
                            <input
                                placeholder="Search by flow name or contact ID…"
                                onChange={(e) => handleSearch(e.target.value)}
                                className="w-full rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] py-2 pl-9 pr-4 text-sm text-[var(--st-text)] placeholder:text-[var(--st-text-secondary)] focus:outline-none focus:border-[var(--st-border)]/50 focus:ring-1 focus:ring-[var(--st-border)]/20 transition-all"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--st-border)]">
                                    {['Timestamp', 'Flow Name', 'Contact ID', 'Project ID', ''].map((h, i) => (
                                        <th key={i} className="text-left px-6 py-3 text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--st-border)]">
                                {isLoading ? (
                                    [...Array(6)].map((_, i) => (
                                        <tr key={i}>
                                            <td colSpan={5} className="px-6 py-3">
                                                <div className="h-4 rounded bg-[var(--st-bg-secondary)] animate-pulse" />
                                            </td>
                                        </tr>
                                    ))
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                        <tr key={log._id.toString()} className="hover:bg-[var(--st-bg-secondary)] transition-colors">
                                            <td className="px-6 py-3.5 text-xs text-[var(--st-text-secondary)] whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-3.5 font-medium text-[var(--st-text)]">{log.flowName}</td>
                                            <td className="px-6 py-3.5 font-mono text-xs text-[var(--st-text-secondary)]">{log.contactId?.toString()}</td>
                                            <td className="px-6 py-3.5 font-mono text-xs text-[var(--st-text-secondary)]">{log.projectId?.toString()}</td>
                                            <td className="px-6 py-3.5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleViewLog(log)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] transition-all"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        View
                                                    </button>
                                                    <button
                                                        onClick={() => handleRetry(log._id.toString())}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] transition-all"
                                                    >
                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                        Retry
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-16 text-center text-[var(--st-text-secondary)]">
                                            No flow logs found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-6 py-3 border-t border-[var(--st-border)] flex items-center justify-between">
                        <span className="text-xs text-[var(--st-text-secondary)]">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1 || isLoading}
                                className="border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] disabled:opacity-40">
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages || isLoading}
                                className="border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] disabled:opacity-40">
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Log detail modal */}
            {(selectedLog || loadingPayload) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--st-text)]/30 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] shadow-2xl overflow-hidden">
                        {/* Modal header */}
                        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[var(--st-border)]">
                            <div>
                                <h2 className="font-semibold text-[var(--st-text)]">Flow Log Details</h2>
                                {selectedLog && (
                                    <p className="text-xs text-[var(--st-text-secondary)] mt-0.5">
                                        {selectedLog.flowName} · {new Date(selectedLog.createdAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedLog && (
                                    <button
                                        onClick={() => handleCopy(selectedLog.entries)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] transition-all"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        Copy
                                    </button>
                                )}
                                <button
                                    onClick={() => { setSelectedLog(null); setLoadingPayload(false); }}
                                    className="rounded-lg p-1.5 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] transition-all"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        {/* Modal body */}
                        <div className="p-4">
                            {loadingPayload ? (
                                <div className="flex items-center justify-center py-12">
                                    <LoaderCircle className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                </div>
                            ) : selectedLog ? (
                                <ScrollArea className="max-h-[60vh]">
                                    <div className="space-y-2 pr-2">
                                        {selectedLog.entries.map((entry, i) => (
                                            <div key={i} className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-xs font-mono">
                                                <p>
                                                    <span className="text-[var(--st-text)] font-semibold">
                                                        [{new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 3 })}]
                                                    </span>
                                                    {' '}
                                                    <span className="text-[var(--st-text)]">{entry.message}</span>
                                                </p>
                                                {entry.data && (
                                                    <details className="mt-1.5">
                                                        <summary className="cursor-pointer text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors">View Data</summary>
                                                        <pre className="mt-1 p-2 rounded-lg bg-[var(--st-bg)] text-[var(--st-text)] text-xs whitespace-pre-wrap max-h-48 overflow-auto">
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
