"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { 
  Activity, 
  CheckCircle2, 
  GitMerge, 
  AlertCircle, 
  Plus, 
  Play,
  RefreshCcw
} from "lucide-react";
import { StatCard } from '@/components/sabcrm/20ui';
import { PageHeader, PageHeading, PageTitle, PageDescription, PageActions } from '@/components/sabcrm/20ui';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/sabcrm/20ui';
import { Recharts, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui';
import { Button } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui';
import { Input } from '@/components/sabcrm/20ui';
import { DateRangePicker } from '@/components/sabcrm/20ui';
import type { DateRange } from "react-day-picker";
import Link from "next/link";
import { getSabflowDashboardData, retryExecution } from "../actions";

export function DashboardClient({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<{from?: string; to?: string}>({});
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const loadData = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      const res = await getSabflowDashboardData(filters);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      if (showIndicator) setIsRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    // Real-time SSE integration for live updates
    const eventSource = new EventSource('/dashboard/sabflow/api/sse');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'update') {
          loadData(false);
        }
      } catch (e) {
        console.error("Error parsing SSE data", e);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE Error:", error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [loadData]);

  const handleApplyFilters = () => {
    setFilters({
       from: dateRange?.from ? dateRange.from.toISOString() : undefined,
       to: dateRange?.to ? dateRange.to.toISOString() : undefined,
    });
    loadData(true);
  };

  const handleRetry = async (id: string) => {
    try {
      await retryExecution(id);
      loadData(true);
    } catch (e) {
      console.error(e);
    }
  };

  const { stats, chartData, recentActivity } = data;

  return (
    <div className="flex flex-col gap-8 p-6 md:p-8">
      <PageHeader bordered={false}>
        <PageHeading>
          <PageTitle>Overview</PageTitle>
          <PageDescription>
            Monitor your Sabflow executions, active workflows, and system health.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <div className="flex gap-2 mr-4 min-w-[280px]">
             <DateRangePicker 
                value={dateRange}
                onChange={setDateRange}
             />
             <Button variant="outline" onClick={handleApplyFilters}>Filter</Button>
          </div>
          <Button variant="ghost" onClick={() => loadData(true)} leading={<RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}>
            Refresh
          </Button>
          <Button variant="outline" leading={<Play className="w-4 h-4" />}>
            Run Flow
          </Button>
          <Button asChild leading={<Plus className="w-4 h-4" />}>
            <Link href="/dashboard/sabflow/flow-builder">
              New Flow
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Executions"
          value={stats.totalExecutions.toLocaleString()}
          icon={<Activity />}
        />
        <StatCard
          label="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          icon={<CheckCircle2 />}
        />
        <StatCard
          label="Active Flows"
          value={stats.activeFlows.toLocaleString()}
          icon={<GitMerge />}
        />
        <StatCard
          label="Error Rate"
          value={`${stats.errorRate.toFixed(1)}%`}
          icon={<AlertCircle />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Execution Volume</CardTitle>
            <CardDescription>
              Success vs failed executions over time.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ChartContainer height={300}>
              <Recharts.AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--st-status-ok)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--st-status-ok)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--st-danger)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--st-danger)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
                <Recharts.XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }} 
                  dy={10} 
                />
                <Recharts.YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }} 
                />
                <Recharts.Tooltip content={<ChartTooltip />} />
                <Recharts.Area 
                  type="monotone" 
                  dataKey="success" 
                  stroke="var(--st-status-ok)" 
                  fillOpacity={1} 
                  fill="url(#colorSuccess)" 
                  strokeWidth={2}
                />
                <Recharts.Area 
                  type="monotone" 
                  dataKey="failed" 
                  stroke="var(--st-danger)" 
                  fillOpacity={1} 
                  fill="url(#colorFailed)" 
                  strokeWidth={2}
                />
              </Recharts.AreaChart>
            </ChartContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest flow executions.</CardDescription>
          </CardHeader>
          <CardBody className="p-0 sm:p-0">
            <Table>
              <THead>
                <Tr>
                  <Th>Flow</Th>
                  <Th>Status</Th>
                  <Th>Action</Th>
                  <Th className="text-right">Time</Th>
                </Tr>
              </THead>
              <TBody>
                {recentActivity.map((activity: any) => (
                  <Tr key={activity.id}>
                    <Td className="font-medium">
                      {activity.flow}
                    </Td>
                    <Td>
                      <Badge 
                        tone={activity.status === "success" || activity.status === "completed" ? "green" : (activity.status === "failed" || activity.status === "error" ? "red" : "gray")}
                      >
                        {activity.status}
                      </Badge>
                    </Td>
                    <Td>
                      {(activity.status === "failed" || activity.status === "error") && (
                         <Button variant="ghost" size="sm" onClick={() => handleRetry(activity.id)}>
                            Retry
                         </Button>
                      )}
                    </Td>
                    <Td className="text-right text-[var(--st-text-secondary)] whitespace-nowrap">
                      {activity.time}
                    </Td>
                  </Tr>
                ))}
                {recentActivity.length === 0 && (
                  <Tr>
                     <Td colSpan={4} className="text-center text-[var(--st-text-secondary)] py-4">
                        No recent activity.
                     </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
            <div className="p-4 pt-2 border-t border-[var(--st-border)] mt-2 flex justify-center">
              <Button variant="ghost" size="sm" className="w-full text-[var(--st-text-secondary)]">
                View All Activity
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
