'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/sabcrm/20ui/compat';
import { PosTransactionDoc } from '@/app/actions/crm-pos.actions';

export function PosSalesGraph({ transactions }: { transactions: PosTransactionDoc[] }) {
    // Group transactions by hour
    const hourlyData = React.useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            total: 0,
        }));
        
        for (const t of transactions) {
            if (t.status === 'completed' || t.status === 'partially_refunded') {
                const hour = new Date(t.createdAt).getHours();
                hours[hour].total += (t.total || 0);
            }
        }
        return hours;
    }, [transactions]);

    const maxTotal = Math.max(...hourlyData.map(d => d.total));

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Real-time Sales (Hourly)</CardTitle>
            </CardHeader>
            <CardBody>
                <div className="flex h-[200px] items-end gap-1 sm:gap-2">
                    {hourlyData.map((d, i) => {
                        const heightPct = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0;
                        return (
                            <div key={i} className="flex flex-1 flex-col items-center justify-end group relative h-full">
                                {d.total > 0 && (
                                    <div className="absolute -top-6 hidden group-hover:block whitespace-nowrap bg-[var(--st-bg-muted)] text-xs py-1 px-2 rounded border border-[var(--st-border)] z-10">
                                        ₹{d.total.toFixed(0)}
                                    </div>
                                )}
                                <div 
                                    className="w-full bg-[var(--st-text)] rounded-t-sm transition-all duration-300" 
                                    style={{ height: `${Math.max(heightPct, 1)}%`, opacity: d.total > 0 ? 1 : 0.2 }}
                                />
                                <span className="text-[10px] text-[var(--st-text-secondary)] mt-2 hidden sm:block">
                                    {i % 3 === 0 ? `${i}h` : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardBody>
        </Card>
    );
}
