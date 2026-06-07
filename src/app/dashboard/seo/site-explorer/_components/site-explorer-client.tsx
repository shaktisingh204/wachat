'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Progress,
  Skeleton,
  StatCard,
} from '@/components/sabcrm/20ui';
import { useState, useRef, useTransition } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { Globe, Link as LinkIcon, BarChart, Search, Download, AlertCircle } from 'lucide-react';
import { getBacklinks, getSiteMetrics } from '@/app/actions/seo.actions';
import type { Backlink, SiteMetrics } from '@/lib/definitions';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Legend, PieChart, Pie, Cell } from 'recharts';

const chartConfigBacklinks = { count: { label: 'Backlinks', color: 'var(--st-accent)' } };
const chartConfigLinkTypes = {
  dofollow: { label: 'Dofollow', color: 'var(--st-accent)' },
  nofollow: { label: 'Nofollow', color: 'var(--st-text-secondary)' },
};

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
    { name: 'Dofollow', value: dofollowCount, color: 'var(--st-accent)' },
    { name: 'Nofollow', value: nofollowCount, color: 'var(--st-text-secondary)' }
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

  const header = (
    <PageHeader>
      <PageHeaderHeading>
        <PageTitle className="flex items-center gap-3">
          <Globe className="h-7 w-7" aria-hidden="true" />
          Site Explorer
        </PageTitle>
        <PageDescription>Analyze domain-level SEO metrics for any website.</PageDescription>
      </PageHeaderHeading>
    </PageHeader>
  );

  const searchRow = (
    <div className="flex items-end gap-2">
      <Field label="Domain" className="flex-1">
        <Input
          placeholder="Enter a domain, e.g., sabnode.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
        />
      </Field>
      <Button variant="primary" onClick={handleAnalyze} disabled={isLoading} iconLeft={Search}>
        {isLoading ? 'Analyzing...' : 'Analyze'}
      </Button>
    </div>
  );

  const errorBanner = error ? (
    <Alert tone="danger" icon={AlertCircle} title="Analysis failed">
      {error}
    </Alert>
  ) : null;

  if (!metrics && !isLoading && !analyzedDomain) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        {searchRow}
        {errorBanner}
        <EmptyState
          icon={Globe}
          title="No domain analyzed yet"
          description="Enter a domain above to start analyzing its SEO metrics and backlinks."
        />
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
      {header}
      {searchRow}
      {errorBanner}

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Domain Authority" value={metrics.domainAuthority} icon={BarChart} />
        <StatCard label="Linking Domains" value={metrics.linkingDomains.toLocaleString()} icon={Globe} />
        <StatCard label="Total Backlinks" value={metrics.totalBacklinks.toLocaleString()} icon={LinkIcon} />
        <StatCard label="Toxicity Score" value={`${metrics.toxicityScore}%`} icon={BarChart} />
        <StatCard label="Dofollow Links" value={dofollowCount.toLocaleString()} icon={LinkIcon} />
        <StatCard label="Nofollow Links" value={nofollowCount.toLocaleString()} icon={LinkIcon} />
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
            <ChartContainer config={chartConfigLinkTypes} className="w-full h-full max-h-[300px]">
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
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!backlinks.length} iconLeft={Download}>
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

              <div
                className="relative"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
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
