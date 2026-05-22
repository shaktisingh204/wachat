'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { use } from 'react';

import { FileText, Upload, Activity } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const DATA = [
    { name: 'Googlebot', value: 400, color: '#4285F4' },
    { name: 'Bingbot', value: 150, color: '#F25022' },
    { name: 'Real Users', value: 2400, color: '#34A853' },
    { name: 'Others', value: 300, color: '#9AA0A6' },
];

export default function LogsPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <FileText className="h-8 w-8 text-zoru-ink" />
                        Log Forensics
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Identify bot traffic and crawl budget waste.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Upload Access Logs</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex h-[300px] items-center justify-center">
                        <div className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-[var(--zoru-radius)] border-2 border-dashed border-zoru-line p-12 text-center transition-colors hover:bg-zoru-surface-2/50">
                            <Upload className="mb-4 h-10 w-10 text-zoru-ink-muted" />
                            <h3 className="text-zoru-ink mb-1">Drag .log files here</h3>
                            <p className="text-xs text-zoru-ink-muted">Supports Apache/Nginx formats</p>
                        </div>
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Bot Traffic Distribution</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="h-[300px]">
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
                        <div className="mt-4 flex justify-center gap-4 text-xs">
                            {DATA.map((d) => (
                                <div key={d.name} className="flex items-center gap-1 text-zoru-ink">
                                    <div className="h-3 w-3 rounded-full" style={{ background: d.color }}></div>
                                    {d.name}
                                </div>
                            ))}
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-zoru-danger-ink" />
                        Identify Crawl Waste
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-zoru-line pb-4">
                            <div>
                                <h4 className="text-zoru-danger-ink">404 Errors (Googlebot)</h4>
                                <p className="text-sm text-zoru-ink-muted">
                                    Bots are wasting 15% of budget hitting dead links.
                                </p>
                            </div>
                            <Button variant="outline" size="sm">
                                Fix Issues
                            </Button>
                        </div>
                        <div className="flex items-center justify-between border-b border-zoru-line pb-4">
                            <div>
                                <h4 className="text-zoru-warning">Slow Responses (&gt;2s)</h4>
                                <p className="text-sm text-zoru-ink-muted">
                                    328 URLs took &gt;2s to respond to crawlers.
                                </p>
                            </div>
                            <Button variant="outline" size="sm">
                                View URLs
                            </Button>
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
