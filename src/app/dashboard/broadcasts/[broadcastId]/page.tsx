'use client';

import { useState, useEffect, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { WithId } from 'mongodb';
import { getBroadcastById } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, FileText, Clock, Users, Send, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type SuccessfulSend = {
  phone: string;
  messageId: string;
};

type FailedSend = {
  phone: string;
  error: {
    code?: number | string;
    message: string;
  };
};

type Broadcast = {
  _id: any;
  templateName: string;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Failed' | 'Partial Failure';
  createdAt: string;
  processedAt?: string;
  successfulSends?: SuccessfulSend[];
  failedSends?: FailedSend[];
};

export default function BroadcastReportPage() {
  const [broadcast, setBroadcast] = useState<WithId<Broadcast> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const broadcastId = Array.isArray(params.broadcastId) ? params.broadcastId[0] : params.broadcastId;

  const fetchBroadcast = async (showToast = false) => {
    if (!broadcastId) return;
    try {
      const data = await getBroadcastById(broadcastId);
      if (data) {
        setBroadcast(data);
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
    } finally {
        if(loading) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBroadcast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcastId]);

  useEffect(() => {
      if (!broadcast || loading) return;
      if (broadcast.status === 'QUEUED' || broadcast.status === 'PROCESSING') {
          const interval = setInterval(() => fetchBroadcast(), 5000);
          return () => clearInterval(interval);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast, loading]);

  const onRefresh = () => {
    startRefreshTransition(() => {
      fetchBroadcast(true);
    });
  };
  
  const getStatusVariant = (status: string) => {
    status = status.toLowerCase();
    if (status === 'completed') return 'default';
    if (status === 'queued' || status === 'processing' || status === 'partial failure') return 'secondary';
    return 'destructive';
  };

  if (loading) {
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
  
  const allAttempts: ({ status: 'Success'; phone: string; detail: string } | { status: 'Failed'; phone: string; detail: string })[] = [
    ...(broadcast.successfulSends || []).map(s => ({ status: 'Success' as const, phone: s.phone, detail: s.messageId || 'N/A' })),
    ...(broadcast.failedSends || []).map(f => ({
      status: 'Failed' as const,
      phone: f.phone,
      detail: f.error?.code ? `${f.error.code}: ${f.error.message}` : f.error?.message || 'Unknown error details'
    })),
  ];

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
          <Button onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 text-sm">
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
                        <CardDescription>Live status for each contact in the broadcast. This report updates automatically.</CardDescription>
                    </div>
                     <Badge variant={getStatusVariant(broadcast.status)} className="capitalize text-base px-4 py-2">
                        {broadcast.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[50vh]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>Phone Number</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Message ID / Error</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allAttempts.length > 0 ? allAttempts.map((attempt, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-mono">{attempt.phone}</TableCell>
                                    <TableCell>
                                        <Badge variant={attempt.status === 'Success' ? 'default' : 'destructive'}>
                                            {attempt.status === 'Success' ? <CheckCircle className="mr-2 h-4 w-4" /> : <XCircle className="mr-2 h-4 w-4" />}
                                            {attempt.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {attempt.detail}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        {broadcast.status === 'QUEUED' || broadcast.status === 'PROCESSING'
                                            ? 'Processing... results will appear here shortly.'
                                            : 'No results to display for this broadcast.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>

      </div>
    </>
  );
}
