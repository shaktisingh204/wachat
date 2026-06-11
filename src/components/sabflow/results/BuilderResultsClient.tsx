"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from '@/components/sabcrm/20ui';
import { ChartContainer, ChartTooltip, CHART_PALETTE, Recharts } from '@/components/sabcrm/20ui';
import { format } from "date-fns";
import { Badge } from '@/components/sabcrm/20ui';

const { BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip } = Recharts;

export function BuilderResultsChart({ data }: { data: { date: string; total: number; completed: number }[] }) {
  return (
    <ChartContainer config={{}} className="h-72 w-full">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
        <XAxis 
          dataKey="date" 
          stroke="var(--st-text-secondary)" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(val) => {
            const date = new Date(val);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
        />
        <YAxis 
          stroke="var(--st-text-secondary)" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(val) => `${val}`}
        />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="total" name="Total Sessions" fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="completed" name="Completed" fill={CHART_PALETTE[3]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

type SessionRow = {
  _id?: string;
  sessionId?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  messageCount?: number;
  isCompleted?: boolean;
};

export function BuilderResultsTable({ data }: { data: SessionRow[] }) {
  const columns: DataTableColumn<SessionRow>[] = React.useMemo(() => [
    {
      key: "sessionId",
      header: "Session ID",
      render: (row) => <span className="font-mono text-xs">{row.sessionId || row._id}</span>,
    },
    {
      key: "createdAt",
      header: "Started",
      render: (row) => <span className="text-[var(--st-text)]">{format(new Date(row.createdAt), "MMM d, h:mm a")}</span>,
    },
    {
      key: "updatedAt",
      header: "Last Update",
      render: (row) => <span className="text-[var(--st-text)]">{format(new Date(row.updatedAt), "MMM d, h:mm a")}</span>,
    },
    {
      key: "messageCount",
      header: "Messages",
      render: (row) => <span>{row.messageCount || 0}</span>,
    },
    {
      key: "isCompleted",
      header: "Status",
      render: (row) => (
        <Badge tone={row.isCompleted ? "success" : "neutral"}>
          {row.isCompleted ? "Complete" : "In Progress"}
        </Badge>
      ),
    },
  ], []);

  return (
    <DataTable
      columns={columns}
      rows={data}
      getRowId={(row, i) => row.sessionId ?? row._id ?? String(i)}
    />
  );
}
