

'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getTemplates, getProjectForBroadcast, getBroadcasts, handleStopBroadcast, handleSyncTemplates, handleRunCron } from '@/app/actions';
import type { Project, Template } from '@/app/dashboard/page';
import { BroadcastForm } from '@/components/wabasimplify/broadcast-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, RefreshCw, StopCircle, LoaderCircle, Clock, Play, AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RequeueBroadcastDialog } from '@/components/wabasimplify/requeue-broadcast-dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type Broadcast = {
  _id: any;
  templateId: any;
  templateName: string;
  templateStatus?: string;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Failed' | 'Partial Failure' | 'Cancelled';
  createdAt: string;
  completedAt?: string;
  startedAt?: string;
  messagesPerSecond?: number;
  projectMessagesPerSecond?: number;
};

type RateData = {
    lastProcessedCount: number;
    lastFetchTime: number;
    rate: number;
};

const BROADCASTS_PER_PAGE = 10;

function StopBroadcastButton({ broadcastId }: { broadcastId: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const onStop = () => {
    startTransition(async () => {
        const result = await handleStopBroadcast(broadcastId);
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
          toast({ title: 'Success', description: result.message });
        }
        setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <StopCircle />
          Stop
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to stop this broadcast?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. Any remaining messages in the queue for this broadcast will be cancelled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
              <Button variant="destructive" onClick={onStop} disabled={isPending}>
                  {isPending ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Stopping...
                    </>
                  ) : (
                    'Yes, Stop Broadcast'
                  )}
              </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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

      const hours = Math.floor(difference / 3600000);
      const minutes = Math.floor((difference % 3600000) / 60000);
      const seconds = Math.floor(((difference % 3600000) % 60000) / 1000);

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
    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground font-mono">
      <Clock className="h-4 w-4" />
      <span>{elapsedTime}</span>
    </div>
  );
}

function formatDuration(start: string, end: string) {
    const startDate = new Date(start).getTime();
    const endDate = new Date(end).getTime();
    if (isNaN(startDate) || isNaN(endDate)) return '-';

    let difference = endDate - startDate;
    if (difference < 0) difference = 0;
    
    const hours = Math.floor(difference / 3600000);
    const minutes = Math.floor((difference % 3600000) / 60000);
    const seconds = Math.floor(((difference % 3600000) % 60000) / 1000);

    return [
        String(hours).padStart(2, '0'),
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0')
      ].join(':');
}

function ISTClock() {
    const [time, setTime] = useState<string | null>(null);

    useEffect(() => {
        const updateClock = () => {
            setTime(new Date().toLocaleString('en-US', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            }));
        };
        updateClock(); // Set time on mount on the client
        const timerId = setInterval(updateClock, 1000);
        return () => clearInterval(timerId);
    }, []);

    return (
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground font-mono bg-muted px-3 py-1.5 rounded-md">
        <Clock className="h-4 w-4" />
        <span>{time || '--:--:-- --'} (IST)</span>
        </div>
    );
}

