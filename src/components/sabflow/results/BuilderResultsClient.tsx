"use client";

import * as React from "react";
import { ZoruDataTable } from "@/components/zoruui";
import { ZoruChartContainer, ZoruChartTooltip, ZORU_CHART_PALETTE, ZoruChart } from "@/components/zoruui/chart";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Badge } from "@/components/zoruui/badge";

const { BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip } = ZoruChart;

export function BuilderResultsChart({ data }: { data: { date: string; total: number; completed: number }[] }) {
  return (
    <ZoruChartContainer config={{}} className="h-72 w-full">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--zoru-line)" />
        <XAxis 
          dataKey="date" 
          stroke="var(--zoru-ink-muted)" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(val) => {
            const date = new Date(val);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
        />
        <YAxis 
          stroke="var(--zoru-ink-muted)" 
          fontSize={12} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(val) => `${val}`}
        />
        <Tooltip content={<ZoruChartTooltip />} />
        <Bar dataKey="total" name="Total Sessions" fill={ZORU_CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="completed" name="Completed" fill={ZORU_CHART_PALETTE[3]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ZoruChartContainer>
  );
}

export function BuilderResultsTable({ data }: { data: any[] }) {
  const columns: ColumnDef<any>[] = React.useMemo(() => [
    {
      accessorKey: "sessionId",
      header: "Session ID",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.sessionId || row.original._id}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Started",
      cell: ({ row }) => <span className="text-[var(--st-text)]">{format(new Date(row.original.createdAt), "MMM d, h:mm a")}</span>,
    },
    {
      accessorKey: "updatedAt",
      header: "Last Update",
      cell: ({ row }) => <span className="text-[var(--st-text)]">{format(new Date(row.original.updatedAt), "MMM d, h:mm a")}</span>,
    },
    {
      accessorKey: "messageCount",
      header: "Messages",
      cell: ({ row }) => <span>{row.original.messageCount || 0}</span>,
    },
    {
      accessorKey: "isCompleted",
      header: "Status",
      cell: ({ row }) => {
        const isComplete = row.original.isCompleted;
        return (
          <Badge variant={isComplete ? "success" : "secondary"}>
            {isComplete ? "Complete" : "In Progress"}
          </Badge>
        );
      },
    },
  ], []);

  return <ZoruDataTable columns={columns} data={data} pageSize={10} />;
}
