'use client';

import { Card } from '@/components/sabcrm/20ui/compat';
import { ZoruChartContainer, ZoruChartTooltip } from '@/components/sabcrm/20ui/compat';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

interface RecordItem {
    month: string;
    pfEmployer: number;
    pfEmployee: number;
    esiEmployer: number;
    esiEmployee: number;
}

export function HistoricalContributionGraph({ data }: { data: RecordItem[] }) {
    if (!data || data.length === 0) {
        return (
            <Card className="flex h-64 items-center justify-center p-6 text-sm text-[var(--st-text-secondary)]">
                No historical data available.
            </Card>
        );
    }

    // Sort data chronologically
    const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));

    return (
        <Card className="p-6">
            <h3 className="mb-4 text-[14px] font-medium text-[var(--st-text)]">Historical Contributions</h3>
            <div className="space-y-8">
                <div>
                    <h4 className="mb-2 text-[13px] text-[var(--st-text-secondary)]">PF Contributions</h4>
                    <ZoruChartContainer height={200}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sorted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="pfEmployerColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--st-text-secondary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--st-text-secondary)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="pfEmployeeColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--st-text)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--st-text)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 12, fill: 'var(--st-text-secondary)' }}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 12, fill: 'var(--st-text-secondary)' }}
                                    tickFormatter={(v) => `₹${v}`}
                                />
                                <Tooltip content={<ZoruChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Area
                                    type="monotone"
                                    dataKey="pfEmployer"
                                    name="Employer PF"
                                    stroke="var(--st-text-secondary)"
                                    fillOpacity={1}
                                    fill="url(#pfEmployerColor)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="pfEmployee"
                                    name="Employee PF"
                                    stroke="var(--st-text)"
                                    fillOpacity={1}
                                    fill="url(#pfEmployeeColor)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ZoruChartContainer>
                </div>

                <div>
                    <h4 className="mb-2 text-[13px] text-[var(--st-text-secondary)]">ESI Contributions</h4>
                    <ZoruChartContainer height={200}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sorted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="esiEmployerColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--st-text-secondary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--st-text-secondary)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="esiEmployeeColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--st-text)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--st-text)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 12, fill: 'var(--st-text-secondary)' }}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 12, fill: 'var(--st-text-secondary)' }}
                                    tickFormatter={(v) => `₹${v}`}
                                />
                                <Tooltip content={<ZoruChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Area
                                    type="monotone"
                                    dataKey="esiEmployer"
                                    name="Employer ESI"
                                    stroke="var(--st-text-secondary)"
                                    fillOpacity={1}
                                    fill="url(#esiEmployerColor)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="esiEmployee"
                                    name="Employee ESI"
                                    stroke="var(--st-text)"
                                    fillOpacity={1}
                                    fill="url(#esiEmployeeColor)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ZoruChartContainer>
                </div>
            </div>
        </Card>
    );
}