export default function BroadcastPage() {
  const [isClient, setIsClient] = useState(false);
  const [project, setProject] = useState<Pick<WithId<Project>, '_id' | 'phoneNumbers'> | null>(null);
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [history, setHistory] = useState<WithId<Broadcast>[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isSyncingTemplates, startTemplatesSyncTransition] = useTransition();
  const [isRunningCron, startCronRunTransition] = useTransition();
  const { toast } = useToast();
  const [sendRateData, setSendRateData] = useState<Record<string, RateData>>({});
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const fetchHistory = useCallback(async (projectId: string, page: number, showToast = false) => {
    if (!projectId) {
      setHistory([]);
      setTotalPages(0);
      return;
    };
    
    startRefreshTransition(async () => {
        try {
            const { broadcasts: newHistoryData, total } = await getBroadcasts(projectId, page, BROADCASTS_PER_PAGE);
            setHistory(newHistoryData || []);
            setTotalPages(Math.ceil(total / BROADCASTS_PER_PAGE));
            
            const now = Date.now();
            setSendRateData(prevData => {
                const newData = { ...prevData };
                (newHistoryData || []).forEach(item => {
                    const id = item._id.toString();
                    const totalProcessed = (item.successCount ?? 0) + (item.errorCount ?? 0);

                    if (item.status === 'PROCESSING') {
                        const prevItemData = prevData[id];
                        if (prevItemData && now > prevItemData.lastFetchTime) {
                            const deltaTime = (now - prevItemData.lastFetchTime) / 1000;
                            const deltaCount = totalProcessed - prevItemData.lastProcessedCount;
                            const currentRate = deltaTime > 1 ? Math.round(deltaCount / deltaTime) : (prevItemData?.rate ?? 0);
                            newData[id] = { lastProcessedCount: totalProcessed, lastFetchTime: now, rate: currentRate };
                        } else if (!prevItemData) {
                            newData[id] = { lastProcessedCount: totalProcessed, lastFetchTime: now, rate: 0 };
                        }
                    } else if (newData[id]) {
                        delete newData[id];
                    }
                });
                return newData;
            });

            if (showToast) {
                toast({ title: 'Refreshed', description: 'Broadcast history has been updated.' });
            }
        } catch (error) {
            console.error("Failed to fetch broadcast history:", error);
            toast({
                title: "Error",
                description: "Could not fetch history. Please try again.",
                variant: "destructive",
            });
        }
    });
  }, [toast]);
  
  useEffect(() => {
    setIsClient(true);
    const storedProjectId = localStorage.getItem('activeProjectId');
    setActiveProjectId(storedProjectId);
  }, []);

  const onSyncTemplates = useCallback(async () => {
    if (!activeProjectId) {
      toast({ title: "Error", description: "No active project selected.", variant: "destructive" });
      return;
    }
    startTemplatesSyncTransition(async () => {
      const result = await handleSyncTemplates(activeProjectId);
      if (result.error) {
        toast({ title: "Sync Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Sync Successful", description: result.message });
        const templatesData = await getTemplates(activeProjectId);
        setTemplates(templatesData || []);
      }
    });
  }, [toast, startTemplatesSyncTransition, activeProjectId]);

  const onRunCron = useCallback(async () => {
    startCronRunTransition(async () => {
      toast({ title: 'Starting Cron Manually', description: 'The scheduler is now processing queued jobs.' });
      const result = await handleRunCron();
      if (result.error) {
        toast({ title: "Cron Run Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Cron Run Complete", description: result.message });
      }
      // After cron runs, we should refresh the history to see the changes.
      if (activeProjectId) {
        fetchHistory(activeProjectId, currentPage, false);
      }
    });
  }, [toast, fetchHistory, activeProjectId, currentPage]);

  useEffect(() => {
    if (activeProjectId) {
        setLoading(true);
        const fetchPageData = async () => {
            try {
                const [projectData, templatesData] = await Promise.all([
                    getProjectForBroadcast(activeProjectId),
                    getTemplates(activeProjectId),
                ]);
                setProject(projectData as Pick<WithId<Project>, '_id' | 'phoneNumbers'> | null);
                setTemplates(templatesData || []);
                await fetchHistory(activeProjectId, currentPage);
            } catch (error) {
                console.error("Failed to fetch broadcast page data:", error);
                toast({
                    title: "Error",
                    description: "Failed to load page data. Please try again later.",
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };
        fetchPageData();
    } else {
        setLoading(false);
        setHistory([]);
        setTotalPages(0);
    }
  }, [activeProjectId, currentPage, fetchHistory, toast]);


  useEffect(() => {
    if (!isClient || !activeProjectId) return;

    const hasActiveBroadcasts = history.some(
      (b) => b.status === 'QUEUED' || b.status === 'PROCESSING'
    );

    if (!hasActiveBroadcasts || loading) {
      return;
    }

    const interval = setInterval(() => {
      fetchHistory(activeProjectId, currentPage);
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [isClient, history, loading, fetchHistory, activeProjectId, currentPage]);


  const getTemplateStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (!status) return 'secondary';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'approved') return 'default';
    if (lowerStatus.includes('review') || lowerStatus.includes('pending')) return 'secondary';
    return 'destructive';
  };

  if (!isClient || loading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="space-y-2">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Send Broadcast</h1>
          <p className="text-muted-foreground">
            Send a message template to a list of contacts via CSV or XLSX upload.
          </p>
        </div>

        <BroadcastForm templates={templates} project={project} />

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Broadcast History</CardTitle>
                <CardDescription>A log of all broadcast campaigns for the selected project.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <ISTClock />
                 <Button onClick={onRunCron} disabled={isRunningCron || isRefreshing} variant="outline" size="sm">
                  {isRunningCron ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  <span>Run Cron</span>
                </Button>
                <Button onClick={onSyncTemplates} disabled={isSyncingTemplates || isRefreshing} variant="outline" size="sm">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isSyncingTemplates ? 'animate-spin' : ''}`} />
                  Sync Templates
                </Button>
                <Button onClick={() => activeProjectId && fetchHistory(activeProjectId, currentPage, true)} disabled={isRefreshing || isRunningCron} variant="outline" size="sm">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queued</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Template Status</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!activeProjectId ? (
                    <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center">
                            <Alert variant="destructive" className="max-w-md mx-auto">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>No Project Selected</AlertTitle>
                                <AlertDescription>
                                    Please select a project from the main dashboard to view its broadcast history.
                                </AlertDescription>
                            </Alert>
                        </TableCell>
                    </TableRow>
                ) : history.length > 0 ? (
                  history.map((item) => (
                    <TableRow key={item._id.toString()}>
                      <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        {item.status === 'PROCESSING' && item.startedAt ? (
                          <LiveTimer startTime={item.startedAt} />
                        ) : item.completedAt && item.startedAt ? (
                          formatDuration(item.startedAt, item.completedAt)
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{item.templateName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={getTemplateStatusVariant(item.templateStatus)}
                          className="capitalize"
                        >
                          {item.templateStatus?.replace(/_/g, ' ') || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.fileName}</TableCell>
                      <TableCell>{item.contactCount}</TableCell>
                      <TableCell>
                        {item.status === 'PROCESSING' && item.contactCount > 0 ? (
                            <div className="w-48 space-y-1">
                                <div className="text-xs font-mono text-muted-foreground">
                                    <div>{`${(item.successCount ?? 0) + (item.errorCount ?? 0)} / ${item.contactCount}`}</div>
                                    <div>{`Rate: ${sendRateData[item._id.toString()]?.rate ?? 0}/${item.projectMessagesPerSecond ?? item.messagesPerSecond ?? 'N/A'} msg/s`}</div>
                                </div>
                                <Progress value={(((item.successCount ?? 0) + (item.errorCount ?? 0)) * 100) / item.contactCount} className="h-2" />
                            </div>
                        ) : item.successCount !== undefined ? (
                          `${item.successCount} sent, ${item.errorCount || 0} failed`
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === 'QUEUED'
                              ? 'outline'
                              : item.status === 'PROCESSING'
                              ? 'secondary'
                              : item.status === 'Completed'
                              ? 'default'
                              : item.status === 'Partial Failure'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="capitalize"
                        >
                          {item.status?.toLowerCase() || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                           {(item.status === 'QUEUED' || item.status === 'PROCESSING') && (
                                <StopBroadcastButton broadcastId={item._id.toString()} />
                            )}
                            {['Completed', 'Partial Failure', 'Failed', 'Cancelled'].includes(item.status) && (
                                <RequeueBroadcastDialog
                                  broadcastId={item._id.toString()}
                                  originalTemplateId={item.templateId.toString()}
                                  project={project}
                                  templates={templates}
                                />
                            )}
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/dashboard/broadcasts/${item._id.toString()}`}>
                                    <FileText />
                                    <span>View Report</span>
                                </Link>
                            </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      No broadcast history found for this project.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {totalPages > 1 && (
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
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
