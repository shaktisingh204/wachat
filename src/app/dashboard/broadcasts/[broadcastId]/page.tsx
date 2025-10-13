

'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import { getBroadcastById, getBroadcastAttempts, getBroadcastAttemptsForExport, getBroadcastLogs } from '@/app/actions/broadcast.actions';
import type { BroadcastAttempt, BroadcastLog } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Check, CheckCheck, XCircle, FileText, Clock, Users, Send, AlertTriangle, Eye, Download, LoaderCircle, CircleDashed, Info, List } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';


type Broadcast = {
  _id: any;
  templateName: string;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  deliveredCount?: number;
  readCount?: number;
  status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Failed' | 'Partial Failure' | 'Cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

type FilterStatus = 'ALL' | 'SENT' | 'FAILED' | 'PENDING' | 'DELIVERED' | 'READ';

const ATTEMPTS_PER_PAGE = 50;

function BroadcastReportSkeleton() {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-4 w-2/3"/></CardHeader><CardContent><Skeleton className="h-6 w-1/2"/></CardContent></Card>)}
        </div>
        <Card>
            <CardHeader><Skeleton className="h-8 w-1/3"/></CardHeader>
            <CardContent>
                <Skeleton className="h-64 w-full"/>
            </CardContent>
        </Card>
      </div>
    );
}

