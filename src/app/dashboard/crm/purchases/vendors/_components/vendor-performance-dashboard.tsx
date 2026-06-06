import * as React from 'react';
import { Card, CardHeader, CardTitle, CardBody, ChartContainer, ChartTooltip, Recharts, CHART_PALETTE } from '@/components/sabcrm/20ui';

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
        <CardHeader>
          <CardTitle>Orders Volume (YTD)</CardTitle>
        </CardHeader>
        <CardBody>
          <ChartContainer height={200}>
            <Recharts.BarChart data={monthlyData}>
              <Recharts.XAxis 
                dataKey="name" 
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }} 
              />
              <Recharts.YAxis 
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }}
              />
              <Recharts.Tooltip content={<ChartTooltip />} />
              <Recharts.Bar dataKey="orders" fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
            </Recharts.BarChart>
          </ChartContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchase Value (YTD)</CardTitle>
        </CardHeader>
        <CardBody>
          <ChartContainer height={200}>
            <Recharts.LineChart data={monthlyData}>
              <Recharts.XAxis 
                dataKey="name" 
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }} 
              />
              <Recharts.YAxis 
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--st-text-secondary)", fontSize: 12 }}
              />
              <Recharts.Tooltip content={<ChartTooltip />} />
              <Recharts.Line type="monotone" dataKey="value" stroke={CHART_PALETTE[0]} strokeWidth={2} dot={false} />
            </Recharts.LineChart>
          </ChartContainer>
        </CardBody>
      </Card>
    </div>
  );
}
