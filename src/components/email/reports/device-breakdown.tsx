'use client';

import { PieChart as PieIcon } from 'lucide-react';
import {
  ZORU_CHART_PALETTE,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  EmptyState,
} from '@/components/sabcrm/20ui/compat';
import type { EmailDeviceBreakdown } from '@/lib/rust-client/email-reports';

interface DeviceBreakdownProps {
  data: EmailDeviceBreakdown[];
  title?: string;
}

const { Pie, Tooltip, Cell } = ZoruChart as unknown as typeof import('recharts');
const RechartsPieChart = (ZoruChart as unknown as typeof import('recharts')).PieChart;

export function DeviceBreakdown({ data, title = 'Device breakdown' }: DeviceBreakdownProps) {
  const rows = data ?? [];
  const total = rows.reduce((s, d) => s + (d.count ?? 0), 0);

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle className="flex items-center gap-2">
          <PieIcon className="h-4 w-4" /> {title}
        </ZoruCardTitle>
        <ZoruCardDescription>
          Share of opens by client device
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        {total > 0 ? (
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
            <ZoruChartContainer height={220}>
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
                  {rows.map((_, i) => (
                    <Cell
                      key={i}
                      fill={ZORU_CHART_PALETTE[i % ZORU_CHART_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ZoruChartTooltip />} />
              </RechartsPieChart>
            </ZoruChartContainer>
            <ul className="space-y-1.5 text-sm">
              {rows.map((d, i) => (
                <li key={d.device} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ZORU_CHART_PALETTE[i % ZORU_CHART_PALETTE.length] }}
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
            icon={<PieIcon />}
            title="No device data"
            description="Open events with user-agent metadata will populate this chart."
          />
        )}
      </ZoruCardContent>
    </Card>
  );
}
