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
import { StatCard } from "@/components/zoruui/stat-card";
import { 
  PageHeader, 
  ZoruPageHeading, 
  ZoruPageTitle, 
  ZoruPageDescription, 
  ZoruPageActions 
} from "@/components/zoruui/page-header";
import { 
  Card, 
  ZoruCardHeader, 
  ZoruCardTitle, 
  ZoruCardDescription, 
  ZoruCardContent 
} from "@/components/zoruui/card";
import { 
  ZoruChart, 
  ZoruChartContainer, 
  ZoruChartTooltip 
} from "@/components/zoruui/chart";
import { Button } from "@/components/zoruui/button";
import { Badge } from "@/components/zoruui/badge";
import { 
  Table, 
  ZoruTableHeader, 
  ZoruTableRow, 
  ZoruTableHead, 
  ZoruTableBody, 
  ZoruTableCell 
} from "@/components/zoruui/table";
import { Input } from "@/components/zoruui/input";
import { ZoruDateRangePicker } from "@/components/zoruui/date-picker";
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
        <ZoruPageHeading>
          <ZoruPageTitle>Overview</ZoruPageTitle>
          <ZoruPageDescription>
            Monitor your Sabflow executions, active workflows, and system health.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <div className="flex gap-2 mr-4 min-w-[280px]">
             <ZoruDateRangePicker 
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
        </ZoruPageActions>
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
          <ZoruCardHeader>
            <ZoruCardTitle>Execution Volume</ZoruCardTitle>
            <ZoruCardDescription>
              Success vs failed executions over time.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ZoruChartContainer height={300}>
              <ZoruChart.AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--zoru-success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--zoru-success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--zoru-danger))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--zoru-danger))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--zoru-line))" />
                <ZoruChart.XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }} 
                  dy={10} 
                />
                <ZoruChart.YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }} 
                />
                <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                <ZoruChart.Area 
                  type="monotone" 
                  dataKey="success" 
                  stroke="hsl(var(--zoru-success))" 
                  fillOpacity={1} 
                  fill="url(#colorSuccess)" 
                  strokeWidth={2}
                />
                <ZoruChart.Area 
                  type="monotone" 
                  dataKey="failed" 
                  stroke="hsl(var(--zoru-danger))" 
                  fillOpacity={1} 
                  fill="url(#colorFailed)" 
                  strokeWidth={2}
                />
              </ZoruChart.AreaChart>
            </ZoruChartContainer>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Recent Activity</ZoruCardTitle>
            <ZoruCardDescription>Latest flow executions.</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0 sm:p-0">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Flow</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead>Action</ZoruTableHead>
                  <ZoruTableHead className="text-right">Time</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {recentActivity.map((activity: any) => (
                  <ZoruTableRow key={activity.id}>
                    <ZoruTableCell className="font-medium">
                      {activity.flow}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <Badge 
                        tone={activity.status === "success" || activity.status === "completed" ? "green" : (activity.status === "failed" || activity.status === "error" ? "red" : "gray")}
                      >
                        {activity.status}
                      </Badge>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {(activity.status === "failed" || activity.status === "error") && (
                         <Button variant="ghost" size="sm" onClick={() => handleRetry(activity.id)}>
                            Retry
                         </Button>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right text-zoru-ink-muted whitespace-nowrap">
                      {activity.time}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
                {recentActivity.length === 0 && (
                  <ZoruTableRow>
                     <ZoruTableCell colSpan={4} className="text-center text-zoru-ink-muted py-4">
                        No recent activity.
                     </ZoruTableCell>
                  </ZoruTableRow>
                )}
              </ZoruTableBody>
            </Table>
            <div className="p-4 pt-2 border-t border-zoru-line mt-2 flex justify-center">
              <Button variant="ghost" size="sm" className="w-full text-zoru-ink-muted">
                View All Activity
              </Button>
            </div>
          </ZoruCardContent>
        </Card>
      </div>
    </div>
  );
}
