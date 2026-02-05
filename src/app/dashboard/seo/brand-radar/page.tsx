
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Rss, MessageSquare, Flame, TrendingUp, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { getBrandMentions } from '@/app/actions/seo.actions';
import type { BrandMention } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';

const ChartContainer = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }) as any;
const ChartTooltip = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltip), { ssr: false }) as any;
const ChartTooltipContent = dynamic(() => import("@/components/ui/chart").then(mod => mod.ChartTooltipContent), { ssr: false }) as any;
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const chartConfigSentiment = { count: { label: "Count", color: "hsl(var(--chart-2))" } };

const getSentimentVariant = (sentiment: string) => {
    switch (sentiment) {
        case 'Positive': return 'default';
        case 'Negative': return 'destructive';
        default: return 'secondary';
    }
}

const getSourceIcon = (source: BrandMention['source']) => {
    switch (source) {
        case 'Reddit': return <Flame />;
        case 'Twitter': return <MessageSquare />;
        default: return <Rss />;
    }
}

export default function BrandRadarPage() {
    const [mentions, setMentions] = useState<BrandMention[]>([]);
    const [brand, setBrand] = useState('SabNode');
    const [isLoading, startTransition] = useTransition();

    const handleAnalyze = () => {
        if (!brand) return;
        startTransition(async () => {
            const data: any[] = await getBrandMentions(brand);
            // Map action response to UI interface if needed, or update UI to use new fields
            // The action returns { source, sentiment, text, date, url }
            // UI expects { author?, content?, source, sentiment, date, url }
            const mapped = data.map(d => ({
                source: d.source,
                sentiment: d.sentiment,
                content: d.text, // mapped from text
                author: d.source, // use source as author for now
                date: new Date(d.date),
                url: d.url
            }));
            setMentions(mapped);
        });
    };

    // Initial load? maybe optional.
    useEffect(() => {
        handleAnalyze();
    }, []);

    const sentimentData = mentions.reduce((acc, mention) => {
        const existing = acc.find(item => item.sentiment === mention.sentiment);
        if (existing) {
            existing.count++;
        } else {
            acc.push({ sentiment: mention.sentiment, count: 1 });
        }
        return acc;
    }, [] as { sentiment: string, count: number }[]);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Rss className="h-8 w-8" />
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
                <CardContent className="grid md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="brand-keywords">Brand Name / Keywords</Label>
                        <Input
                            id="brand-keywords"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                        />
                    </div>
                    <div className="space-y-2">
                        <Button onClick={handleAnalyze} disabled={isLoading} className="w-full md:w-auto">
                            {isLoading ? 'Scanning...' : 'Scan for Mentions'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {mentions.length > 0 && (
                <div className="grid md:grid-cols-2 gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Sentiment Analysis</CardTitle>
                            <CardDescription>Overall sentiment of recent mentions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? <Skeleton className="h-64 w-full" /> :
                                <ChartContainer config={chartConfigSentiment} className="h-64 w-full">
                                    <BarChart data={sentimentData} accessibilityLayer>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="sentiment" tickLine={false} axisLine={false} tickMargin={8} />
                                        <YAxis />
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                                    </BarChart>
                                </ChartContainer>
                            }
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Mentions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {isLoading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />) :
                                    mentions.map((mention, i) => (
                                        <div key={i} className="flex gap-4 p-3 border-b last:border-0">
                                            <div className="text-muted-foreground mt-1">
                                                {getSourceIcon(mention.source)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center">
                                                    <p className="font-semibold text-sm">{mention.author}</p>
                                                    <Badge variant={getSentimentVariant(mention.sentiment)}>{mention.sentiment}</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{mention.content}</p>
                                                <a href={mention.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                                                    {formatDistanceToNow(mention.date, { addSuffix: true })}
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {mentions.length === 0 && !isLoading && (
                <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
                    Enter a brand name to start scanning.
                </div>
            )}
        </div>
    );
}
