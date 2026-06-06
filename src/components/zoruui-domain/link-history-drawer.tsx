'use client';

import { useState, useTransition, useEffect } from 'react';
import {
    Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle,
    Button, Badge, Skeleton, cn, useZoruToast
} from '@/components/sabcrm/20ui/compat';
import { History, RotateCcw, LoaderCircle, Clock } from 'lucide-react';
import { getShortUrlHistory, rollbackShortUrl } from '@/app/actions/url-shortener.actions';

interface Props {
    linkId: string;
    currentUrl: string;
}

export function LinkHistoryDrawer({ linkId, currentUrl }: Props) {
    const [open, setOpen] = useState(false);
    const [history, setHistory] = useState<{ url: string; changedAt: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [rolling, setRolling] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useZoruToast();

    const load = () => {
        setLoading(true);
        startTransition(async () => {
            const data = await getShortUrlHistory(linkId);
            setHistory(data);
            setLoading(false);
        });
    };

    useEffect(() => {
        if (open) load();
    }, [open]);

    const handleRollback = (url: string) => {
        setRolling(url);
        startTransition(async () => {
            const result = await rollbackShortUrl(linkId, url);
            if (result.success) {
                toast({ title: 'Rolled back successfully', variant: 'success' });
                setOpen(false);
            } else {
                toast({ title: result.error ?? 'Failed to rollback', variant: 'destructive' });
            }
            setRolling(null);
        });
    };

    const formatDate = (iso: string) => {
        try {
            return new Intl.DateTimeFormat('en', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }).format(new Date(iso));
        } catch { return iso; }
    };

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <History className="h-3.5 w-3.5" />
                History
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <ZoruDialogContent className="max-w-lg">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Link History</ZoruDialogTitle>
                    </ZoruDialogHeader>

                    {/* Current */}
                    <div className="space-y-1 py-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-zoru-ink-muted/60">Current Destination</p>
                        <div className="flex items-start gap-2 p-2.5 rounded-md bg-zoru-ink border border-zoru-border">
                            <div className="h-1.5 w-1.5 rounded-full bg-zoru-success mt-1.5 flex-shrink-0" />
                            <span className="text-[12.5px] text-zoru-ink break-all">{currentUrl}</span>
                            <Badge variant="success" className="text-[10px] flex-shrink-0 ml-auto">Current</Badge>
                        </div>
                    </div>

                    {/* History */}
                    <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-zoru-ink-muted/60">Previous Versions</p>
                        {loading ? (
                            <div className="space-y-2">
                                {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                            </div>
                        ) : history.length === 0 ? (
                            <div className="py-6 text-center text-zoru-ink-muted">
                                <Clock className="h-6 w-6 mx-auto mb-2 opacity-40" />
                                <p className="text-[12px]">No history yet. Edit this link&apos;s destination to start tracking changes.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {[...history].reverse().map((entry, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 p-2.5 rounded-md border border-zoru-border hover:bg-zoru-ink transition-colors group"
                                    >
                                        <div className="h-1.5 w-1.5 rounded-full bg-zoru-ink mt-1.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12.5px] text-zoru-ink break-all">{entry.url}</p>
                                            <p className="text-[11px] text-zoru-ink-muted mt-0.5">{formatDate(entry.changedAt)}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn('opacity-0 group-hover:opacity-100 flex-shrink-0')}
                                            title="Rollback to this version"
                                            onClick={() => handleRollback(entry.url)}
                                            disabled={rolling === entry.url || isPending}
                                        >
                                            {rolling === entry.url
                                                ? <LoaderCircle className="h-3 w-3 animate-spin" />
                                                : <RotateCcw className="h-3 w-3" />
                                            }
                                            Restore
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ZoruDialogContent>
            </Dialog>
        </>
    );
}
