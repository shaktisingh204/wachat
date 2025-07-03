
'use client';

import { useCallback, useEffect, useState, useTransition } from "react";
import { getFlowLogs, getFlowLogById } from '@/app/actions';
import type { FlowLog, FlowLogEntry } from '@/lib/definitions';
import type { WithId } from "mongodb";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from "@/hooks/use-toast";
import { Eye, Search, LoaderCircle, Copy } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";

const LOGS_PER_PAGE = 20;

export const dynamic = 'force-dynamic';

export default function FlowLogsPage() {
    const [logs, setLogs] = useState<(Omit<WithId<FlowLog>, 'entries'>)[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const [selectedLog, setSelectedLog] = useState<WithId<FlowLog> | null>(null);
    const [loadingPayload, setLoadingPayload] = useState(false);
    
    const fetchLogs = useCallback((page: number, query: string) => {
        startTransition(async () => {
            try {
                const { logs: newLogs, total } = await getFlowLogs(page, LOGS_PER_PAGE, query);
                setLogs(newLogs);
                setTotalPages(Math.ceil(total / LOGS_PER_PAGE));
            } catch (error) {
                toast({ title: "Error", description: "Failed to fetch flow logs.", variant: "destructive" });
            }
        });
    }, [toast]);

    useEffect(() => {
        fetchLogs(currentPage, searchQuery);
    }, [currentPage, searchQuery, fetchLogs]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1); 
    }, 500);

    const handleViewLog = async (logSummary: Omit<WithId<FlowLog>, 'entries'>) => {
        setSelectedLog(null);
        setLoadingPayload(true);
        const fullLog = await getFlowLogById(logSummary._id.toString());
        setSelectedLog(fullLog);
        setLoadingPayload(false);
    };

    const handleCopyPayload = (payload: any) => {
        const payloadString = JSON.stringify(payload, null, 2);
        navigator.clipboard.writeText(payloadString).then(() => {
            toast({ title: 'Payload Copied!', description: 'The log data has been copied.' });
        });
    };

    return (
        <>
            <div className="flex flex-col gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Flow Execution Logs</h1>
                    <p className="text-muted-foreground">
                        A detailed log of every time a flow is run for a contact.
                    </p>
                </div>
                <Card className="card-gradient card-gradient-purple">
                    <CardHeader>
                        <CardTitle>All Executions</CardTitle>
                         <div className="relative w-full sm:max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by flow name or contact ID..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>Flow Name</TableHead>
                                        <TableHead>Contact ID</TableHead>
                                        <TableHead>Project ID</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                                        </TableRow>
                                        ))
                                    ) : logs.length > 0 ? (
                                        logs.map((log) => (
                                        <TableRow key={log._id.toString()}>
                                            <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                            <TableCell className="font-medium">{log.flowName}</TableCell>
                                            <TableCell className="font-mono text-xs">{log.contactId.toString()}</TableCell>
                                            <TableCell className="font-mono text-xs">{log.projectId.toString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleViewLog(log)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                            No flow logs found.
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
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1 || isLoading}>Previous</Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages || isLoading}>Next</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <DialogTitle>Flow Log Details</DialogTitle>
                                <DialogDescription>Execution for {selectedLog?.flowName} at {selectedLog ? new Date(selectedLog.createdAt).toLocaleString() : ''}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                     <div className="mt-2">
                        {loadingPayload ? (
                            <div className="flex items-center justify-center p-8">
                                <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : selectedLog ? (
                            <ScrollArea className="max-h-[60vh] p-1">
                                <div className="space-y-3">
                                {selectedLog.entries.map((entry, index) => (
                                    <div key={index} className="text-xs font-mono p-2 rounded-md bg-muted/50 border">
                                        <p><span className="text-primary font-semibold">[{new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}]</span> {entry.message}</p>
                                        {entry.data && (
                                            <details className="mt-1">
                                                <summary className="cursor-pointer text-muted-foreground">View Data</summary>
                                                <pre className="p-2 mt-1 bg-background rounded text-xs whitespace-pre-wrap max-h-48 overflow-auto">{JSON.stringify(entry.data, null, 2)}</pre>
                                            </details>
                                        )}
                                    </div>
                                ))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="text-center text-muted-foreground p-8">Could not load log details.</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
