

'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import type { WithId } from 'mongodb';
import { getTemplates, handleStopBroadcast } from '@/app/actions/index.ts';
import { handleSyncTemplates } from '@/app/actions/template.actions';
import { useRouter } from 'next/navigation';
import type { Project, Template, MetaFlow } from '@/lib/definitions';
import { BroadcastForm } from '@/components/wabasimplify/broadcast-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import {Calendar} from 'lucide-react';
import { useProject } from '@/context/project-context';
import { getBroadcasts } from '@/app/actions/broadcast.actions';

type Broadcast = {
  _id: any;
  templateId: any;
  templateName: string;
  deliveredCount?: number;
  readCount?: number;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Failed' | 'Partial Failure' | 'Cancelled' | 'PENDING_PROCESSING';
  createdAt: string;
  completedAt?: string;
  startedAt?: string;
  messagesPerSecond?: number;
  projectMessagesPerSecond?: number;
};

const BROADCASTS_PER_PAGE = 10;

function StopBroadcastButton({ broadcastId, size = 'sm' }: { broadcastId: string, size?: 'sm' | 'default' | 'lg' | 'icon' | null }) {
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
        <Button variant="destructive" size={size}>
          <StopCircle className="mr-2 h-4 w-4"/>
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

function BroadcastPageSkeleton() {
    return (
      <div className="flex flex-col gap-8">
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

export default function BroadcastPage() {
  const { activeProject, activeProjectId } = useProject();
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [metaFlows, setMetaFlows] = useState<WithId<MetaFlow>[]>([]);
  const [history, setHistory] = useState<WithId<Broadcast>[]>([]);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isSyncingTemplates, startTemplatesSyncTransition] = useTransition();
  const { toast } = useToast();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const getFormattedDate = (dateString?: string) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
          return 'Invalid Date';
      }
      return date.toLocaleString();
  };

  const fetchData = useCallback(async (projectId: string, page: number, showToast = false) => {
    startRefreshTransition(async () => {
        try {
            const [templatesData, historyData, metaFlowsData] = await Promise.all([
                getTemplates(projectId),
                getBroadcasts(projectId, page, BROADCASTS_PER_PAGE),
                getMetaFlows(projectId),
            ]);

            setTemplates(templatesData || []);
            setMetaFlows(metaFlowsData || []);
            setHistory(historyData.broadcasts || []);
            setTotalPages(Math.ceil(historyData.total / BROADCASTS_PER_PAGE));
            
            if (showToast) {
              toast({ title: 'Refreshed', description: 'Broadcast history has been updated.' });
            }
        } catch (error) {
            console.error("Failed to fetch broadcast page data:", error);
            toast({
                title: "Error",
                description: "Failed to load page data. Please try again later.",
                variant: "destructive",
            });
        }
    });
  }, [toast]);
  
  useEffect(() => {
    if (activeProjectId) {
      fetchData(activeProjectId, currentPage);
    }
  }, [activeProjectId, currentPage, fetchData]);
  
  useEffect(() => {
    if (!activeProjectId || isRefreshing) return;

    const hasActiveBroadcasts = history.some(b => b.status === 'QUEUED' || b.status === 'PROCESSING' || b.status === 'PENDING_PROCESSING');
    if (!hasActiveBroadcasts) return;

    const interval = setInterval(() => {
      fetchData(activeProjectId, currentPage, false);
    }, 5000);

    return () => clearInterval(interval);
  }, [history, activeProjectId, currentPage, fetchData, isRefreshing]);

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
  }, [toast, activeProjectId]);

  const getStatusVariant = (item: WithId<Broadcast>) => {
    const status = item.status;
    if (!status) return 'outline';
    return status === 'QUEUED'
            ? 'outline'
            : status === 'PROCESSING' || status === 'PENDING_PROCESSING'
            ? 'secondary'
            : status === 'Completed'
            ? 'default'
            : status === 'Partial Failure'
            ? 'secondary'
            : 'destructive';
  };

  const isLoadingData = isRefreshing && !activeProject;

  const onBroadcastSuccess = () => {
      if (activeProjectId) {
        if (currentPage === 1) {
            fetchData(activeProjectId, 1, false);
        } else {
            setCurrentPage(1);
        }
      }
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

        {isLoadingData ? (
            <Skeleton className="h-64 w-full"/>
        ) : (
            <BroadcastForm 
                templates={templates} 
                metaFlows={metaFlows} 
                onSuccess={onBroadcastSuccess}
            />
        )}

        <Card className="card-gradient card-gradient-blue">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Broadcast History</CardTitle>
                <CardDescription>A log of all broadcast campaigns for the selected project.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ISTClock />
                <Button onClick={onSyncTemplates} disabled={isSyncingTemplates || isRefreshing} variant="outline" size="sm">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isSyncingTemplates ? 'animate-spin' : ''}`} />
                  Sync Templates
                </Button>
                <Button onClick={() => activeProjectId && fetchData(activeProjectId, currentPage, true)} disabled={isRefreshing} variant="outline" size="sm">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
                <div className="h-24 text-center flex items-center justify-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : !activeProjectId ? (
                 <Alert variant="destructive" className="max-w-md mx-auto">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to view its broadcast history.
                    </AlertDescription>
                </Alert>
            ) : history.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Queued</TableHead>
                        <TableHead>Template / Flow</TableHead>
                        <TableHead>Delivery Stats</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {history.map((item) => (
                          <TableRow key={item._id.toString()}>
                            <TableCell>{getFormattedDate(item.createdAt)}</TableCell>
                            <TableCell>{item.templateName}</TableCell>
                            <TableCell>
                                <div className="w-40 space-y-1">
                                    <div className="text-xs font-mono">
                                    <div>Sent: {item.successCount ?? 0} / {item.contactCount}</div>
                                    <div>Delivered: {item.deliveredCount ?? 0} | Read: {item.readCount ?? 0}</div>
                                    <div className="text-destructive">Failed: {item.errorCount ?? 0}</div>
                                    </div>
                                    {item.status === 'PROCESSING' && item.contactCount > 0 && (
                                        <Progress value={(((item.successCount ?? 0) + (item.errorCount ?? 0)) * 100) / item.contactCount} className="h-1 mt-1" />
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>{item.fileName}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(item)} className="capitalize">
                                {item.status?.toLowerCase() || 'unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {(item.status === 'QUEUED' || item.status === 'PROCESSING' || item.status === 'PENDING_PROCESSING') && (
                                      <StopBroadcastButton broadcastId={item._id.toString()} />
                                  )}
                                  {['Completed', 'Partial Failure', 'Failed', 'Cancelled'].includes(item.status) && (
                                      <RequeueBroadcastDialog
                                        broadcastId={item._id.toString()}
                                        originalTemplateId={item.templateId?.toString()}
                                        project={activeProject}
                                        templates={templates}
                                      />
                                  )}
                                  <Button asChild variant="outline" size="sm">
                                      <Link href={`/dashboard/broadcasts/${item._id.toString()}`}>
                                          <FileText className="mr-2 h-4 w-4" />
                                          <span>Report</span>
                                      </Link>
                                  </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {history.map((item) => (
                      <Card key={item._id.toString()} className="border card-gradient card-gradient-blue">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                              <CardTitle className="text-base leading-snug">{item.templateName}</CardTitle>
                              <Badge variant={getStatusVariant(item)} className="capitalize">{item.status?.toLowerCase() || 'unknown'}</Badge>
                          </div>
                          <CardDescription className="text-xs">{getFormattedDate(item.createdAt)}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                          {item.status === 'PROCESSING' && item.contactCount > 0 && (
                              <div className="w-full space-y-1">
                                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                                    <span>{`${(item.successCount ?? 0) + (item.errorCount ?? 0)} / ${item.contactCount}`}</span>
                                  </div>
                                  <Progress value={(((item.successCount ?? 0) + (item.errorCount ?? 0)) * 100) / item.contactCount} className="h-2" />
                              </div>
                          )}
                           <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                              <div className="flex justify-between"><span className="text-muted-foreground">Contacts:</span> <span className="font-medium">{item.contactCount}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Sent:</span> <span className="font-medium">{item.successCount || 0}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Failed:</span> <span className="font-medium">{item.errorCount || 0}</span></div>
                              <div className="flex justify-between col-span-2"><span className="text-muted-foreground">File:</span> <span className="font-medium truncate">{item.fileName}</span></div>
                           </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2">
                             {(item.status === 'QUEUED' || item.status === 'PROCESSING' || item.status === 'PENDING_PROCESSING') && <StopBroadcastButton broadcastId={item._id.toString()} size="sm" />}
                              {['Completed', 'Partial Failure', 'Failed', 'Cancelled'].includes(item.status) && (
                                <RequeueBroadcastDialog
                                  broadcastId={item._id.toString()}
                                  originalTemplateId={item.templateId?.toString()}
                                  project={activeProject}
                                  templates={templates}
                                />
                              )}
                              <Button asChild variant="outline" size="sm">
                                  <Link href={`/dashboard/broadcasts/${item._id.toString()}`}>
                                      <FileText className="mr-2 h-4 w-4" />
                                      <span>Report</span>
                                  </Link>
                              </Button>
                        </CardFooter>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-24 text-center flex items-center justify-center">
                  No broadcast history found for this project.
              </div>
            )}
            
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
