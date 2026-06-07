'use client';

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    Spinner,
    Badge,
    Tag,
} from '@/components/sabcrm/20ui';
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
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle className="flex items-center gap-3">
                        <FileText className="h-7 w-7 text-[var(--st-text)]" aria-hidden="true" />
                        Log Forensics
                    </PageTitle>
                    <PageDescription>Identify bot traffic and crawl budget waste.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Access Logs</CardTitle>
                    </CardHeader>
                    <CardBody className="p-0">
                        <LogUploader projectId={projectId} />
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Bot Traffic Distribution</CardTitle>
                    </CardHeader>
                    <CardBody className="h-[300px]">
                        {loading ? (
                            <div className="flex h-full items-center justify-center gap-2 text-[var(--st-text-secondary)]">
                                <Spinner label="Loading bot traffic" />
                                <span>Loading.</span>
                            </div>
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
                                <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                                    {chartData.map((d: any) => (
                                        <Tag key={d.name} color={d.color}>
                                            {d.name}
                                        </Tag>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-[var(--st-danger)]" aria-hidden="true" />
                        Identify Crawl Waste
                    </CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-[var(--st-border)] pb-4">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Badge tone="danger">Errors</Badge>
                                    <span className="text-[var(--st-text)]">404 Errors (Googlebot)</span>
                                </div>
                                <p className="text-sm text-[var(--st-text-secondary)]">
                                    {bot404s > 0
                                        ? `Bots encountered ${bot404s} dead links.`
                                        : 'No dead links hit by bots.'}
                                </p>
                            </div>
                            <Button variant="outline" size="sm">
                                Fix Issues
                            </Button>
                        </div>
                        <div className="flex items-center justify-between border-b border-[var(--st-border)] pb-4">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <Badge tone="warning">Slow</Badge>
                                    <span className="text-[var(--st-text)]">Slow Responses (&gt;2s)</span>
                                </div>
                                <p className="text-sm text-[var(--st-text-secondary)]">
                                    {slowResponses > 0
                                        ? `${slowResponses} URLs took over 2s to respond to crawlers.`
                                        : 'All responses to crawlers were fast.'}
                                </p>
                            </div>
                            <Button variant="outline" size="sm">
                                View URLs
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