export default function BroadcastReportPage() {
  const [broadcast, setBroadcast] = useState<WithId<Broadcast> | null>(null);
  const [attempts, setAttempts] = useState<BroadcastAttempt[]>([]);
  const [logs, setLogs] = useState<WithId<BroadcastLog>[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isExporting, startExportTransition] = useTransition();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const broadcastId = params.broadcastId as string;

  const fetchPageData = useCallback(async (id: string, page: number, filterValue: FilterStatus, showToast = false) => {
    if (!id || id.startsWith('%5B') || id.endsWith('%5D')) { // Check for placeholder value
      return;
    }
    
    startRefreshTransition(async () => {
        try {
            const [broadcastData, attemptsData, logsData] = await Promise.all([
                getBroadcastById(id),
                getBroadcastAttempts(id, page, ATTEMPTS_PER_PAGE, filterValue),
                getBroadcastLogs(id)
            ]);

            if (broadcastData) {
                setBroadcast(broadcastData);
                setAttempts(attemptsData.attempts);
                setTotalPages(Math.ceil(attemptsData.total / ATTEMPTS_PER_PAGE));
                setLogs(logsData);
            } else {
                toast({ title: "Error", description: "Broadcast not found.", variant: "destructive" });
                router.push('/dashboard/broadcasts');
            }

            if (showToast) {
                toast({ title: "Refreshed", description: "Broadcast details and delivery report updated." });
            }
        } catch (error) {
          console.error("Failed to fetch broadcast details:", error);
          toast({ title: "Error", description: "Failed to load broadcast details.", variant: "destructive" });
        }
    });
  }, [router, toast]);

  useEffect(() => {
    setIsPageLoading(true);
    if(broadcastId) {
        fetchPageData(broadcastId, currentPage, filter).finally(() => setIsPageLoading(false));
    }
  }, [currentPage, filter, fetchPageData, broadcastId]);


  useEffect(() => {
      if (!broadcast || isPageLoading) return;

      const shouldAutoRefresh = broadcast.status === 'QUEUED' || broadcast.status === 'PROCESSING';

      if (shouldAutoRefresh) {
          const interval = setInterval(() => {
            fetchPageData(broadcastId, currentPage, filter, false);
          }, 5000);
          return () => clearInterval(interval);
      }
  }, [broadcast, isPageLoading, fetchPageData, currentPage, filter, broadcastId]);


  const onRefresh = () => {
    fetchPageData(broadcastId, currentPage, filter, true);
  };

  const handleFilterChange = (value: string) => {
    setCurrentPage(1);
    setFilter(value as FilterStatus);
  };
  
  const onExport = () => {
    startExportTransition(async () => {
      try {
        toast({ title: "Preparing Export", description: "Fetching all attempt data, this may take a moment..." });
        const attemptsToExport = await getBroadcastAttemptsForExport(broadcastId, filter);

        if (attemptsToExport.length === 0) {
            toast({ title: "Nothing to Export", description: "No contacts found for the current filter.", variant: "destructive" });
            return;
        }

        const dataForCsv = attemptsToExport.map(attempt => ({
            'Phone Number': attempt.phone,
            'Status': attempt.status,
            'Message ID': attempt.messageId,
            'Details / Error': attempt.error,
            'Timestamp': attempt.sentAt ? new Date(attempt.sentAt).toLocaleString() : '',
        }));

        const csv = Papa.unparse(dataForCsv);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.href) {
            URL.revokeObjectURL(link.href);
        }
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `broadcast_${broadcastId}_${filter}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({ title: "Export Started", description: `Your download of ${attemptsToExport.length} records should begin shortly.` });

      } catch (error) {
        console.error("Failed to export data:", error);
        toast({ title: "Export Error", description: "Could not export the data.", variant: "destructive" });
      }
    });
  };

  const getStatusVariant = (status: string) => {
    status = status.toLowerCase();
    if (status === 'completed') return 'default';
    if (status === 'queued' || status === 'processing' || status === 'partial failure' || status === 'cancelled') return 'secondary';
    return 'destructive';
  };

  const getAttemptStatusBadge = (status: BroadcastAttempt['status']) => {
    switch(status) {
        case 'READ': return <Badge variant="default"><Eye className="mr-2 h-4 w-4" />Read</Badge>;
        case 'DELIVERED': return <Badge variant="secondary"><CheckCheck className="mr-2 h-4 w-4" />Delivered</Badge>;
        case 'SENT': return <Badge variant="outline"><Check className="mr-2 h-4 w-4" />Sent</Badge>;
        case 'FAILED': return <Badge variant="destructive"><XCircle className="mr-2 h-4 w-4" />Failed</Badge>;
        case 'PENDING':
        default:
            return <Badge variant="outline"><CircleDashed className="mr-2 h-4 w-4" />Pending</Badge>;
    }
  };

  const getLogLevelVariant = (level: BroadcastLog['level']) => {
    if (level === 'ERROR') return 'text-destructive';
    if (level === 'WARN') return 'text-yellow-600';
    return 'text-muted-foreground';
  }

  if (isPageLoading) {
    return <BroadcastReportSkeleton />;
  }

  if (!broadcast) {
    return <div>Broadcast not found.</div>;
  }

  const allAttempts = attempts.map((attempt) => {
    let detail = '';
    if (attempt.status === 'SENT' || attempt.status === 'DELIVERED' || attempt.status === 'READ') {
        detail = attempt.messageId || 'Sent successfully';
    } else if (attempt.status === 'FAILED') {
        detail = attempt.error || 'Failed with unknown error';
    } else {
        detail = 'Waiting to be sent...';
    }
    return {
        ...attempt,
        detail,
    };
});

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button variant="ghost" asChild className="mb-2 -ml-4">
              <Link href="/dashboard/broadcasts"><ArrowLeft className="mr-2 h-4 w-4" />Back to Broadcasts</Link>
            </Button>
            <h1 className="text-3xl font-bold font-headline">Broadcast Report</h1>
            <p className="text-muted-foreground">Detailed results for your campaign: <span className="font-semibold">{broadcast.templateName}</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onExport} disabled={isExporting}>
              {isExporting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
            <Button onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{broadcast.contactCount}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sent</CardTitle>
                    <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{broadcast.successCount ?? 0}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Delivered</CardTitle>
                    <CheckCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{broadcast.deliveredCount ?? 0}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Read</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{broadcast.readCount ?? 0}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Failed</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{broadcast.errorCount ?? 0}</div>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <CardTitle>Delivery Results</CardTitle>
                                <p className="text-sm text-muted-foreground">Live status for each contact. This report updates automatically for active campaigns.</p>
                            </div>
                            <Badge variant={getStatusVariant(broadcast.status)} className="capitalize text-base px-4 py-2">
                                {broadcast.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="ALL" className="mb-4" onValueChange={handleFilterChange}>
                            <TabsList>
                                <TabsTrigger value="ALL">All</TabsTrigger>
                                <TabsTrigger value="SENT">Sent</TabsTrigger>
                                <TabsTrigger value="DELIVERED">Delivered</TabsTrigger>
                                <TabsTrigger value="READ">Read</TabsTrigger>
                                <TabsTrigger value="FAILED">Failed</TabsTrigger>
                                <TabsTrigger value="PENDING">Pending</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <ScrollArea className="h-[50vh]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background">
                                    <TableRow>
                                        <TableHead>Phone Number</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Message ID / Error Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isRefreshing && attempts.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">
                                                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : allAttempts.length > 0 ? allAttempts.map((attempt) => (
                                        <TableRow key={attempt._id}>
                                            <TableCell className="font-mono">{attempt.phone}</TableCell>
                                            <TableCell>
                                                {getAttemptStatusBadge(attempt.status)}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {attempt.detail}
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">
                                                No {filter.toLowerCase()} results to display for this broadcast.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
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
                </Card>
            </div>
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><List className="h-5 w-5"/>Broadcast Log</CardTitle>
                        <CardDescription>A real-time log of events for this campaign.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[60vh] border rounded-md p-2">
                             <div className="space-y-3">
                                {logs.length > 0 ? logs.map(log => (
                                    <div key={log._id.toString()} className="text-xs font-mono">
                                        <span className="text-muted-foreground/70">[{new Date(log.timestamp).toLocaleTimeString()}] </span>
                                        <span className={getLogLevelVariant(log.level)}>{log.message}</span>
                                    </div>
                                )) : <p className="text-xs text-muted-foreground text-center p-4">No log entries yet.</p>}
                             </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    </>
  );
}
