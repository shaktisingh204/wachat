
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getDashboardStats } from '@/app/actions';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagesSquare, CheckCircle, XCircle, Send, AlertCircle, CheckCheck, Eye } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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

const StatCard = ({ title, value, icon: Icon, description, gradientClass }: { title: string, value: string | number, icon: React.ElementType, description?: string, gradientClass?: string }) => (
    <Card className={cn("card-gradient", gradientClass)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

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
  const [loading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      document.title = "Dashboard Overview | SabNode";
      const storedProjectId = localStorage.getItem('activeProjectId');
      setProjectId(storedProjectId);
      if (storedProjectId) {
        startLoadingTransition(() => {
            getDashboardStats(storedProjectId).then(data => {
                setStats(data);
            });
        });
      } else {
        // If no project is selected, just show the placeholder, don't redirect.
        // The main layout handles redirection if no projects exist at all.
        setStats(null);
      }
    }
  }, [isClient]);

  const sentPercentage = stats ? (stats.totalMessages > 0 ? ((stats.totalSent / stats.totalMessages) * 100).toFixed(1) : '0.0') : '0.0';
  const deliveredPercentage = stats ? (stats.totalSent > 0 ? ((stats.totalDelivered / stats.totalSent) * 100).toFixed(1) : '0.0') : '0.0';
  const readPercentage = stats ? (stats.totalDelivered > 0 ? ((stats.totalRead / stats.totalDelivered) * 100).toFixed(1) : '0.0') : '0.0';


  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Project Overview</h1>
        <p className="text-muted-foreground">Your message analytics for the selected project.</p>
      </div>

       {!projectId ? (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Project Selected</AlertTitle>
            <AlertDescription>
                Please select a project from the main dashboard to view its overview and analytics.
            </AlertDescription>
        </Alert>
       ) : (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                    <>
                        {[...Array(6)].map((_, i) => <StatCardSkeleton key={i} />)}
                    </>
                ) : stats ? (
                    <>
                        <StatCard title="Total Campaigns" value={stats.totalCampaigns} icon={Send} description="All-time broadcasts initiated." gradientClass="card-gradient-purple" />
                        <StatCard title="Total Queued" value={stats.totalMessages} icon={MessagesSquare} description="All-time messages queued for sending." gradientClass="card-gradient-blue" />
                        <StatCard title="Total Sent" value={stats.totalSent} icon={CheckCircle} description={`${sentPercentage}% of queued messages sent.`} gradientClass="card-gradient-green" />
                        <StatCard title="Total Delivered" value={stats.totalDelivered} icon={CheckCheck} description={`${deliveredPercentage}% of sent messages delivered.`} />
                        <StatCard title="Total Read" value={stats.totalRead} icon={Eye} description={`${readPercentage}% of delivered messages read.`} />
                        <StatCard title="Total Failed" value={stats.totalFailed} icon={XCircle} />
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
        </>
       )}
    </div>
  );
}
