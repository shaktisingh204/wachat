'use client';

import { useState, useEffect, useTransition } from 'react';
import { getCronLogs } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

type CronLog = {
  _id: string;
  timestamp: string;
  level: 'INFO' | 'ERROR';
  message: string;
  details?: any;
};

export default function CronLogsPage() {
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const { toast } = useToast();

  const fetchLogs = async (showToast = false) => {
    try {
      const logsData = await getCronLogs();
      setLogs(logsData);
      if (showToast) {
        toast({ title: "Logs Refreshed", description: "The latest cron job logs have been loaded." });
      }
    } catch (error) {
      console.error("Failed to fetch cron logs:", error);
      toast({ title: "Error", description: "Could not fetch cron logs.", variant: "destructive" });
    } finally {
      if(loading) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    startRefreshTransition(() => {
      fetchLogs(true);
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-10 w-1/3" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Cron Job Logs</h1>
          <p className="text-muted-foreground">A live feed of the background broadcast sending job.</p>
        </div>
        <Button onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Logs
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Log Entries</CardTitle>
          <CardDescription>Showing the last 100 log entries, newest first. Check these logs if broadcasts are stuck.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[70vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={log.level === 'ERROR' ? 'destructive' : 'secondary'}>
                          {log.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{log.message}</TableCell>
                      <TableCell>
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <pre className="text-xs bg-muted p-2 rounded-md font-mono whitespace-pre-wrap max-w-md">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No cron job logs found. A log should appear here within a minute of the first broadcast attempt.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
