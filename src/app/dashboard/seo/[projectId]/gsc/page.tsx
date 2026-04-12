'use client';

import { use, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, LineChart, Loader2, CheckCircle } from 'lucide-react';
import { startGscAuth, getGscIntegration, getGscData } from '@/app/actions/seo-gsc.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export default function GscPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const [integration, setIntegration] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);

    const load = async () => {
        setLoading(true);
        const integ = await getGscIntegration(projectId);
        setIntegration(integ);

        if (integ && integ.credentials) {
            const res = await getGscData(projectId);
            if (res && res.success) {
                setData(res.rows || []);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, [projectId]);

    const handleConnect = async () => {
        setConnecting(true);
        try {
            await startGscAuth(projectId);
        } catch (e) {
            console.error(e);
            setConnecting(false);
        }
    };

    if (loading) return <Skeleton className="h-[400px] w-full" />;

    if (!integration) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-muted/20">
                <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <LineChart className="h-8 w-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold mb-2">Connect Google Search Console</h2>
                <p className="text-muted-foreground max-w-md text-center mb-6">
                    Import real performance data (clicks, impressions, position) directly from Google.
                </p>
                <Button onClick={handleConnect} disabled={connecting} size="lg" className="bg-blue-600 hover:bg-blue-700">
                    {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Connect Google Account
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c7/Google_G_logo.svg" className="h-8 w-8" alt="Google" />
                        Search Console
                    </h1>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Connected to {integration.selectedSite || integration.sites?.[0] || 'Unknown Site'}
                    </p>
                </div>
                <Button variant="outline" onClick={handleConnect}>Reconnect</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard title="Total Clicks" value={sum(data, 'clicks')} />
                <MetricCard title="Total Impressions" value={sum(data, 'impressions')} />
                <MetricCard title="Avg. CTR" value={(avg(data, 'ctr') * 100).toFixed(2) + '%'} />
                <MetricCard title="Avg. Position" value={avg(data, 'position').toFixed(1)} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Performance (Last 28 Days)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <XAxis
                                dataKey="keys[0]"
                                tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                fontSize={10}
                            />
                            <YAxis yAxisId="left" orientation="left" stroke="#2563eb" />
                            <YAxis yAxisId="right" orientation="right" stroke="#16a34a" />
                            <Tooltip
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            />
                            <Bar yAxisId="left" dataKey="clicks" fill="#2563eb" name="Clicks" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="right" dataKey="impressions" fill="#16a34a" name="Impressions" radius={[4, 4, 0, 0]} opacity={0.3} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}

function MetricCard({ title, value }: { title: string, value: string | number }) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
}

function sum(data: any[], key: string) {
    return data.reduce((acc, curr) => acc + (curr[key] || 0), 0).toLocaleString();
}

function avg(data: any[], key: string) {
    if (data.length === 0) return 0;
    return data.reduce((acc, curr) => acc + (curr[key] || 0), 0) / data.length;
}
