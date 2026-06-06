'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Label,
  Skeleton,
  ZoruChartContainer,
  ZoruChartTooltip,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition } from 'react';

import { Rss, MessageSquare, Flame } from 'lucide-react';
import dynamic from 'next/dynamic';
import { getBrandMentions } from '@/app/actions/seo.actions';
import type { BrandMention } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';

const ChartContainer = dynamic(() => import('@/components/zoruui').then((mod) => mod.ZoruChartContainer), {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
});
const ChartTooltip = dynamic(() => import('@/components/zoruui').then((mod) => mod.ZoruChartTooltip), { ssr: false });
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const chartConfigSentiment = { count: { label: 'Count', color: 'hsl(var(--chart-2))' } };

const getSentimentVariant = (sentiment: string): 'success' | 'danger' | 'secondary' => {
    switch (sentiment) {
        case 'Positive':
        case 'positive':
            return 'success';
        case 'Negative':
        case 'negative':
            return 'danger';
        default:
            return 'secondary';
    }
};

const getSourceIcon = (source: BrandMention['source']) => {
    switch (source) {
        case 'Reddit':
            return <Flame />;
        case 'Twitter':
            return <MessageSquare />;
        default:
            return <Rss />;
    }
};

export default function BrandRadarPage() {
    const [mentions, setMentions] = useState<BrandMention[]>([]);
    const [brand, setBrand] = useState('SabNode');
    const [isLoading, startTransition] = useTransition();

    const handleAnalyze = () => {
        if (!brand) return;
        startTransition(async () => {
            try {
                const data = await getBrandMentions(brand);
                setMentions(data || []);
            } catch (error) {
                console.error("Failed to analyze brand mentions:", error);
                setMentions([]);
            }
        });
    };

    useEffect(() => {
        handleAnalyze();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sentimentData = mentions.reduce(
        (acc, mention) => {
            const existing = acc.find((item) => item.sentiment === mention.sentiment);
            if (existing) {
                existing.count++;
            } else {
                acc.push({ sentiment: mention.sentiment, count: 1 });
            }
            return acc;
        },
        [] as { sentiment: string; count: number }[],
    );

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl text-[var(--st-text)] flex items-center gap-3">
                    <Rss className="h-8 w-8" />
                    Brand Radar
                </h1>
                <p className="text-[var(--st-text-secondary)] mt-2">
                    Track brand mentions, keywords, and sentiment across the web.
                </p>
            </div>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Configure Tracking</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2 items-end">
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
                </ZoruCardContent>
            </Card>

            {mentions.length > 0 && (
                <div className="grid gap-8 md:grid-cols-2">
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Sentiment Analysis</ZoruCardTitle>
                            <ZoruCardDescription>Overall sentiment of recent mentions.</ZoruCardDescription>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            {isLoading ? (
                                <Skeleton className="h-64 w-full" />
                            ) : (
                                <ChartContainer config={chartConfigSentiment} className="h-64 w-full">
                                    <BarChart data={sentimentData} accessibilityLayer>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="sentiment" tickLine={false} axisLine={false} tickMargin={8} />
                                        <YAxis />
                                        <ChartTooltip cursor={false} />
                                        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </ZoruCardContent>
                    </Card>
                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Recent Mentions</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="space-y-4">
                                {isLoading
                                    ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                                    : mentions.map((mention, i) => (
                                          <div key={i} className="flex gap-4 p-3 border-b border-[var(--st-border)] last:border-0">
                                              <div className="text-[var(--st-text-secondary)] mt-1">{getSourceIcon(mention.source)}</div>
                                              <div className="flex-1">
                                                  <div className="flex justify-between items-center">
                                                      <p className="text-sm text-[var(--st-text)]">{mention.author}</p>
                                                      <Badge variant={getSentimentVariant(mention.sentiment)}>
                                                          {mention.sentiment}
                                                      </Badge>
                                                  </div>
                                                  <p className="text-sm text-[var(--st-text-secondary)]">{mention.content}</p>
                                                  <a
                                                      href={mention.url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-xs text-[var(--st-text)] hover:underline"
                                                  >
                                                      {formatDistanceToNow(mention.date, { addSuffix: true })}
                                                  </a>
                                              </div>
                                          </div>
                                      ))}
                            </div>
                        </ZoruCardContent>
                    </Card>
                </div>
            )}

            {mentions.length === 0 && !isLoading && (
                <div className="rounded-[var(--zoru-radius)] border-2 border-dashed border-[var(--st-border)] p-12 text-center text-[var(--st-text-secondary)]">
                    Enter a brand name to start scanning.
                </div>
            )}
        </div>
    );
}
