'use client';

import { PieChart as PieIcon } from 'lucide-react';
import {
  CHART_PALETTE,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Recharts,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  EmptyState,
  type ChartConfig,
} from '@/components/sabcrm/20ui';
import type { EmailDeviceBreakdown } from '@/lib/rust-client/email-reports';

interface DeviceBreakdownProps {
  data: EmailDeviceBreakdown[];
  title?: string;
}

const { Pie, Cell } = Recharts;
const RechartsPieChart = Recharts.PieChart;

const chartConfig: ChartConfig = {
  count: { label: 'Opens' },
};

export function DeviceBreakdown({ data, title = 'Device breakdown' }: DeviceBreakdownProps) {
  const rows = data ?? [];
  const total = rows.reduce((s, d) => s + (d.count ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieIcon className="h-4 w-4" aria-hidden="true" /> {title}
        </CardTitle>
        <CardDescription>Share of opens by client device</CardDescription>
      </CardHeader>
      <CardBody>
        {total > 0 ? (
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <RechartsPieChart>
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="device"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="var(--st-bg)"
                >
                  {rows.map((row, i) => (
                    <Cell key={row.device} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent nameKey="device" />} />
              </RechartsPieChart>
            </ChartContainer>
            <ul className="space-y-1.5 text-sm">
              {rows.map((d, i) => (
                <li key={d.device} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                  />
                  <span className="capitalize text-[var(--st-text-secondary)]">{d.device}</span>
                  <span className="ml-auto font-medium text-[var(--st-text)]">
                    {Math.round((d.count / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            icon={PieIcon}
            title="No device data"
            description="Open events with user-agent metadata will populate this chart."
            size="sm"
          />
        )}
      </CardBody>
    </Card>
  );
}
