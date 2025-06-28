
'use client';

import { useCallback, useEffect, useState, useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";
import { getWebhookLogs, handleClearWebhookLogs, handleReprocessWebhook } from '@/app/actions';
import type { WebhookLog } from '@/app/actions';
import type { WithId } from 'mongodb';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from "@/hooks/use-toast";
import { Trash2, LoaderCircle, Eye, Search, RefreshCw, Copy, RotateCw } from "lucide-react";

const LOGS_PER_PAGE = 15;


function ReprocessButton({ logId }: { logId: string }) {
    const [isProcessing, startTransition] = useTransition();
    const { toast } = useToast();

    const onReprocess = () => {
        startTransition(async () => {
            const result = await handleReprocessWebhook(logId);
            if (result.error) {
                toast({ title: 'Error Re-processing', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.message });
            }
        });
    }

    return (
        <Button variant="ghost" size="icon" onClick={onReprocess} disabled={isProcessing}>
            {isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            <span className="sr-only">Re-process Webhook</span>
        </Button>
    )
}

export function WebhookLogs() {
    const [logs, setLogs] = useState<WithId<WebhookLog>[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, startRefreshTransition] = useTransition();
    const [isClearing, startClearingTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const [selectedLog, setSelectedLog] = useState<WithId<WebhookLog> | null>(null);

    const fetchLogs = useCallback(async (page: number, query: string, showToast = false) => {
        startRefreshTransition(async () => {
            try {
                const { logs: newLogs, total } = await getWebhookLogs(page, LOGS_PER_PAGE, query);
                setLogs(newLogs);
                setTotalPages(Math.ceil(total / LOGS_PER_PAGE));
                if (showToast) {
                    toast({ title: "Refreshed", description: "Webhook logs updated." });
                }
            } catch (error) {
                toast({ title: "Error", description: "Failed to fetch webhook logs.", variant: "destructive" });
            }
        });
    }, [toast]);

    useEffect(() => {
        setLoading(true);
        fetchLogs(currentPage, searchQuery).finally(() => setLoading(false));
    }, [currentPage, searchQuery, fetchLogs]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1); 
    }, 500);

    const handleClearLogs = () => {
        startClearingTransition(async () => {
            const result = await handleClearWebhookLogs();
            if (result.error) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            } else {
                toast({ title: "Success", description: result.message });
                fetchLogs(1, searchQuery, false);
                setCurrentPage(1);
            }
        });
    };

    const getEventField = (log: WithId<WebhookLog>): string => {
        try {
            return log.payload?.entry?.[0]?.changes?.[0]?.field || 'N/A';
        } catch {
            return 'N/A';
        }
    };
    
    const getEventSummary = (log: WithId<WebhookLog>): string => {
        try {
            const change = log?.payload?.entry?.[0]?.changes?.[0];
            if (!change) return 'No changes found';

            const value = change.value;
            const field = change.field;

            if (!value) return `Event: ${field} (no value)`;

            switch(field) {
                case 'messages':
                    if (value.statuses && Array.isArray(value.statuses) && value.statuses.length > 0) {
                        const status = value.statuses[0];
                        return `Status: ${status.status} to ${status.recipient_id}`;
                    }
                    if (value.messages && Array.isArray(value.messages) && value.messages.length > 0) {
                        const message = value.messages[0];
                        const from = message.from || 'unknown';
                        const type = message.type || 'unknown';
                        if (type === 'text') {
                            const body = message.text?.body || '';
                            const bodyPreview = body.substring(0, 30);
                            return `Message from ${from}: "${bodyPreview}${body.length > 30 ? '...' : ''}"`;
                        }
                        return `Message from ${from} (${type})`;
                    }
                    return 'Message event with unknown content';
                case 'account_review_update':
                    return `Account review decision: ${value.decision}`;
                case 'message_template_status_update':
                case 'template_status_update':
                    return `Template '${value.message_template_name}' update: ${value.event}`;
                case 'phone_number_quality_update':
                    return `Phone number quality update: ${value.event} (Limit: ${value.current_limit})`;
                case 'phone_number_name_update':
                    return `Name update for ${value.display_phone_number}: ${value.decision}`;
                default:
                    if (value.event) return `Event: ${value.event}`;
                    return `General Update for ${field}`;
            }
        } catch(e: any) {
             console.error("Error parsing summary:", e, log);
             return 'Could not parse summary details';
        }
    }

    const handleCopyPayload = (payload: any) => {
        const payloadString = JSON.stringify(payload, null, 2);
        if (!navigator.clipboard) {
          toast({
            title: 'Failed to copy',
            description: 'Clipboard API is not available. Please use a secure (HTTPS) connection.',
            variant: 'destructive',
          });
          return;
        }

        navigator.clipboard.writeText(payloadString).then(() => {
            toast({
                title: 'Payload Copied!',
                description: 'The JSON payload has been copied to your clipboard.',
            });
        }, (err) => {
            console.error('Could not copy text: ', err);
            toast({
                title: 'Failed to copy',
                description: 'Could not copy to clipboard. Check browser permissions.',
                variant: 'destructive',
            });
        });
    };

    const handleCopyAllLogs = () => {
        if (logs.length === 0) {
            toast({ title: "Nothing to Copy", description: "There are no logs on the current page." });
            return;
        }

        const allLogsText = logs.map(log => {
            const timestamp = new Date(log.createdAt).toLocaleString();
            const eventField = getEventField(log);
            const payloadString = JSON.stringify(log.payload, null, 2);
            
            return `--- Log Timestamp: ${timestamp} | Event: ${eventField} ---\n${payloadString}`;
        }).join('\n\n');

        if (!navigator.clipboard) {
          toast({
            title: 'Failed to copy',
            description: 'Clipboard API is not available. Please use a secure (HTTPS) connection.',
            variant: 'destructive',
          });
          return;
        }

        navigator.clipboard.writeText(allLogsText).then(() => {
            toast({
                title: 'Logs Copied!',
                description: `All ${logs.length} logs from this page have been copied to your clipboard.`,
            });
        }, (err) => {
            console.error('Could not copy logs: ', err);
            toast({
                title: 'Failed to copy',
                description: 'Could not copy logs to clipboard. Check browser permissions.',
                variant: 'destructive',
            });
        });
    };


    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <CardTitle>Webhook Event Logs</CardTitle>
                        <CardDescription>A real-time log of events received from Meta. Logs older than 24 hours are cleared automatically.</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                         <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search logs..."
                                className="pl-8 w-full sm:w-64"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleCopyAllLogs} disabled={logs.length === 0 || isRefreshing} variant="outline" size="sm">
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Page Logs
                        </Button>
                        <Button onClick={handleClearLogs} disabled={isClearing} variant="outline" size="sm">
                            {isClearing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Clear Old Logs
                        </Button>
                         <Button onClick={() => fetchLogs(currentPage, searchQuery, true)} disabled={isRefreshing} variant="outline" size="sm">
                            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Event Field</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell>
                                </TableRow>
                                ))
                            ) : logs.length > 0 ? (
                                logs.map((log) => (
                                <TableRow key={log._id.toString()}>
                                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                    <TableCell className="font-mono">{getEventField(log)}</TableCell>
                                    <TableCell>{getEventSummary(log)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <ReprocessButton logId={log._id.toString()} />
                                            <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                    No webhook logs found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                 <div className="flex items-center justify-end space-x-2 py-4">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages > 0 ? totalPages : 1}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p - 1)}
                        disabled={currentPage <= 1 || isRefreshing}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage >= totalPages || isRefreshing}
                    >
                        Next
                    </Button>
                </div>
            </CardContent>

             <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <DialogTitle>Webhook Payload</DialogTitle>
                                <DialogDescription>Full JSON payload received from Meta at {selectedLog ? new Date(selectedLog.createdAt).toLocaleString() : ''}</DialogDescription>
                            </div>
                            {selectedLog && (
                                <Button variant="outline" size="icon" onClick={() => handleCopyPayload(selectedLog.payload)}>
                                    <Copy className="h-4 w-4" />
                                    <span className="sr-only">Copy Payload</span>
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="mt-2 text-sm max-h-[60vh] overflow-y-auto">
                            <pre className="p-4 bg-muted rounded-md whitespace-pre-wrap font-mono text-xs">
                                {JSON.stringify(selectedLog.payload, null, 2)}
                            </pre>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
