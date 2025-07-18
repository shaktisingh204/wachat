
'use client';

import { useCallback, useEffect, useState, useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";
import { getWebhookLogs, handleClearProcessedLogs, getWebhookLogPayload } from '@/app/actions';
import { handleReprocessWebhook } from '@/app/actions/webhook.actions';
import type { WebhookLogListItem } from '@/lib/definitions';

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
import { Trash2, LoaderCircle, Eye, Search, RefreshCw, Copy, RotateCw, ServerCog, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

const LOGS_PER_PAGE = 15;


function ReprocessButton({ logId, onReprocessComplete }: { logId: string; onReprocessComplete: () => void }) {
    const [isProcessing, startTransition] = useTransition();
    const { toast } = useToast();

    const onReprocess = () => {
        startTransition(async () => {
            const result = await handleReprocessWebhook(logId);
            if (result.error) {
                toast({ title: 'Error Re-processing', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.message });
                onReprocessComplete();
            }
        });
    }

    return (
        <Button variant="ghost" size="icon" onClick={onReprocess} disabled={isProcessing} className="h-7 w-7">
            {isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            <span className="sr-only">Re-process Webhook</span>
        </Button>
    )
}

interface WebhookLogsProps {
  filterByProject?: boolean;
}


export function WebhookLogs({ filterByProject = false }: WebhookLogsProps) {
    const [logs, setLogs] = useState<WebhookLogListItem[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClearing, startClearingTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const [selectedLog, setSelectedLog] = useState<WebhookLogListItem | null>(null);
    const [selectedLogPayload, setSelectedLogPayload] = useState<any | null>(null);
    const [loadingPayload, setLoadingPayload] = useState(false);
    
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        if (filterByProject) {
            const storedProjectId = localStorage.getItem('activeProjectId');
            setProjectId(storedProjectId);
        }
    }, [filterByProject]);

    const fetchLogs = useCallback(async (page: number, query: string, showToast = false) => {
        const idToFetch = filterByProject ? projectId : null;

        if (filterByProject && !projectId) {
            setLogs([]);
            setTotalPages(0);
            return;
        }

        startLoadingTransition(async () => {
            try {
                const { logs: newLogs, total } = await getWebhookLogs(idToFetch, page, LOGS_PER_PAGE, query);
                setLogs(newLogs);
                setTotalPages(Math.ceil(total / LOGS_PER_PAGE));
                if (showToast) {
                    toast({ title: "Refreshed", description: "Webhook logs updated." });
                }
            } catch (error) {
                toast({ title: "Error", description: "Failed to fetch webhook logs.", variant: "destructive" });
            }
        });
    }, [projectId, toast, filterByProject]);

    useEffect(() => {
        if (isClient) {
            if (filterByProject && !projectId) return; // Wait for project ID if filtering
            fetchLogs(currentPage, searchQuery);
        }
    }, [currentPage, searchQuery, fetchLogs, isClient, projectId, filterByProject]);


    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1); 
    }, 300);

    const handleClearLogs = () => {
        startClearingTransition(async () => {
            const result = await handleClearProcessedLogs();
            if (result.error) {
                toast({ title: "Error", description: result.error, variant: "destructive" });
            } else {
                toast({ title: "Success", description: result.message });
                fetchLogs(1, searchQuery, false);
                setCurrentPage(1);
            }
        });
    };
    
    const handleViewLog = async (log: WebhookLogListItem) => {
        setSelectedLog(log);
        setSelectedLogPayload(null);
        setLoadingPayload(true);
        const payload = await getWebhookLogPayload(log._id);
        setSelectedLogPayload(payload);
        setLoadingPayload(false);
    };

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
    
    return (
        <Card className="card-gradient card-gradient-purple">
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <CardTitle>Webhook Event Logs</CardTitle>
                        <CardDescription>{filterByProject ? "Real-time log of events for the selected project." : "A log of all webhook events received by the system."}</CardDescription>
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
                        <Button onClick={handleClearLogs} disabled={isClearing || isLoading} variant="outline" size="sm">
                            {isClearing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Clear Processed Logs
                        </Button>
                         <Button onClick={() => fetchLogs(currentPage, searchQuery, true)} disabled={isLoading} variant="outline" size="sm">
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isClient && filterByProject && !projectId && !isLoading ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No Project Selected</AlertTitle>
                        <AlertDescription>
                            Please select a project from the main dashboard page to view its webhook logs.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Event Field</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell>
                                    </TableRow>
                                    ))
                                ) : logs.length > 0 ? (
                                    logs.map((log) => (
                                    <TableRow key={log._id.toString()}>
                                        <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                        <TableCell className="font-mono">{log.eventField}</TableCell>
                                        <TableCell>{log.eventSummary}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <ReprocessButton logId={log._id.toString()} onReprocessComplete={() => fetchLogs(currentPage, searchQuery, false)} />
                                                <Button variant="ghost" size="icon" onClick={() => handleViewLog(log)} className="h-7 w-7">
                                                    <Eye className="h-4 w-4" />
                                                    <span className="sr-only">View Payload</span>
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
                            disabled={currentPage <= 1 || isLoading}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage >= totalPages || isLoading}
                        >
                            Next
                        </Button>
                    </div>
                    </>
                )}
            </CardContent>

            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <DialogTitle>Webhook Payload</DialogTitle>
                                <DialogDescription>Full JSON payload received from Meta at {selectedLog ? new Date(selectedLog.createdAt).toLocaleString() : ''}</DialogDescription>
                            </div>
                            {selectedLogPayload && (
                                <Button variant="outline" size="icon" onClick={() => handleCopyPayload(selectedLogPayload)}>
                                    <Copy className="h-4 w-4" />
                                    <span className="sr-only">Copy Payload</span>
                                </Button>
                            )}
                        </div>
                    </DialogHeader>
                    <div className="mt-2 text-sm max-h-[60vh] overflow-y-auto">
                        {loadingPayload ? (
                            <div className="flex items-center justify-center p-8">
                                <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : selectedLogPayload ? (
                            <pre className="p-4 bg-muted rounded-md whitespace-pre-wrap font-mono text-xs">
                                {JSON.stringify(selectedLogPayload, null, 2)}
                            </pre>
                        ) : (
                            <div className="text-center text-muted-foreground p-8">Could not load payload.</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
