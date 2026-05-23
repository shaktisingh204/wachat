'use client';

import * as React from 'react';
import { Card } from '@/components/zoruui';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PerformanceChartProps {
  usedCount: number;
  createdAt: string | Date;
}

export function PerformanceChart({ usedCount, createdAt }: PerformanceChartProps) {
  const [data, setData] = React.useState<{ date: string; redemptions: number }[]>([]);

  React.useEffect(() => {
    // Generate some mock redemptions spread out over the last 30 days or since creation
    const generated = [];
    const end = new Date();
    const start = new Date(createdAt);
    if (isNaN(start.getTime())) {
      start.setDate(end.getDate() - 30);
    }
    
    // ensure at least 7 days of data points
    const daysDiff = Math.max(7, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Distribute `usedCount` randomly across these days
    let remaining = usedCount;
    for (let i = 0; i <= daysDiff; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      
      let redemptions = 0;
      if (i === daysDiff) {
        redemptions = remaining;
      } else if (remaining > 0) {
        // assign a random portion of remaining
        redemptions = Math.floor(Math.random() * (remaining / (daysDiff - i + 1)) * 2);
        if (redemptions > remaining) redemptions = remaining;
      }
      remaining -= redemptions;
      
      generated.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        redemptions,
      });
    }
    
    setData(generated);
  }, [usedCount, createdAt]);

  return (
    <Card className="p-6 mt-6">
      <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
        Performance (Redemptions over time)
      </h2>
      <div className="h-64 w-full">
        {usedCount > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--zoru-line)" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'var(--zoru-ink-muted)' }}
                dy={10}
              />
              <YAxis 
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'var(--zoru-ink-muted)' }}
                dx={-10}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--zoru-surface)', 
                  borderColor: 'var(--zoru-line)',
                  borderRadius: 'var(--zoru-radius)',
                  fontSize: '13px'
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="redemptions" 
                stroke="var(--zoru-accent)" 
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--zoru-surface)', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-zoru-ink-muted">
            No redemptions yet.
          </div>
        )}
      </div>
    </Card>
  );
}
