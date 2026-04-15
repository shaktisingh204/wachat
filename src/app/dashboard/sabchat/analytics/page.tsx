'use client';

import { useEffect, useState, useTransition } from 'react';
import { getSabChatAnalytics } from '@/app/actions/sabchat.actions';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { MessageSquare, Inbox, CheckCircle, Clock, Smile, BarChart2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const ChartContainer = dynamic(
  () => import('@/components/ui/chart').then(mod => mod.ChartContainer),
  { ssr: false, loading: () => <div className="animate-pulse rounded-clay-md bg-clay-border" style={{ height: '16rem' }} /> },
);
const ChartTooltip = dynamic(
  () => import('@/components/ui/chart').then(mod => mod.ChartTooltip),
  { ssr: false },
);
const ChartTooltipContent = dynamic(
  () => import('@/components/ui/chart').then(mod => mod.ChartTooltipContent),
  { ssr: false },
);

const chartConfig = { count: { label: 'Chats', color: 'hsl(var(--primary))' } };

const StatCard = ({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
}) => (
  <ClayCard>
    <div className="flex items-center justify-between">
      <p className="text-[12px] text-clay-ink-muted">{title}</p>
      <Icon className="h-4 w-4 text-clay-ink-muted" />
    </div>
    <div className="mt-2 text-[28px] font-semibold text-clay-ink">{value}</div>
  </ClayCard>
);

function AnalyticsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-clay-md bg-clay-border" style={{ height: '7rem' }} />
        ))}
      </div>
      <div className="animate-pulse rounded-clay-md bg-clay-border" style={{ height: '22rem' }} />
    </div>
  );
}

export default function SabChatAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const analyticsData = await getSabChatAnalytics();
      setData(analyticsData);
    });
  }, []);

  if (isLoading || !data) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Analytics"
        subtitle="SabChat performance metrics"
        icon={BarChart2}
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Chats" value={data.totalChats.toLocaleString()} icon={MessageSquare} />
        <StatCard title="Open Chats" value={data.openChats.toLocaleString()} icon={Inbox} />
        <StatCard title="Closed Chats" value={data.closedChats.toLocaleString()} icon={CheckCircle} />
        <StatCard title="Avg. First Response" value={`${data.avgResponseTime}s`} icon={Clock} />
        <StatCard title="Customer Satisfaction" value={`${data.satisfaction}%`} icon={Smile} />
      </div>

      <ClayCard>
        <h2 className="mb-4 text-[15px] font-semibold text-clay-ink">Daily Chat Volume</h2>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={data.dailyChatVolume} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </ClayCard>
    </div>
  );
}
