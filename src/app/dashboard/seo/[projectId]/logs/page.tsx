'use client';

import { use, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Activity } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const DATA = [
    { name: 'Googlebot', value: 400, color: '#4285F4' },
    { name: 'Bingbot', value: 150, color: '#F25022' },
    { name: 'Real Users', value: 2400, color: '#34A853' },
    { name: 'Others', value: 300, color: '#9AA0A6' },
];

export default function LogsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const [analyzing, setAnalyzing] = useState(false);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        Log Forensics
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Identify bot traffic and crawl budget waste.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Access Logs</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        <div className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors w-full h-full cursor-pointer">
                            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                            <h3 className="font-semibold mb-1">Drag .log files here</h3>
                            <p className="text-xs text-muted-foreground">Supports Apache/Nginx formats</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Bot Traffic Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={DATA}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 mt-4 text-xs font-medium">
                            {DATA.map(d => (
                                <div key={d.name} className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }}></div>
                                    {d.name}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-red-500" />
                        Identify Crawl Waste
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-4">
                            <div>
                                <h4 className="font-semibold text-red-600">404 Errors (Googlebot)</h4>
                                <p className="text-sm text-muted-foreground">Bots are wasting 15% of budget hitting dead links.</p>
                            </div>
                            <Button variant="outline" size="sm">Fix Issues</Button>
                        </div>
                        <div className="flex items-center justify-between border-b pb-4">
                            <div>
                                <h4 className="font-semibold text-orange-600">Slow Responses (&gt;2s)</h4>
                                <p className="text-sm text-muted-foreground">328 URLs took &gt;2s to respond to crawlers.</p>
                            </div>
                            <Button variant="outline" size="sm">View URLs</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
