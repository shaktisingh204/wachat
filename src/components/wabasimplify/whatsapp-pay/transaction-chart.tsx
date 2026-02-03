"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DateRange } from "react-day-picker"
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns"

interface TransactionChartProps {
    transactions: any[]
    dateRange: DateRange | undefined
}

export function TransactionChart({ transactions, dateRange }: TransactionChartProps) {
    const chartData = React.useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return [];

        const filtered = transactions.filter(t => {
            const date = new Date(t.createdAt);
            return isWithinInterval(date, {
                start: startOfDay(dateRange.from!),
                end: endOfDay(dateRange.to!)
            });
        });

        // Group by date
        const grouped = filtered.reduce((acc, t) => {
            const dateStr = format(new Date(t.createdAt), 'yyyy-MM-dd');
            if (!acc[dateStr]) {
                acc[dateStr] = { date: dateStr, revenue: 0, count: 0 };
            }
            if (t.status === 'SUCCESS') {
                acc[dateStr].revenue += t.amount / 100;
                acc[dateStr].count += 1;
            }
            return acc;
        }, {} as Record<string, { date: string, revenue: number, count: number }>);

        return Object.values(grouped).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, dateRange]);

    return (
        <Card className="col-span-1">
            <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
                <CardDescription>
                    Tracking daily revenue from successful transactions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(str) => format(parseISO(str), 'MMM d')}
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickFormatter={(value) => `₹${value}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        borderColor: 'hsl(var(--border))',
                                        borderRadius: 'var(--radius)',
                                        color: 'hsl(var(--foreground))'
                                    }}
                                    itemStyle={{ color: 'hsl(var(--primary))' }}
                                    formatter={(value: any) => [`₹${value}`, 'Revenue']}
                                    labelFormatter={(label) => format(parseISO(label), 'PPP')}
                                />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="hsl(var(--primary))"
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            No data available for the selected period
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
