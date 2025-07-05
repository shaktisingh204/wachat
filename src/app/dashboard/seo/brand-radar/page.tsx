'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, BarChart, Rss, MessageSquare, Flame, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false });
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false });
import { Bar, CartesianGrid, XAxis, YAxis } from 'recharts';


const mentionData = [
  { source: 'Google Alerts', mentions: 45 },
  { source: 'Reddit', mentions: 120 },
  { source: 'Twitter', mentions: 210 },
  { source: 'News', mentions: 30 },
];

const sentimentData = [
    { sentiment: 'Positive', count: 185 },
    { sentiment: 'Neutral', count: 150 },
    { sentiment: 'Negative', count: 70 },
];

const chartConfigMentions = { mentions: { label: "Mentions", color: "hsl(var(--chart-1))" } };
const chartConfigSentiment = { count: { label: "Count", color: "hsl(var(--chart-2))" } };

const recentMentions = [
    { source: 'Reddit', user: 'u/coolinvestor', text: 'Just tried SabNode for a campaign, the flow builder is a game-changer!', link: '#', sentiment: 'Positive' },
    { source: 'Twitter', user: '@devgal', text: 'Anyone have thoughts on SabNode vs other WhatsApp tools? The pricing seems competitive.', link: '#', sentiment: 'Neutral' },
    { source: 'Google Alerts', user: 'TechCrunch', text: 'Newcomer SabNode aims to simplify WhatsApp Business marketing with an all-in-one suite.', link: '#', sentiment: 'Positive' },
    { source: 'Reddit', user: 'u/startups', text: 'Having a bit of trouble with the API integration on SabNode, any tips?', link: '#', sentiment: 'Negative' },
];

const getSentimentVariant = (sentiment: string) => {
    switch(sentiment) {
        case 'Positive': return 'default';
        case 'Negative': return 'destructive';
        default: return 'secondary';
    }
}

export default function BrandRadarPage() {
    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Rss className="h-8 w-8"/>
                    Brand Radar
                </h1>
                <p className="text-muted-foreground mt-2">
                   Track brand mentions, keywords, and sentiment across the web.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Configure Tracking</CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="brand-keywords">Brand Keywords (comma-separated)</Label>
                        <Input id="brand-keywords" defaultValue="SabNode, sabnode.com"/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="competitor-keywords">Competitor Keywords (comma-separated)</Label>
                        <Input id="competitor-keywords" defaultValue="twilio, messagebird"/>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Mentions by Source</CardTitle>
                        <CardDescription>Last 30 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ChartContainer config={chartConfigMentions} className="h-64 w-full">
                            <BarChart data={mentionData} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="source" type="category" tickLine={false} axisLine={false} tickMargin={10} width={80} />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="mentions" fill="var(--color-mentions)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Sentiment Analysis</CardTitle>
                        <CardDescription>Overall sentiment of recent mentions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfigSentiment} className="h-64 w-full">
                            <BarChart data={sentimentData} accessibilityLayer>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="sentiment" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Recent Mentions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentMentions.map((mention, i) => (
                            <div key={i} className="flex gap-4 p-3 border-b last:border-0">
                                <div className="text-muted-foreground">
                                    {mention.source === 'Reddit' ? <Flame /> : mention.source === 'Twitter' ? <MessageSquare/> : <Rss/>}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold text-sm">{mention.user}</p>
                                        <Badge variant={getSentimentVariant(mention.sentiment)}>{mention.sentiment}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{mention.text}</p>
                                    <a href={mention.link} className="text-xs text-primary hover:underline">View Source</a>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}

