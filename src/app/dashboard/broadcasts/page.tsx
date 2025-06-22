
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getTemplates, getProjectForBroadcast, getBroadcasts, handleStopBroadcast } from '@/app/actions';
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
import { FileText, RefreshCw, StopCircle, LoaderCircle } from 'lucide-react';
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


type Broadcast = {
  _id: any;
  templateName: string;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Failed' | 'Partial Failure' | 'Cancelled';
  createdAt: string;
  completedAt?: string;
};

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

export default function BroadcastPage() {
  const [isClient, setIsClient] = useState(false);
  const [project, setProject] = useState<Pick<WithId<Project>, '_id' | 'phoneNumbers'> | null>(null);
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [history, setHistory] = useState<WithId<Broadcast>[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { toast } = useToast();

  const fetchHistory = useCallback(async (showToast = false) => {
    try {
      const historyData = await getBroadcasts();
      setHistory(historyData as WithId<Broadcast>[]);
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
  }, [toast]);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) {
      return;
    }
    const storedProjectId = localStorage.getItem('activeProjectId');
    
    async function fetchInitialData() {
      setLoading(true);
      try {
        if (storedProjectId) {
          const [projectData, templatesData] = await Promise.all([
            getProjectForBroadcast(storedProjectId),
            getTemplates(storedProjectId),
          ]);
          setProject(projectData as Pick<WithId<Project>, '_id' | 'phoneNumbers'> | null);
          setTemplates(templatesData as WithId<Template>[]);
        }
        await fetchHistory();
      } catch (error) {
        console.error("Failed to fetch broadcast data:", error);
        toast({
          title: "Error",
          description: "Failed to load page data. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchInitialData();
  }, [isClient, fetchHistory, toast]);

  useEffect(() => {
    if (!isClient) return;

    const hasActiveBroadcasts = history.some(
      (b) => b.status === 'QUEUED' || b.status === 'PROCESSING'
    );

    if (!hasActiveBroadcasts || loading) {
      return;
    }

    const interval = setInterval(() => {
      fetchHistory();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [isClient, history, loading, fetchHistory]);

  const onRefresh = () => {
    startRefreshTransition(() => {
      fetchHistory(true);
    });
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Broadcast History</CardTitle>
                <CardDescription>A log of your 10 most recent broadcast campaigns.</CardDescription>
              </div>
              <Button onClick={onRefresh} disabled={isRefreshing} variant="outline" size="sm">
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queued</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length > 0 ? (
                  history.map((item) => (
                    <TableRow key={item._id.toString()}>
                      <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{item.completedAt ? new Date(item.completedAt).toLocaleString() : '-'}</TableCell>
                      <TableCell>{item.templateName}</TableCell>
                      <TableCell>{item.fileName}</TableCell>
                      <TableCell>{item.contactCount}</TableCell>
                      <TableCell>
                        {item.successCount !== undefined
                          ? `${item.successCount} sent, ${item.errorCount || 0} failed`
                          : '-'}
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
                          {item.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                           {(item.status === 'QUEUED' || item.status === 'PROCESSING') && (
                                <StopBroadcastButton broadcastId={item._id.toString()} />
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
                    <TableCell colSpan={8} className="h-24 text-center">
                      No broadcast history found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
