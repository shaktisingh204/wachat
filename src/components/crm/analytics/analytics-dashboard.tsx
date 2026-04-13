'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { ClayCard } from '@/components/clay';

type AnalyticsData = {
    financials: { name: string; revenue: number; expense: number }[];
    funnel: { name: string; value: number }[];
    kpis: {
        totalRevenue: number;
        totalExpense: number;
        netProfit: number;
        totalLeads: number;
    };
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
    if (!data) return <div className="p-4">No data available</div>;

    const { financials, funnel, kpis } = data;

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <ClayCard>
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium text-clay-ink-muted">Total Revenue</h3>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-clay-ink">₹{kpis.totalRevenue.toLocaleString()}</div>
                    </div>
                </ClayCard>
                <ClayCard>
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium text-clay-ink-muted">Total Expenses</h3>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-clay-ink">₹{kpis.totalExpense.toLocaleString()}</div>
                    </div>
                </ClayCard>
                <ClayCard>
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium text-clay-ink-muted">Net Profit</h3>
                    </div>
                    <div>
                        <div className={`text-2xl font-bold ${kpis.netProfit >= 0 ? 'text-clay-green' : 'text-clay-red'}`}>
                            ₹{kpis.netProfit.toLocaleString()}
                        </div>
                    </div>
                </ClayCard>
                <ClayCard>
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="text-sm font-medium text-clay-ink-muted">Total Leads</h3>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-clay-ink">{kpis.totalLeads}</div>
                    </div>
                </ClayCard>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                <ClayCard className="col-span-1" padded={false}>
                    <div className="p-5 border-b border-clay-border">
                        <h3 className="text-clay-ink font-semibold">Financial Performance</h3>
                    </div>
                    <div className="p-5 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={financials}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                                <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                                <Legend />
                                <Bar dataKey="revenue" fill="#adfa1d" radius={[4, 4, 0, 0]} name="Revenue" />
                                <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} name="Expenses" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ClayCard>

                <ClayCard className="col-span-1" padded={false}>
                    <div className="p-5 border-b border-clay-border">
                        <h3 className="text-clay-ink font-semibold">Lead Funnel</h3>
                    </div>
                    <div className="p-5 h-[300px] flex justify-center">
                        {funnel.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={funnel}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {funnel.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-clay-ink-muted">
                                No lead data available
                            </div>
                        )}
                    </div>
                </ClayCard>
            </div>
        </div>
    );
}
