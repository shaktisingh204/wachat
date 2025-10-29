
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getSabChatAnalytics } from '@/app/actions/sabchat.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoaderCircle, MessageSquare, Inbox, CheckCircle, Clock, Smile } from "lucide-react";
import dynamic from 'next/dynamic';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';

const chartConfig = { count: { label: "Chats", color: "hsl(var(--primary))" } };

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-3xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

function AnalyticsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-64 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function SabChatAnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [isLoading, startLoading] = useTransition();
    
    useEffect(() => {
        startLoading(async () => {
            const analyticsData = await getSabChatAnalytics();
            setData(analyticsData);
        });
    }, []);

    if (isLoading || !data) {
        return <AnalyticsSkeleton />;
    }

    return (
        <div className="space-y-6">
             <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard title="Total Chats" value={data.totalChats.toLocaleString()} icon={MessageSquare} />
                <StatCard title="Open Chats" value={data.openChats.toLocaleString()} icon={Inbox} />
                <StatCard title="Closed Chats" value={data.closedChats.toLocaleString()} icon={CheckCircle} />
                <StatCard title="Avg. First Response" value={`${data.avgResponseTime}s`} icon={Clock} />
                <StatCard title="Customer Satisfaction" value={`${data.satisfaction}%`} icon={Smile} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daily Chat Volume</CardTitle>
                    <CardDescription>Number of new chat sessions started in the last 7 days.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-64 w-full">
                        <BarChart data={data.dailyChatVolume} accessibilityLayer>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    );
}
