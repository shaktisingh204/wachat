
'use client';

import React, { useEffect, useState, useTransition, useCallback } from 'react';
import { getFlowLogs } from '@/app/actions';
import type { FlowLog } from '@/app/actions';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { GitBranch, LoaderCircle } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { Badge } from '../ui/badge';

export function LiveFlowLogFeed() {
  const [logs, setLogs] = useState<(Omit<WithId<FlowLog>, 'entries'>)[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchLogs = useCallback(() => {
    startTransition(async () => {
      try {
        const { logs: newLogs } = await getFlowLogs(1, 15);
        setLogs(newLogs);
      } catch (error) {
        console.error("Failed to fetch flow logs:", error);
      }
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
    fetchLogs();
    const interval = setInterval(fetchLogs, 20000); // Poll every 20 seconds
    return () => clearInterval(interval);
  }, [fetchLogs]);
  
  if (!isClient) {
    return (
        <Card className="shadow-none rounded-none border-none bg-transparent h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
                <div className="space-y-1">
                    <CardTitle className="text-base">Live Flow Executions</CardTitle>
                    <CardDescription className="text-xs">Real-time log of triggered flows.</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-2 flex-1 overflow-hidden space-y-2">
                 {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </CardContent>
        </Card>
    ); 
  }
  
  return (
    <Card className="shadow-none rounded-none border-none bg-transparent h-full flex flex-col">
    <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <div className="space-y-1">
            <CardTitle className="text-base">Live Flow Executions</CardTitle>
            <CardDescription className="text-xs">Real-time log of triggered flows.</CardDescription>
        </div>
         {isPending && <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />}
    </CardHeader>
    <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
        <div className="p-2 space-y-2">
            {isPending && logs.length === 0 ? (
                 <div className="p-2 space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
            ) : logs.length > 0 ? (
            logs.map(log => (
                <div key={log._id.toString()} className="p-3 rounded-md border bg-muted/50">
                    <div className="flex items-start gap-3">
                        <GitBranch className="h-4 w-4 mt-1 flex-shrink-0 text-primary" />
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-semibold truncate">{log.flowName}</p>
                            <div className="text-xs text-muted-foreground flex items-center justify-between">
                                <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <Badge variant="outline" className="font-mono text-xs">{log.contactId.toString().slice(-6)}</Badge>
                            </div>
                        </div>
                    </div>
                </div>
            ))
            ) : (
            <div className="h-full flex items-center justify-center p-4 text-sm text-muted-foreground">
                No recent flow executions.
            </div>
            )}
        </div>
        </ScrollArea>
    </CardContent>
    <CardFooter className="p-2 border-t">
        <Button asChild variant="link" className="w-full h-8 text-xs text-muted-foreground">
            <Link href="/admin/dashboard/flow-logs">View All Logs &rarr;</Link>
        </Button>
    </CardFooter>
    </Card>
  );
}
