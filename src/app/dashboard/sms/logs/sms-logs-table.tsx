'use client';

import { useState, useEffect } from "react";
import { getSmsLogs } from "@/app/actions/sms-logs.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default function SmsLogsTable() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("ALL");

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await getSmsLogs({ page, limit: 15, status, search });
            setLogs(data.logs);
            setTotalPages(data.totalPages);
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1); // Reset page on search change
            fetchLogs();
        }, 500);
        return () => clearTimeout(timer);
    }, [search, status]);

    // Fetch on page change (skip initial mount as search effect handles it, 
    // but we need to verify if page change triggers separately)
    useEffect(() => {
        fetchLogs();
    }, [page]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'DELIVERED': return <Badge className="bg-green-500">Delivered</Badge>;
            case 'SENT': return <Badge className="bg-blue-500">Sent</Badge>;
            case 'FAILED': return <Badge variant="destructive">Failed</Badge>;
            case 'QUEUED': return <Badge variant="secondary">Queued</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Message History</CardTitle>
                        <CardDescription>View all transactional and promotional SMS logs.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchLogs}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </CardHeader>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex gap-4 mb-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by phone number..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            <SelectItem value="DELIVERED">Delivered</SelectItem>
                            <SelectItem value="SENT">Sent</SelectItem>
                            <SelectItem value="FAILED">Failed</SelectItem>
                            <SelectItem value="QUEUED">Queued</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Recipient</TableHead>
                                <TableHead className="w-[40%]">Content</TableHead>
                                <TableHead>Provider</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Sent At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No logs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log._id}>
                                        <TableCell className="font-medium">{log.to}</TableCell>
                                        <TableCell className="max-w-[300px] truncate" title={log.content}>
                                            {log.content}
                                            {log.errorResponse && (
                                                <div className="text-xs text-red-500 mt-1">{log.errorResponse}</div>
                                            )}
                                        </TableCell>
                                        <TableCell className="capitalize">{log.provider}</TableCell>
                                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {log.sentAt ? format(new Date(log.sentAt), 'MMM d, h:mm a') : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                    >
                        <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <div className="text-sm font-medium">
                        Page {page} of {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                    >
                        Next <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
