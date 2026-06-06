'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, Skeleton } from '@/components/sabcrm/20ui';
import { Monitor } from 'lucide-react';

interface AnalyticsDevices {
  deviceTypes: { type: string; count: number }[];
  browsers: { browser: string; count: number }[];
  os: { os: string; count: number }[];
}

interface DeviceBreakdownChartProps {
  data: AnalyticsDevices | null;
  isLoading?: boolean;
}

const PALETTE = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

interface PieTooltipPayloadItem {
  name: string;
  value: number;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: PieTooltipPayloadItem[];
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12px] shadow-lg">
      <p className="text-[var(--st-text)]">{payload[0].name}: <span className="font-medium">{payload[0].value}</span></p>
    </div>
  );
}

interface BarTooltipPayloadItem {
  value: number;
}

interface BarTooltipProps {
  active?: boolean;
  payload?: BarTooltipPayloadItem[];
  label?: string;
}

function BarTooltip({ active, payload, label }: BarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12px] shadow-lg">
      <p className="text-[var(--st-text-secondary)] mb-0.5">{label}</p>
      <p className="text-[var(--st-text)] font-medium">{payload[0].value} clicks</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)] mb-3">{children}</p>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-6 text-center text-[12px] text-[var(--st-text-secondary)]">{message}</div>
  );
}

export function DeviceBreakdownChart({ data, isLoading }: DeviceBreakdownChartProps) {
  if (isLoading) {
    return (
      <Card className="p-5 space-y-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-[180px] w-full rounded-lg" />
        <Skeleton className="h-[140px] w-full rounded-lg" />
        <Skeleton className="h-[140px] w-full rounded-lg" />
      </Card>
    );
  }

  const deviceTypes = data?.deviceTypes ?? [];
  const browsers = (data?.browsers ?? []).slice(0, 5);
  const os = (data?.os ?? []).slice(0, 5);

  return (
    <Card className="p-5 space-y-6">
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-[var(--st-text-secondary)]" />
        <span className="text-[13px] text-[var(--st-text)]">Device Breakdown</span>
      </div>

      {/* Device Type — Donut */}
      <div>
        <SectionLabel>Device Type</SectionLabel>
        {deviceTypes.length === 0 ? (
          <EmptyState message="No device data" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={deviceTypes}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
              >
                {deviceTypes.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-[11px] text-[var(--st-text)] capitalize">{value}</span>
                )}
                iconSize={8}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Browsers — Horizontal Bar */}
      <div>
        <SectionLabel>Top Browsers</SectionLabel>
        {browsers.length === 0 ? (
          <EmptyState message="No browser data" />
        ) : (
          <ResponsiveContainer width="100%" height={browsers.length * 28 + 20}>
            <BarChart
              data={browsers}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--zoru-line, #27272a)" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--zoru-ink-muted, #71717a)' }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="browser"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--zoru-ink-muted, #71717a)' }}
                width={72}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={10}>
                {browsers.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* OS — Horizontal Bar */}
      <div>
        <SectionLabel>Top OS</SectionLabel>
        {os.length === 0 ? (
          <EmptyState message="No OS data" />
        ) : (
          <ResponsiveContainer width="100%" height={os.length * 28 + 20}>
            <BarChart
              data={os}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--zoru-line, #27272a)" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--zoru-ink-muted, #71717a)' }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="os"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'var(--zoru-ink-muted, #71717a)' }}
                width={72}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={10}>
                {os.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
