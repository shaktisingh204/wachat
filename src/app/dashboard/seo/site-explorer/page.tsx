'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Input,
  Progress,
  Skeleton,
  ZoruChartContainer,
  ZoruChartTooltip,
} from '@/components/zoruui';
import {
  useState,
  useTransition } from 'react';

import { Globe, Link as LinkIcon, BarChart, Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { getBacklinks, getSiteMetrics } from '@/app/actions/seo.actions';
import type { Backlink, SiteMetrics } from '@/lib/definitions';

const ChartContainer = dynamic(() => import('@/components/zoruui').then((mod) => mod.ZoruChartContainer), {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
}) as any;
const ChartTooltip = dynamic(() => import('@/components/zoruui').then((mod) => mod.ZoruChartTooltip), { ssr: false }) as any;
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const chartConfigBacklinks = { count: { label: 'Backlinks', color: 'hsl(var(--chart-1))' } };

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <Card>
        <ZoruCardHeader className="flex flex-row items-center justify-between pb-2">
            <ZoruCardTitle className="text-sm">{title}</ZoruCardTitle>
            <Icon className="h-4 w-4 text-zoru-ink-muted" />
        </ZoruCardHeader>
        <ZoruCardContent>
            <div className="text-2xl text-zoru-ink">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
        </ZoruCardContent>
    </Card>
);

export default function SiteExplorerPage() {
    const [metrics, setMetrics] = useState<SiteMetrics | null>(null);
    const [backlinks, setBacklinks] = useState<Backlink[]>([]);
    const [isLoading, startTransition] = useTransition();

    const [domain, setDomain] = useState('');
    const [analyzedDomain, setAnalyzedDomain] = useState('');

    const handleAnalyze = () => {
        if (!domain) return;
        setAnalyzedDomain(domain);
        startTransition(async () => {
            const [metricsData, backlinksData] = await Promise.all([getSiteMetrics(domain), getBacklinks(domain)]);
            setMetrics(metricsData);
            setBacklinks(backlinksData);
        });
    };

    const anchorTextData = backlinks
        .reduce(
            (acc, link) => {
                const existing = acc.find((item) => item.text === link.anchorText);
                if (existing) {
                    existing.count++;
                } else {
                    acc.push({ text: link.anchorText, count: 1 });
                }
                return acc;
            },
            [] as { text: string; count: number }[],
        )
        .map((item) => ({ ...item, percentage: (item.count / backlinks.length) * 100 }));

    if (!metrics && !isLoading && !analyzedDomain) {
        return (
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <Globe className="h-8 w-8" />
                        Site Explorer
                    </h1>
                    <p className="text-zoru-ink-muted mt-2">Analyze domain-level SEO metrics for any website.</p>
                </div>

                <div className="flex gap-2">
                    <Input
                        placeholder="Enter a domain, e.g., sabnode.com"
                        className="flex-1"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    />
                    <Button onClick={handleAnalyze} disabled={isLoading}>
                        <Search className="mr-2 h-4 w-4" />
                        Analyze
                    </Button>
                </div>

                <div className="rounded-[var(--zoru-radius)] border-2 border-dashed border-zoru-line p-12 text-center text-zoru-ink-muted">
                    Enter a domain above to start analyzing.
                </div>
            </div>
        );
    }

    if (isLoading && !metrics) {
        return <Skeleton className="h-full w-full" />;
    }

    if (!metrics) return null;

    const backlinkHistory = metrics.trafficData.map((d, i) => ({
        month: d.date.substring(0, 3),
        count: 50 + i * 80 + Math.random() * 50,
    }));

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                    <Globe className="h-8 w-8" />
                    Site Explorer
                </h1>
                <p className="text-zoru-ink-muted mt-2">Analyze domain-level SEO metrics for any website.</p>
            </div>

            <div className="flex gap-2">
                <Input
                    placeholder="Enter a domain, e.g., sabnode.com"
                    className="flex-1"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                />
                <Button onClick={handleAnalyze} disabled={isLoading}>
                    <Search className="mr-2 h-4 w-4" />
                    {isLoading ? 'Analyzing...' : 'Analyze'}
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Domain Authority" value={metrics.domainAuthority} icon={BarChart} />
                <StatCard title="Linking Domains" value={metrics.linkingDomains} icon={Globe} />
                <StatCard title="Total Backlinks" value={metrics.totalBacklinks} icon={LinkIcon} />
                <StatCard title="Toxicity Score" value={`${metrics.toxicityScore}%`} icon={BarChart} />
            </div>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Backlink Growth</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <ChartContainer config={chartConfigBacklinks} className="h-64 w-full">
                        <AreaChart data={backlinkHistory}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis />
                            <ChartTooltip cursor={false} />
                            <defs>
                                <linearGradient id="fillBacklinks" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="count" stroke="var(--color-count)" fill="url(#fillBacklinks)" />
                        </AreaChart>
                    </ChartContainer>
                </ZoruCardContent>
            </Card>

            <div className="grid gap-8 md:grid-cols-2">
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Anchor Text Distribution</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="space-y-4">
                            {anchorTextData.map((item, index) => (
                                <div key={`${item.text}-${index}`} className="space-y-1">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-sm text-zoru-ink truncate">{item.text}</p>
                                        <p className="text-xs text-zoru-ink-muted">{item.percentage.toFixed(0)}%</p>
                                    </div>
                                    <Progress value={item.percentage} />
                                </div>
                            ))}
                        </div>
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Top Linking Domains</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="rounded-[var(--zoru-radius)] border border-zoru-line">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-zoru-line">
                                        <th className="p-3 text-left text-zoru-ink">Domain</th>
                                        <th className="p-3 text-right text-zoru-ink">Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {backlinks.map((item, index) => (
                                        <tr key={`${item.sourceUrl}-${index}`} className="border-b border-zoru-line last:border-0">
                                            <td className="p-3 max-w-xs truncate text-zoru-ink">
                                                {(() => {
                                                    try {
                                                        return new URL(item.sourceUrl).hostname;
                                                    } catch {
                                                        return item.sourceUrl;
                                                    }
                                                })()}
                                            </td>
                                            <td className="p-3 text-right">
                                                <Badge variant="outline">{item.linkType}</Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}
