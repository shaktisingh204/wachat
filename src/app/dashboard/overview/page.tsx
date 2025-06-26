
'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagesSquare, CheckCircle, XCircle, Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AnalyticsChart } from '@/components/wabasimplify/analytics-chart';

type DashboardStats = {
  totalMessages: number;
  totalSent: number;
  totalFailed: number;
  totalCampaigns: number;
};

function StatCardSkeleton() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-8 w-1/3 mb-2" />
                <Skeleton className="h-3 w-1/2" />
            </CardContent>
        </Card>
    );
}


export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Dashboard Overview | Wachat";
    const storedProjectId = localStorage.getItem('activeProjectId');
    setProjectId(storedProjectId);

    if (storedProjectId) {
      getDashboardStats(storedProjectId).then(data => {
        setStats(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="text-3xl font-bold font-headline">Project Overview</h1>
            <p className="text-muted-foreground">Your message analytics for the selected project.</p>
          </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Message Performance</CardTitle>
                    <CardDescription>Performance of your broadcast messages over the last 30 days.</CardDescription>
                </CardHeader>
                <CardContent>
                   <Skeleton className="min-h-[300px] w-full" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!projectId) {
    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline">Project Overview</h1>
                <p className="text-muted-foreground">Your message analytics for the selected project.</p>
            </div>
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard page to see its analytics.
                </AlertDescription>
            </Alert>
        </div>
    );
  }
  
  if (!stats) {
      return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Project Overview</h1>
                <p className="text-muted-foreground">Your message analytics for the selected project.</p>
            </div>
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Broadcast Data Yet</AlertTitle>
                <AlertDescription>
                    This project doesn't have any broadcast history. Send a broadcast from the 'Broadcasts' page to see analytics here.
                </AlertDescription>
            </Alert>
        </div>
      )
  }

  const deliveredPercentage = stats.totalMessages > 0 ? ((stats.totalSent / stats.totalMessages) * 100).toFixed(1) : '0.0';
  const failedPercentage = stats.totalMessages > 0 ? ((stats.totalFailed / stats.totalMessages) * 100).toFixed(1) : '0.0';

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Project Overview</h1>
        <p className="text-muted-foreground">Your message analytics for the selected project.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessagesSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All-time messages queued.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <CheckCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{deliveredPercentage}% of all messages sent.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFailed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{failedPercentage}% of all messages failed.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
             <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCampaigns.toLocaleString()}</div>
             <p className="text-xs text-muted-foreground">All-time broadcasts initiated.</p>
          </CardContent>
        </Card>
      </div>

      {stats.totalCampaigns > 0 ? (
        <Card>
            <CardHeader>
            <CardTitle>Message Performance</CardTitle>
            <CardDescription>Performance of your broadcast messages over the last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
            <AnalyticsChart />
            </CardContent>
        </Card>
      ) : (
        <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Broadcast Data Yet</AlertTitle>
            <AlertDescription>
                This project doesn't have any broadcast history. Send a broadcast from the 'Broadcasts' page to see analytics here.
            </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
