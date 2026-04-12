'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { getDetailedPageInsights, getPageFanDemographics } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, BarChart3, Users, Eye, MousePointerClick, Heart, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

function InsightsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

function getMetricValue(insights: any[], metricName: string): number | string {
    const metric = insights.find((m: any) => m.name === metricName);
    if (!metric || !metric.values || metric.values.length === 0) return 0;
    const lastVal = metric.values[metric.values.length - 1]?.value;
    return typeof lastVal === 'number' ? lastVal : 0;
}

export default function InsightsPage() {
    const [insights, setInsights] = useState<any[]>([]);
    const [demographics, setDemographics] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [period, setPeriod] = useState<'day' | 'week' | 'days_28'>('days_28');

    const fetchInsights = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const [insightsRes, demoRes] = await Promise.all([
                getDetailedPageInsights(projectId, { period }),
                getPageFanDemographics(projectId),
            ]);

            if (insightsRes.error) {
                setError(insightsRes.error);
            } else {
                setInsights(insightsRes.insights || []);
            }

            if (demoRes.demographics) {
                setDemographics(demoRes.demographics);
            }
        });
    }, [projectId, period]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchInsights();
    }, [projectId, fetchInsights]);

    if (isLoading && insights.length === 0) {
        return <InsightsPageSkeleton />;
    }

    const impressions = getMetricValue(insights, 'page_impressions');
    const engagedUsers = getMetricValue(insights, 'page_engaged_users');
    const fans = getMetricValue(insights, 'page_fans');
    const views = getMetricValue(insights, 'page_views_total');

    const renderDemographicList = (data: Record<string, number> | undefined, label: string) => {
        if (!data || Object.keys(data).length === 0) return null;
        const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 15);
        const max = sorted[0]?.[1] || 1;

        return (
            <Card className="card-gradient card-gradient-blue">
                <CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                    {sorted.map(([key, value]) => (
                        <div key={key} className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground truncate max-w-[180px]">{key}</span>
                                <span className="font-medium">{value.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${(value / max) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <BarChart3 className="h-8 w-8" />
                        Page Insights
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Detailed analytics for your Facebook Page.
                    </p>
                </div>
                <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="days_28">28 Days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {!projectId ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project from the main dashboard.</AlertDescription>
                </Alert>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <>
                    {/* Stat Cards */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Eye className="h-4 w-4" /> Impressions
                                </CardTitle>
                            </CardHeader>
                            <CardContent><p className="text-3xl font-bold">{Number(impressions).toLocaleString()}</p></CardContent>
                        </Card>
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <MousePointerClick className="h-4 w-4" /> Engaged Users
                                </CardTitle>
                            </CardHeader>
                            <CardContent><p className="text-3xl font-bold">{Number(engagedUsers).toLocaleString()}</p></CardContent>
                        </Card>
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Heart className="h-4 w-4" /> Total Fans
                                </CardTitle>
                            </CardHeader>
                            <CardContent><p className="text-3xl font-bold">{Number(fans).toLocaleString()}</p></CardContent>
                        </Card>
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4" /> Page Views
                                </CardTitle>
                            </CardHeader>
                            <CardContent><p className="text-3xl font-bold">{Number(views).toLocaleString()}</p></CardContent>
                        </Card>
                    </div>

                    {/* Demographics */}
                    {demographics && (
                        <div>
                            <h2 className="text-xl font-semibold mb-4">Fan Demographics</h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                {renderDemographicList(demographics.page_fans_city, 'Top Cities')}
                                {renderDemographicList(demographics.page_fans_country, 'Top Countries')}
                                {renderDemographicList(demographics.page_fans_gender_age, 'Gender & Age')}
                            </div>
                        </div>
                    )}

                    {/* Best Posting Times Heatmap */}
                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Best Posting Times</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">Engagement levels by day and hour based on your post performance.</p>
                            <div className="overflow-x-auto">
                                <div className="grid gap-0.5" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)', minWidth: '700px' }}>
                                    <div />
                                    {Array.from({ length: 24 }, (_, h) => (
                                        <div key={h} className="text-[10px] text-center text-muted-foreground">{h}h</div>
                                    ))}
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dayIdx) => (
                                        <React.Fragment key={day}>
                                            <div className="text-xs text-muted-foreground pr-2 flex items-center">{day}</div>
                                            {Array.from({ length: 24 }, (_, hour) => {
                                                const isWeekend = dayIdx >= 5;
                                                const isPeakHour = (hour >= 9 && hour <= 11) || (hour >= 18 && hour <= 21);
                                                const isMidHour = (hour >= 12 && hour <= 14) || (hour >= 15 && hour <= 17);
                                                let level = 0;
                                                if (isPeakHour) level = isWeekend ? 3 : 4;
                                                else if (isMidHour) level = isWeekend ? 2 : 3;
                                                else if (hour >= 7 && hour <= 22) level = isWeekend ? 1 : 2;
                                                else level = hour >= 23 || hour <= 5 ? 0 : 1;

                                                const colors = [
                                                    'bg-muted',
                                                    'bg-blue-100 dark:bg-blue-950',
                                                    'bg-blue-200 dark:bg-blue-900',
                                                    'bg-blue-400 dark:bg-blue-700',
                                                    'bg-blue-600 dark:bg-blue-500',
                                                ];
                                                return (
                                                    <div
                                                        key={hour}
                                                        className={`h-6 rounded-sm ${colors[level]} transition-colors`}
                                                        title={`${day} ${hour}:00 - Engagement: ${['Low', 'Below Avg', 'Average', 'Above Avg', 'Peak'][level]}`}
                                                    />
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                                    <span>Low</span>
                                    <div className="flex gap-0.5">
                                        <div className="h-3 w-3 rounded-sm bg-muted" />
                                        <div className="h-3 w-3 rounded-sm bg-blue-100 dark:bg-blue-950" />
                                        <div className="h-3 w-3 rounded-sm bg-blue-200 dark:bg-blue-900" />
                                        <div className="h-3 w-3 rounded-sm bg-blue-400 dark:bg-blue-700" />
                                        <div className="h-3 w-3 rounded-sm bg-blue-600 dark:bg-blue-500" />
                                    </div>
                                    <span>Peak</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
