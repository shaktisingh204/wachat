'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useRef,
  Suspense
} from 'react';
import { getAllBroadcasts } from '@/app/actions/index.ts';

import { RefreshCw, LoaderCircle, Radio } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const BROADCASTS_PER_PAGE = 20;

const STATUS_STYLES: Record<string, string> = {
    completed: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]',
    queued: 'bg-[var(--st-bg-secondary)] text-[var(--st-text)] border-[var(--st-border)]',
    processing: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]',
    'partial failure': 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]',
    cancelled: 'bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] border-[var(--st-border)]',
    failed: 'bg-[var(--st-text)]/15 text-[var(--st-text)] border-[var(--st-border)]/30',
};

function statusStyle(status?: string) {
    return STATUS_STYLES[(status || '').toLowerCase()] ?? STATUS_STYLES['queued'];
}

function BroadcastLogContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const pageParam = searchParams.get('page');
    const currentPage = pageParam ? parseInt(pageParam, 10) : 1;

    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, startTransition] = useTransition();
    
    // Reference to handle race conditions if fetchBroadcasts resolves out of order
    const fetchIdRef = useRef(0);
    
    const totalPages = Math.ceil(total / BROADCASTS_PER_PAGE);

    const fetchBroadcasts = useCallback((page: number) => {
        const fetchId = ++fetchIdRef.current;
        startTransition(async () => {
            try {
                const { broadcasts: data, total: count } = await getAllBroadcasts(page, BROADCASTS_PER_PAGE);
                // Only update state if this is the most recently requested fetch
                if (fetchId === fetchIdRef.current) {
                    setBroadcasts(data);
                    setTotal(count);
                }
            } catch {
                // ignore
            }
        });
    }, []);

    useEffect(() => { 
        fetchBroadcasts(currentPage); 
    }, [currentPage, fetchBroadcasts]);

    // Setup WebSocket for real-time updates
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws/broadcasts`;
        
        let ws: WebSocket | null = null;
        
        try {
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // Update broadcast in state if it currently exists on the page
                    if (data.type === 'BROADCAST_UPDATED' && data.broadcast) {
                        setBroadcasts((prev) => 
                            prev.map((b) => b._id === data.broadcast._id ? { ...b, ...data.broadcast } : b)
                        );
                    }
                } catch (err) {
                    console.error('Failed to parse websocket message', err);
                }
            };
        } catch (error) {
            console.error('Failed to connect to WebSocket', error);
        }

        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, []);

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        if (newPage > 1) {
            params.set('page', newPage.toString());
        } else {
            params.delete('page');
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--st-text)]">Broadcast Log</h1>
                    <p className="text-sm text-[var(--st-text-secondary)] mt-1">System-wide raw log of all broadcasts for debugging.</p>
                </div>
                <Button
                    onClick={() => fetchBroadcasts(currentPage)}
                    disabled={isLoading}
                    className="border border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
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
            <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--st-border)] flex items-center gap-2">
                    <Radio className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    <span className="font-medium text-[var(--st-text)] text-sm">
                        All Broadcasts
                        <span className="ml-2 text-[var(--st-text-secondary)] font-normal">({total.toLocaleString()} total)</span>
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--st-border)]">
                                {['Timestamp', 'Status', 'Template', 'Project ID', 'Stats'].map(h => (
                                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider first:pl-6">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--zoru-line)]">
                            {isLoading ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={5} className="px-6 py-3">
                                            <div className="h-4 rounded bg-[var(--st-bg-secondary)] animate-pulse w-full" />
                                        </td>
                                    </tr>
                                ))
                            ) : broadcasts.length > 0 ? (
                                broadcasts.map((b) => (
                                    <tr key={b._id.toString()} className="hover:bg-[var(--st-bg-secondary)] transition-colors">
                                        <td className="px-6 py-3.5 text-xs text-[var(--st-text)] whitespace-nowrap">
                                            {new Date(b.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle(b.status)}`}>
                                                {b.status?.toLowerCase() || 'unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 font-medium text-[var(--st-text)]">
                                            {b.templateName || '—'}
                                        </td>
                                        <td className="px-6 py-3.5 font-mono text-xs text-[var(--st-text-secondary)]">
                                            {b.projectId?.toString() || '—'}
                                        </td>
                                        <td className="px-6 py-3.5 text-xs">
                                            <span className="text-[var(--st-text)]">{b.successCount || 0} sent</span>
                                            <span className="text-[var(--st-text-secondary)] mx-1">/</span>
                                            <span className="text-[var(--st-text)]">{b.errorCount || 0} failed</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-[var(--st-text-secondary)]">
                                        No broadcasts found.
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
                        <Button
                            variant="outline" size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage <= 1 || isLoading}
                            className="border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] disabled:opacity-40"
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline" size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages || isLoading}
                            className="border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] disabled:opacity-40"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function BroadcastLogPage() {
    return (
        <Suspense fallback={
            <div className="flex h-64 items-center justify-center">
                <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
            </div>
        }>
            <BroadcastLogContent />
        </Suspense>
    );
}
