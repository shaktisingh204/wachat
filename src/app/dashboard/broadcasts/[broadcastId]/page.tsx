
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import { getBroadcastById, getBroadcastAttempts, type BroadcastAttempt } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, FileText, Clock, Users, Send, AlertTriangle, CalendarCheck, CircleDashed, Play } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Broadcast = {
  _id: any;
  templateName: string;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Failed' | 'Partial Failure' | 'Cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

type FilterStatus = 'ALL' | 'SENT' | 'FAILED' | 'PENDING';

const ATTEMPTS_PER_PAGE = 50;

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    if (isNaN(start)) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      const difference = now - start;
      if (difference < 0) return;

      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / (1000 * 60)) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      const formattedTime = [
        String(hours).padStart(2, '0'),
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0')
      ].join(':');
      
      setElapsedTime(formattedTime);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [startTime]);

  return (
    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground font-mono bg-muted px-3 py-1.5 rounded-md">
      <Clock className="h-4 w-4" />
      <span>{elapsedTime}</span>
    </div>
  );
}

export default function BroadcastReportPage() {
  const [broadcast, setBroadcast] = useState<WithId<Broadcast> | null>(null);
  const [attempts, setAttempts] = useState<BroadcastAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const broadcastId = Array.isArray(params.broadcastId) ? params.broadcastId[0] : params.broadcastId;

  const fetchPageData = useCallback(async (page: number, filterValue: FilterStatus, showToast = false) => {
    if (!broadcastId) {
      setLoading(false);
      return;
    }
    
    startRefreshTransition(async () => {
        try {
            const [broadcastData, attemptsData] = await Promise.all([
                getBroadcastById(broadcastId),
                getBroadcastAttempts(broadcastId, page, ATTEMPTS_PER_PAGE, filterValue),
            ]);

            if (broadcastData) {
                setBroadcast(broadcastData);
                setAttempts(attemptsData.attempts);
                setTotalPages(Math.ceil(attemptsData.total / ATTEMPTS_PER_PAGE));
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
  }, [broadcastId, router, toast]);

  useEffect(() => {
    setLoading(true);
    fetchPageData(currentPage, filter).finally(() => setLoading(false));
  }, [currentPage, filter, fetchPageData]);


  useEffect(() => {
      if (!broadcast || loading) return;

      const shouldAutoRefresh = broadcast.status === 'QUEUED' || broadcast.status === 'PROCESSING';

      if (shouldAutoRefresh) {
          const interval = setInterval(() => {
            fetchPageData(currentPage, filter, false);
          }, 5000);
          return () => clearInterval(interval);
      }
  }, [broadcast, loading, fetchPageData, currentPage, filter]);


  const onRefresh = () => {
    fetchPageData(currentPage, filter, true);
  };

  const handleFilterChange = (value: string) => {
    setCurrentPage(1);
    setFilter(value as FilterStatus);
  };
  
  const getStatusVariant = (status: string) => {
    status = status.toLowerCase();
    if (status === 'completed') return 'default';
    if (status === 'queued' || status === 'processing' || status === 'partial failure' || status === 'cancelled') return 'secondary';
    return 'destructive';
  };

  const getAttemptStatusBadge = (status: BroadcastAttempt['status']) => {
    switch(status) {
        case 'SENT': return <Badge variant="default"><CheckCircle className="mr-2 h-4 w-4" />Sent</Badge>;
        case 'FAILED': return <Badge variant="destructive"><XCircle className="mr-2 h-4 w-4" />Failed</Badge>;
        case 'PENDING':
        default:
            return <Badge variant="outline"><CircleDashed className="mr-2 h-4 w-4" />Pending</Badge>;
    }
  };

  if (loading && currentPage === 1) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!broadcast) {
    return <div>Broadcast not found.</div>;
  }

  const allAttempts = attempts.map((attempt) => {
    let detail = '';
    if (attempt.status === 'SENT') {
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
            <p className="text-muted-foreground">Detailed results for your campaign.</p>
          </div>
          <div className="flex items-center gap-4">
            {broadcast.status === 'PROCESSING' && broadcast.startedAt && (
                <LiveTimer startTime={broadcast.startedAt} />
            )}
            <Button onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
          </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 text-sm">
                    <div className="flex items-start gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        <div>
                            <p className="text-muted-foreground">Template</p>
                            <p className="font-semibold">{broadcast.templateName}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Clock className="h-8 w-8 text-primary" />
                        <div>
                            <p className="text-muted-foreground">Queued At</p>
                            <p className="font-semibold">{new Date(broadcast.createdAt).toLocaleString()}</p>
                        </div>
                    </div>
                    {broadcast.startedAt && (
                        <div className="flex items-start gap-3">
                            <Play className="h-8 w-8 text-primary" />
                            <div>
                                <p className="text-muted-foreground">Started At</p>
                                <p className="font-semibold">{new Date(broadcast.startedAt).toLocaleString()}</p>
                            </div>
                        </div>
                    )}
                    {broadcast.completedAt && (
                        <div className="flex items-start gap-3">
                            <CalendarCheck className="h-8 w-8 text-primary" />
                            <div>
                                <p className="text-muted-foreground">Completed At</p>
                                <p className="font-semibold">{new Date(broadcast.completedAt).toLocaleString()}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-start gap-3">
                        <Users className="h-8 w-8 text-primary" />
                         <div>
                            <p className="text-muted-foreground">Total Contacts</p>
                            <p className="font-semibold">{broadcast.contactCount}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Send className="h-8 w-8 text-green-500" />
                         <div>
                            <p className="text-muted-foreground">Sent Successfully</p>
                            <p className="font-semibold">{broadcast.successCount ?? 0}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                         <div>
                            <p className="text-muted-foreground">Failed to Send</p>
                            <p className="font-semibold">{broadcast.errorCount ?? 0}</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Delivery Results</CardTitle>
                        <CardDescription>Live status for each contact. This report updates automatically for active campaigns.</CardDescription>
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
                                        Loading results...
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
                        disabled={currentPage <= 1}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage >= totalPages}
                    >
                        Next
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </>
  );
}

