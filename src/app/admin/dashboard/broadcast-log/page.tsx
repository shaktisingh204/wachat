
'use client';

import { useCallback, useEffect, useState, useTransition } from "react";
import { getAllBroadcasts } from '@/app/actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WithId } from 'mongodb';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, LoaderCircle } from "lucide-react";


const BROADCASTS_PER_PAGE = 20;

export default function BroadcastLogPage() {
    const [broadcasts, setBroadcasts] = useState<WithId<any>[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const totalPages = Math.ceil(total / BROADCASTS_PER_PAGE);

    const fetchBroadcasts = useCallback((page: number) => {
        startTransition(async () => {
            try {
                const { broadcasts: data, total: totalCount } = await getAllBroadcasts(page, BROADCASTS_PER_PAGE);
                setBroadcasts(data);
                setTotal(totalCount);
            } catch (error) {
                toast({ title: "Error", description: "Failed to fetch broadcast logs.", variant: "destructive" });
            }
        });
    }, [toast]);

    useEffect(() => {
        fetchBroadcasts(currentPage);
    }, [currentPage, fetchBroadcasts]);

    const getStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
        if (!status) return 'secondary';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'completed') return 'default';
        if (lowerStatus === 'queued' || lowerStatus === 'processing' || lowerStatus === 'partial failure' || lowerStatus === 'cancelled') return 'secondary';
        return 'destructive';
    };

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">System-Wide Broadcast Log</h1>
                <p className="text-muted-foreground">
                    A raw log of all broadcasts in the database for debugging purposes.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <CardTitle>All Broadcasts</CardTitle>
                            <CardDescription>This view shows all records from the broadcasts collection. Total: {total.toLocaleString()}</CardDescription>
                        </div>
                         <Button onClick={() => fetchBroadcasts(currentPage)} disabled={isLoading} variant="outline" size="sm">
                            {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Template Name</TableHead>
                                    <TableHead>Project ID</TableHead>
                                    <TableHead>Stats</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : broadcasts.length > 0 ? (
                                    broadcasts.map((broadcast) => (
                                        <TableRow key={broadcast._id.toString()}>
                                            <TableCell>{new Date(broadcast.createdAt).toLocaleString()}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(broadcast.status)} className="capitalize">
                                                    {broadcast.status?.toLowerCase() || 'unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{broadcast.templateName || 'N/A'}</TableCell>
                                            <TableCell className="font-mono text-xs">{broadcast.projectId?.toString() || 'N/A'}</TableCell>
                                            <TableCell>{`${broadcast.successCount || 0} sent / ${broadcast.errorCount || 0} failed`}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No broadcasts found for this page.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="flex flex-wrap items-center justify-end space-x-2 py-4">
                        <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
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
                </CardContent>
            </Card>
        </div>
    );
}
