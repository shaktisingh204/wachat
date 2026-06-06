'use client';

import { ZoruChartContainer, ZoruChartTooltip, ZoruChart, ZORU_CHART_PALETTE } from '@/components/sabcrm/20ui/compat';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent } from '@/components/sabcrm/20ui/compat';

export function SabsmsHistoricalChart({ data }: { data: any[] }) {
  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = ZoruChart;
  
  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle>Message Volume (Last 30 Days)</ZoruCardTitle>
        <ZoruCardDescription>
          Daily count of sent, delivered, failed, and queued messages.
        </ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-[var(--st-text-secondary)]">
            No historical data available.
          </div>
        ) : (
          <ZoruChartContainer height={300}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
              <XAxis 
                dataKey="_id" 
                stroke="var(--st-text-secondary)" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="var(--st-text-secondary)" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(value: number) => `${value}`} 
              />
              <Tooltip content={<ZoruChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--st-text-secondary)', paddingTop: 10 }} />
              <Line name="Sent" type="monotone" dataKey="sent" stroke={ZORU_CHART_PALETTE[0]} strokeWidth={2} dot={false} />
              <Line name="Delivered" type="monotone" dataKey="delivered" stroke={ZORU_CHART_PALETTE[1]} strokeWidth={2} dot={false} />
              <Line name="Queued" type="monotone" dataKey="queued" stroke={ZORU_CHART_PALETTE[2]} strokeWidth={2} dot={false} />
              <Line name="Failed" type="monotone" dataKey="failed" stroke={ZORU_CHART_PALETTE[3]} strokeWidth={2} dot={false} />
            </LineChart>
          </ZoruChartContainer>
        )}
      </ZoruCardContent>
    </Card>
  );
}
