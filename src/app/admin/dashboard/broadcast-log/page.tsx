'use client';

import { Button } from '@/components/zoruui';
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
    completed: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    queued: 'bg-zoru-surface text-zoru-ink border-zoru-line',
    processing: 'bg-blue-100 text-blue-600 border-blue-200',
    'partial failure': 'bg-amber-100 text-amber-600 border-amber-200',
    cancelled: 'bg-zoru-surface text-zoru-ink-muted border-zoru-line',
    failed: 'bg-red-500/15 text-red-600 border-red-500/30',
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
                    <h1 className="text-2xl font-bold text-zoru-ink">Broadcast Log</h1>
                    <p className="text-sm text-zoru-ink-muted mt-1">System-wide raw log of all broadcasts for debugging.</p>
                </div>
                <Button
                    onClick={() => fetchBroadcasts(currentPage)}
                    disabled={isLoading}
                    className="border border-zoru-line bg-zoru-surface text-zoru-ink hover:bg-zoru-surface hover:text-zoru-ink"
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
            <div className="rounded-2xl border border-zoru-line bg-zoru-bg overflow-hidden">
                <div className="px-6 py-4 border-b border-zoru-line flex items-center gap-2">
                    <Radio className="h-4 w-4 text-zoru-ink-muted" />
                    <span className="font-medium text-zoru-ink text-sm">
                        All Broadcasts
                        <span className="ml-2 text-zoru-ink-muted font-normal">({total.toLocaleString()} total)</span>
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zoru-line">
                                {['Timestamp', 'Status', 'Template', 'Project ID', 'Stats'].map(h => (
                                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-zoru-ink-muted uppercase tracking-wider first:pl-6">
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
                                            <div className="h-4 rounded bg-zoru-surface animate-pulse w-full" />
                                        </td>
                                    </tr>
                                ))
                            ) : broadcasts.length > 0 ? (
                                broadcasts.map((b) => (
                                    <tr key={b._id.toString()} className="hover:bg-zoru-surface transition-colors">
                                        <td className="px-6 py-3.5 text-xs text-zoru-ink whitespace-nowrap">
                                            {new Date(b.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle(b.status)}`}>
                                                {b.status?.toLowerCase() || 'unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 font-medium text-zoru-ink">
                                            {b.templateName || '—'}
                                        </td>
                                        <td className="px-6 py-3.5 font-mono text-xs text-zoru-ink-muted">
                                            {b.projectId?.toString() || '—'}
                                        </td>
                                        <td className="px-6 py-3.5 text-xs">
                                            <span className="text-emerald-600">{b.successCount || 0} sent</span>
                                            <span className="text-zoru-ink-muted mx-1">/</span>
                                            <span className="text-red-600">{b.errorCount || 0} failed</span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-zoru-ink-muted">
                                        No broadcasts found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 border-t border-zoru-line flex items-center justify-between">
                    <span className="text-xs text-zoru-ink-muted">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline" size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage <= 1 || isLoading}
                            className="border-zoru-line bg-zoru-surface text-zoru-ink hover:bg-zoru-surface hover:text-zoru-ink disabled:opacity-40"
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline" size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages || isLoading}
                            className="border-zoru-line bg-zoru-surface text-zoru-ink hover:bg-zoru-surface hover:text-zoru-ink disabled:opacity-40"
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
                <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
            </div>
        }>
            <BroadcastLogContent />
        </Suspense>
    );
}
