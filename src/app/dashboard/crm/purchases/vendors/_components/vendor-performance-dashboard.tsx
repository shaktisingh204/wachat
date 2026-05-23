import * as React from 'react';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, ZoruChartContainer, ZoruChartTooltip, ZoruChart, ZORU_CHART_PALETTE } from '@/components/zoruui';

export function VendorPerformanceDashboard({ vendors }: { vendors: any[] }) {
  // Aggregate mock performance metrics based on vendors
  const monthlyData = [
    { name: 'Jan', orders: 12, value: 50000 },
    { name: 'Feb', orders: 15, value: 65000 },
    { name: 'Mar', orders: 10, value: 48000 },
    { name: 'Apr', orders: 20, value: 92000 },
    { name: 'May', orders: 18, value: 81000 },
    { name: 'Jun', orders: 24, value: 105000 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Orders Volume (YTD)</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <ZoruChartContainer height={200}>
            <ZoruChart.BarChart data={monthlyData}>
              <ZoruChart.XAxis 
                dataKey="name" 
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }} 
              />
              <ZoruChart.YAxis 
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }}
              />
              <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
              <ZoruChart.Bar dataKey="orders" fill={ZORU_CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
            </ZoruChart.BarChart>
          </ZoruChartContainer>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Purchase Value (YTD)</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <ZoruChartContainer height={200}>
            <ZoruChart.LineChart data={monthlyData}>
              <ZoruChart.XAxis 
                dataKey="name" 
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }} 
              />
              <ZoruChart.YAxis 
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--zoru-ink-muted))", fontSize: 12 }}
              />
              <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
              <ZoruChart.Line type="monotone" dataKey="value" stroke={ZORU_CHART_PALETTE[0]} strokeWidth={2} dot={false} />
            </ZoruChart.LineChart>
          </ZoruChartContainer>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
