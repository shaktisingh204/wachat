
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getDashboardStats, getProjects } from '@/app/actions';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagesSquare, CheckCircle, XCircle, Send, AlertCircle, CheckCheck, Eye } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const AnalyticsChart = dynamic(
  () => import('@/components/wabasimplify/analytics-chart').then(mod => mod.AnalyticsChart),
  {
    ssr: false,
    loading: () => <Skeleton className="min-h-[300px] w-full" />,
  }
);


type DashboardStats = {
  totalMessages: number;
  totalSent: number;
  totalFailed: number;
  totalDelivered: number;
  totalRead: number;
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
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      document.title = "Dashboard Overview | Wachat";
      const storedProjectId = localStorage.getItem('activeProjectId');
      
      setProjectId(storedProjectId);
      if (storedProjectId) {
        startLoadingTransition(() => {
            getDashboardStats(storedProjectId).then(data => {
                setStats(data);
            });
        });
      } else {
        startLoadingTransition(() => {
            getProjects().then(projects => {
                if (projects && projects.length > 0) {
                    router.push('/dashboard');
                } else {
                    router.push('/dashboard/setup');
                }
            });
        });
      }
    }
  }, [isClient, router]);

  const sentPercentage = stats ? (stats.totalMessages > 0 ? ((stats.totalSent / stats.totalMessages) * 100).toFixed(1) : '0.0') : '0.0';
  const deliveredPercentage = stats ? (stats.totalSent > 0 ? ((stats.totalDelivered / stats.totalSent) * 100).toFixed(1) : '0.0') : '0.0';
  const readPercentage = stats ? (stats.totalDelivered > 0 ? ((stats.totalRead / stats.totalDelivered) * 100).toFixed(1) : '0.0') : '0.0';


  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Project Overview</h1>
        <p className="text-muted-foreground">Your message analytics for the selected project.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
            <>
                {[...Array(6)].map((_, i) => <StatCardSkeleton key={i} />)}
            </>
        ) : stats ? (
            <>
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
                <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Queued</CardTitle>
                    <MessagesSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">All-time messages queued for sending.</p>
                </CardContent>
                </Card>
                <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                    <CheckCircle className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{sentPercentage}% of queued messages sent.</p>
                </CardContent>
                </Card>
                <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Delivered</CardTitle>
                    <CheckCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalDelivered.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{deliveredPercentage}% of sent messages delivered.</p>
                </CardContent>
                </Card>
                <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Read</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalRead.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">{readPercentage}% of delivered messages read.</p>
                </CardContent>
                </Card>
                <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Failed</CardTitle>
                    <XCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalFailed.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Messages that failed to send.</p>
                </CardContent>
                </Card>
            </>
        ) : (
             <div className="col-span-full">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Broadcast Data Yet</AlertTitle>
                    <AlertDescription>
                        This project doesn't have any broadcast history. Send a broadcast from the 'Campaigns' page to see analytics here.
                    </AlertDescription>
                </Alert>
            </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="min-h-[350px] w-full" />
      ) : stats && stats.totalCampaigns > 0 ? (
        <Card>
            <CardHeader>
            <CardTitle>Message Performance</CardTitle>
            <CardDescription>Performance of your broadcast messages over the last 30 days.</CardDescription>
            </CardHeader>
            <CardContent>
            <AnalyticsChart />
            </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
