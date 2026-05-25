'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { useEffect, useState } from 'react';

import { FileText, Activity } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { LogUploader } from './log-uploader';
import { getLogReport } from '../actions';

const DEFAULT_DATA = [
    { name: 'Googlebot', value: 400, color: '#4285F4' },
    { name: 'Bingbot', value: 150, color: '#F25022' },
    { name: 'Real Users', value: 2400, color: '#34A853' },
    { name: 'Others', value: 300, color: '#9AA0A6' },
];

export function LogsClient({ projectId, initialData }: { projectId: string, initialData: any }) {
    const [data, setData] = useState<any>(initialData);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        try {
            const report = await getLogReport(projectId);
            if (report) {
                setData(report);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // Polling if needed, but for simplicity let's just fetch once
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, [projectId]);

    const chartData = data?.distribution || DEFAULT_DATA;
    const bot404s = data?.waste?.bot404s ?? 125;
    const slowResponses = data?.waste?.slowResponses ?? 328;

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
                    <ZoruCardContent className="p-0">
                        <LogUploader projectId={projectId} />
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Bot Traffic Distribution</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="h-[300px]">
                        {loading ? (
                            <div className="flex h-full items-center justify-center text-zoru-ink-muted">Loading...</div>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {chartData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 flex justify-center gap-4 text-xs">
                                    {chartData.map((d: any) => (
                                        <div key={d.name} className="flex items-center gap-1 text-zoru-ink">
                                            <div className="h-3 w-3 rounded-full" style={{ background: d.color }}></div>
                                            {d.name}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
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
                                    {bot404s > 0 
                                        ? `Bots encountered ${bot404s} dead links.` 
                                        : 'No dead links hit by bots!'}
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
                                    {slowResponses > 0 
                                        ? `${slowResponses} URLs took >2s to respond to crawlers.` 
                                        : 'All responses to crawlers were fast!'}
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
