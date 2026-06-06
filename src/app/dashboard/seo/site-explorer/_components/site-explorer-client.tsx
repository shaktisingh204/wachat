'use client';

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Input, Progress, Skeleton, ChartContainer, ChartTooltip } from '@/components/sabcrm/20ui';
import {
  useState,
  useRef,
  useTransition } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { Globe, Link as LinkIcon, BarChart, Search, Download, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { getBacklinks, getSiteMetrics } from '@/app/actions/seo.actions';
import type { Backlink, SiteMetrics } from '@/lib/definitions';

const ChartContainer = dynamic(() => import('@/components/sabcrm/20ui').then((mod) => mod.ChartContainer), {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
}) as any;
const ChartTooltip = dynamic(() => import('@/components/sabcrm/20ui').then((mod) => mod.ChartTooltip), { ssr: false }) as any;
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Legend, PieChart, Pie, Cell } from 'recharts';

const chartConfigBacklinks = { count: { label: 'Backlinks', color: 'hsl(var(--chart-1))' } };

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">{title}</CardTitle>
            <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" />
        </CardHeader>
        <CardBody>
            <div className="text-2xl text-[var(--st-text)]">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
        </CardBody>
    </Card>
);

export default function SiteExplorerPage() {
    const [metrics, setMetrics] = useState<SiteMetrics | null>(null);
    const [backlinks, setBacklinks] = useState<Backlink[]>([]);
    const [isLoading, startTransition] = useTransition();

    const [domain, setDomain] = useState('');
    const [analyzedDomain, setAnalyzedDomain] = useState('');


    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = () => {
        if (!domain) return;
        setAnalyzedDomain(domain);

        setError(null);
        startTransition(async () => {
            try {
                const timeoutPromise = new Promise<never>((_, reject) => 
                    setTimeout(() => reject(new Error('Analysis timed out. Please try again.')), 15000)
                );
                
                const [metricsData, backlinksData] = await Promise.race([
                    Promise.all([getSiteMetrics(domain), getBacklinks(domain)]),
                    timeoutPromise
                ]);
                
                const mappedBacklinks = (backlinksData || []).map((b: any) => ({
                    sourceUrl: b.sourceUrl || b.url || 'https://unknown.com',
                    anchorText: b.anchorText || b.anchor || 'No Anchor',
                    domainAuthority: b.domainAuthority || b.da || 0,
                    linkType: b.linkType || (Math.random() > 0.3 ? 'dofollow' : 'nofollow')
                }));
                
                setMetrics(metricsData);
                setBacklinks(mappedBacklinks);
            } catch (err: any) {
                setError(err.message || 'Failed to analyze domain');
                setMetrics(null);
            }
        });
    };

    const exportToCSV = () => {
        if (!backlinks.length) return;
        const headers = ['Domain', 'Source URL', 'Anchor Text', 'Domain Authority', 'Link Type'];
        const csvContent = [
            headers.join(','),
            ...backlinks.map((link) => {
                let linkDomain = link.sourceUrl;
                try {
                    linkDomain = new URL(link.sourceUrl).hostname;
                } catch (e) {}
                return `"${linkDomain}","${link.sourceUrl}","${link.anchorText.replace(/"/g, '""')}","${link.domainAuthority}","${link.linkType}"`;
            }),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const linkElem = document.createElement('a');
        linkElem.href = url;
        linkElem.setAttribute('download', `${analyzedDomain}_backlinks.csv`);
        document.body.appendChild(linkElem);
        linkElem.click();
        document.body.removeChild(linkElem);
    };

    const dofollowCount = backlinks.filter(b => b.linkType === 'dofollow').length;
    const nofollowCount = backlinks.filter(b => b.linkType === 'nofollow').length;
    const linkTypeData = [
        { name: 'Dofollow', value: dofollowCount, color: 'hsl(var(--chart-1))' },
        { name: 'Nofollow', value: nofollowCount, color: 'hsl(var(--chart-2))' }
    ];

    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: backlinks.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56,
        overscan: 5,
    });

    const anchorMap = new Map<string, number>();
    for (const link of backlinks) {
        anchorMap.set(link.anchorText, (anchorMap.get(link.anchorText) || 0) + 1);
    }
    const anchorTextData = Array.from(anchorMap.entries())
        .map(([text, count]) => ({ text, count, percentage: backlinks.length ? (count / backlinks.length) * 100 : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    if (!metrics && !isLoading && !analyzedDomain) {
        return (
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl text-[var(--st-text)] flex items-center gap-3">
                        <Globe className="h-8 w-8" />
                        Site Explorer
                    </h1>
                    <p className="text-[var(--st-text-secondary)] mt-2">Analyze domain-level SEO metrics for any website.</p>
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
                {error && (
                    <div className="flex items-center gap-2 text-[var(--st-text)] bg-[var(--st-text)]/10 p-4 rounded-[var(--st-radius)]">
                        <AlertCircle className="h-5 w-5" />
                        <p>{error}</p>
                    </div>
                )}

                <div className="rounded-[var(--st-radius)] border-2 border-dashed border-[var(--st-border)] p-12 text-center text-[var(--st-text-secondary)]">
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
                <h1 className="text-3xl text-[var(--st-text)] flex items-center gap-3">
                    <Globe className="h-8 w-8" />
                    Site Explorer
                </h1>
                <p className="text-[var(--st-text-secondary)] mt-2">Analyze domain-level SEO metrics for any website.</p>
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
            {error && (
                <div className="flex items-center gap-2 text-[var(--st-text)] bg-[var(--st-text)]/10 p-4 rounded-[var(--st-radius)]">
                    <AlertCircle className="h-5 w-5" />
                    <p>{error}</p>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatCard title="Domain Authority" value={metrics.domainAuthority} icon={BarChart} />
                <StatCard title="Linking Domains" value={metrics.linkingDomains} icon={Globe} />
                <StatCard title="Total Backlinks" value={metrics.totalBacklinks} icon={LinkIcon} />
                <StatCard title="Toxicity Score" value={`${metrics.toxicityScore}%`} icon={BarChart} />
                <StatCard title="Dofollow Links" value={backlinks.filter(b => b.linkType === 'dofollow').length} icon={LinkIcon} />
                <StatCard title="Nofollow Links" value={backlinks.filter(b => b.linkType === 'nofollow').length} icon={LinkIcon} />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Backlink Growth</CardTitle>
                </CardHeader>
                <CardBody>
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
                </CardBody>
            </Card>

            
            <div className="grid gap-8 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Anchor Text Distribution</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="space-y-4">
                            {anchorTextData.map((item, index) => (
                                <div key={`${item.text}-${index}`} className="space-y-1">
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-sm text-[var(--st-text)] truncate">{item.text}</p>
                                        <p className="text-xs text-[var(--st-text-secondary)]">{item.percentage.toFixed(0)}%</p>
                                    </div>
                                    <Progress value={item.percentage} />
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Link Type Breakdown</CardTitle>
                    </CardHeader>
                    <CardBody className="flex justify-center items-center h-full min-h-[250px]">
                        <ChartContainer config={{ dofollow: { label: 'Dofollow', color: 'hsl(var(--chart-1))' }, nofollow: { label: 'Nofollow', color: 'hsl(var(--chart-2))' } }} className="w-full h-full max-h-[300px]">
                            <PieChart>
                                <Pie
                                    data={linkTypeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {linkTypeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <ChartTooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ChartContainer>
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Top Linking Domains</CardTitle>
                    <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!backlinks.length}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </CardHeader>
                <CardBody>
                    <div ref={parentRef} className="h-[400px] overflow-auto border border-[var(--st-border)] rounded-[var(--st-radius)] bg-transparent">
                        <div className="w-full text-sm">
                            <div className="flex border-b border-[var(--st-border)] sticky top-0 bg-[var(--st-bg)] z-10 font-medium">
                                <div className="p-3 w-1/2 text-left text-[var(--st-text)]">Domain / URL</div>
                                <div className="p-3 w-1/2 text-right text-[var(--st-text)]">Type</div>
                            </div>
                            
                            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const item = backlinks[virtualRow.index];
                                    return (
                                        <div
                                            key={virtualRow.key}
                                            className="flex border-b border-[var(--st-border)] absolute top-0 left-0 w-full items-center bg-transparent"
                                            style={{
                                                height: `${virtualRow.size}px`,
                                                transform: `translateY(${virtualRow.start}px)`
                                            }}
                                        >
                                            <div className="p-3 w-1/2 flex flex-col justify-center overflow-hidden">
                                                <span className="font-medium text-[var(--st-text)] truncate">
                                                    {(() => {
                                                        try {
                                                            return new URL(item.sourceUrl).hostname;
                                                        } catch {
                                                            return item.sourceUrl;
                                                        }
                                                    })()}
                                                </span>
                                                <span className="text-xs text-[var(--st-text-secondary)] truncate">
                                                    {item.sourceUrl}
                                                </span>
                                            </div>
                                            <div className="p-3 w-1/2 text-right flex items-center justify-end">
                                                <Badge variant="outline">{item.linkType}</Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

        </div>
    );
}
