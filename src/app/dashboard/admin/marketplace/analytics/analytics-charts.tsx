'use client';

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface TrendData {
  date: string;
  installs: number;
}

interface TopTemplate {
  id: string;
  name: string;
  installs: number;
  views: number;
}

export function TopTemplatesChart({ data }: { data: TopTemplate[] }) {
    const safeData = data.map(d => {
        const installs = Number(d.installs) || 0;
        const views = Number(d.views) || 0;
        const rate = views > 0 ? ((installs / views) * 100).toFixed(1) : (installs > 0 ? '100.0' : '0.0');
        return {
            ...d,
            installs,
            views,
            rate: Number(rate)
        };
    });

    if (safeData.length === 0) {
        return (
            <div className="py-16 text-center text-sm text-zoru-ink">
                No install events recorded yet.
            </div>
        );
    }

    return (
        <div className="h-80 w-full mt-4 p-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={safeData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#a1a1aa" 
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        angle={-35}
                        textAnchor="end"
                        height={60}
                    />
                    <YAxis 
                        stroke="#a1a1aa" 
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fcd34d' }}
                        cursor={{ fill: '#27272a', opacity: 0.4 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="installs" fill="#fcd34d" radius={[4, 4, 0, 0]} name="Installs" />
                    <Bar dataKey="views" fill="#52525b" radius={[4, 4, 0, 0]} name="Views" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function InstallTrendsChart({ data }: { data: TrendData[] }) {
    if (data.length === 0) {
        return (
            <div className="py-16 text-center text-sm text-zoru-ink">
                No trend data available.
            </div>
        );
    }

    return (
        <div className="h-80 w-full mt-4 p-4">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                        dataKey="date" 
                        stroke="#a1a1aa" 
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        angle={-35}
                        textAnchor="end"
                        height={60}
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }}
                    />
                    <YAxis 
                        stroke="#a1a1aa" 
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fff' }}
                        itemStyle={{ color: '#fcd34d' }}
                        cursor={{ stroke: '#27272a', strokeWidth: 1, strokeDasharray: '5 5' }}
                        labelFormatter={(value) => {
                            const date = new Date(value as string);
                            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
                        }}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="installs" 
                        stroke="#fcd34d" 
                        strokeWidth={2} 
                        dot={{ r: 3, fill: '#18181b', stroke: '#fcd34d', strokeWidth: 2 }} 
                        activeDot={{ r: 5, fill: '#fcd34d' }} 
                        name="Installs" 
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
