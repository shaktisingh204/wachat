'use client';

import * as React from 'react';
import * as Recharts from 'recharts';
import type { WidgetRendererProps } from './widget-renderer';

const CHART_COLORS = ['#5b8def', '#f0a26b', '#7ec77d', '#d97cc4', '#f0d36b', '#6bccd6'];

export function LineWidget({ widget, data }: WidgetRendererProps) {
    const cfg = (widget.config ?? {}) as { xKey?: string; yKey?: string };
    const xKey = cfg.xKey || 'date';
    const yKey = cfg.yKey || 'value';
    return (
        <div className="h-full w-full">
            <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.LineChart data={data.rows} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                    <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#e9eaec" />
                    <Recharts.XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                    <Recharts.YAxis tick={{ fontSize: 11 }} />
                    <Recharts.Tooltip />
                    <Recharts.Line type="monotone" dataKey={yKey} stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                </Recharts.LineChart>
            </Recharts.ResponsiveContainer>
        </div>
    );
}

export function BarWidget({ widget, data }: WidgetRendererProps) {
    const cfg = (widget.config ?? {}) as { xKey?: string; yKey?: string };
    const xKey = cfg.xKey || 'label';
    const yKey = cfg.yKey || 'value';
    return (
        <div className="h-full w-full">
            <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.BarChart data={data.rows} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                    <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#e9eaec" />
                    <Recharts.XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
                    <Recharts.YAxis tick={{ fontSize: 11 }} />
                    <Recharts.Tooltip />
                    <Recharts.Bar dataKey={yKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </Recharts.BarChart>
            </Recharts.ResponsiveContainer>
        </div>
    );
}

export function DonutWidget({ widget, data }: WidgetRendererProps) {
    const cfg = (widget.config ?? {}) as { nameKey?: string; valueKey?: string };
    const nameKey = cfg.nameKey || 'label';
    const valueKey = cfg.valueKey || 'value';
    return (
        <div className="h-full w-full">
            <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.PieChart>
                    <Recharts.Pie
                        data={data.rows}
                        dataKey={valueKey}
                        nameKey={nameKey}
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                    >
                        {data.rows.map((_, i) => (
                            <Recharts.Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                    </Recharts.Pie>
                    <Recharts.Tooltip />
                    <Recharts.Legend wrapperStyle={{ fontSize: 11 }} />
                </Recharts.PieChart>
            </Recharts.ResponsiveContainer>
        </div>
    );
}
