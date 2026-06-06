'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card, Select, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from '@/components/sabcrm/20ui/compat';
import { getConversionsAnalytics } from './analytics-actions';
import { FunnelChart } from './funnel-chart';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';

export function AnalyticsDashboard() {
    const [dateRange, setDateRange] = useState('7d');
    const [data, setData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        let mounted = true;
        setIsFetching(true);
        getConversionsAnalytics(dateRange).then((res) => {
            if (mounted) {
                setData(res);
                setIsFetching(false);
            }
        });
        return () => { mounted = false; };
    }, [dateRange]);

    return (
        <div className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-zoru-ink">Conversion Analytics</h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-zoru-ink-muted">Date Range:</span>
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <ZoruSelectTrigger className="w-[140px] h-8 text-xs bg-zoru-surface">
                            <ZoruSelectValue placeholder="Select Range" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="7d">Last 7 Days</ZoruSelectItem>
                            <ZoruSelectItem value="30d">Last 30 Days</ZoruSelectItem>
                            <ZoruSelectItem value="90d">Last 90 Days</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>
            </div>

            {!data ? (
                <Card variant="default" className="flex items-center justify-center p-12 min-h-[300px]">
                    <Loader2 className="w-8 h-8 animate-spin text-zoru-brand" />
                    <span className="ml-3 text-sm text-zoru-ink-muted">Aggregating complex data...</span>
                </Card>
            ) : (
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-opacity duration-300 relative ${isFetching ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    {isFetching && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <Loader2 className="w-8 h-8 animate-spin text-zoru-brand" />
                        </div>
                    )}
                    {/* Funnel Chart */}
                    <Card variant="default" className="p-5 flex flex-col">
                        <h3 className="text-md font-medium text-zoru-ink mb-4">Sales Funnel</h3>
                        <div className="flex-1 flex items-center justify-center min-h-[300px]">
                            <FunnelChart data={data.funnel} />
                        </div>
                    </Card>

                    {/* Source / Channel Pie Chart */}
                    <Card variant="default" className="p-5 flex flex-col">
                        <h3 className="text-md font-medium text-zoru-ink mb-4">Conversion by Source</h3>
                        <div className="flex-1 min-h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.channels}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                    >
                                        {data.channels.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--zoru-line)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* A/B Testing Insights */}
                    <Card variant="default" className="p-5 lg:col-span-2">
                        <h3 className="text-md font-medium text-zoru-ink mb-4">A/B Testing Insights</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-zoru-ink-muted">
                                <thead className="border-b border-zoru-line text-xs uppercase bg-zoru-surface-2 text-zoru-ink">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-md">Variant</th>
                                        <th className="px-4 py-3">Conversion Rate</th>
                                        <th className="px-4 py-3 rounded-tr-md">Lift</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.abTesting.map((row: any, i: number) => (
                                        <tr key={i} className="border-b border-zoru-line hover:bg-zoru-surface-2 transition">
                                            <td className="px-4 py-3 font-medium text-zoru-ink">{row.variant}</td>
                                            <td className="px-4 py-3">{row.conversionRate}%</td>
                                            <td className="px-4 py-3">
                                                {row.lift > 0 ? (
                                                    <span className="text-zoru-ink font-medium">+{row.lift}%</span>
                                                ) : (
                                                    <span className="text-zoru-ink-muted">Baseline</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
