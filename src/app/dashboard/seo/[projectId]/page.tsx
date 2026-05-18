'use client';

import { ZoruButton, ZoruCard, ZoruSkeleton, useZoruToast, ZoruChartContainer, ZoruChartTooltip } from '@/components/zoruui';
import { useEffect, useState, use } from 'react';

import { Star, Link as LinkIcon, BarChart, Globe, Target, Map } from 'lucide-react';
import dynamic from 'next/dynamic';
import { getSeoProject, getSiteMetrics } from '@/app/actions/seo.actions';
import { Bar, CartesianGrid, XAxis, YAxis, ComposedChart } from 'recharts';
import Link from 'next/link';

const ChartContainer = dynamic(() => import("@/components/zoruui").then(mod => mod.ZoruChartContainer), { ssr: false, loading: () => <ZoruSkeleton className="h-64 w-full" /> }) as any;
const ChartTooltip = dynamic(() => import("@/components/zoruui").then(mod => mod.ZoruChartTooltip), { ssr: false }) as any;

const chartConfig = {
    organic: { label: "Organic", color: "hsl(var(--chart-1))" },
    social: { label: "Social", color: "hsl(var(--chart-2))" },
    direct: { label: "Direct", color: "hsl(var(--chart-3))" },
};

function StatCard({ title, value, icon: Icon, desc }: { title: string, value: string | number, icon: React.ElementType, desc?: string }) {
    return (
        <ZoruCard className="p-4">
            <div className="flex items-start justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
                    <Icon className="h-4 w-4" />
                </span>
            </div>
            <div className="mt-3.5 text-[11.5px] leading-none text-zoru-ink-muted">{title}</div>
            <div className="mt-1.5 text-[22px] tracking-[-0.01em] leading-none text-zoru-ink">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            {desc && <p className="mt-1 text-[11px] leading-tight text-zoru-ink-muted">{desc}</p>}
        </ZoruCard>
    );
}

type TabKey = 'overview' | 'keywords' | 'competitors';

export default function ProjectDashboard({ params }: { params: Promise<{ projectId: string }> }) {
    const unwrappedParams = use(params);
    const projectId = unwrappedParams.projectId;
    const { toast } = useZoruToast();

    const [project, setProject] = useState<any>(null);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<TabKey>('overview');

    useEffect(() => {
        const loadData = async () => {
            try {
                const proj = await getSeoProject(projectId);
                if (!proj) {
                    toast({ title: "Error", description: "Project not found", variant: "destructive" });
                    return;
                }
                setProject(proj);
                const m = await getSiteMetrics(proj.domain);
                setMetrics(m);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [projectId, toast]);

    if (loading || !project || !metrics) return <ZoruSkeleton className="h-full w-full" />;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[28px] leading-none text-zoru-ink flex items-center gap-3">
                        <Globe className="h-7 w-7 text-zoru-ink" />
                        {project.domain}
                    </h1>
                    <p className="text-zoru-ink-muted mt-2 text-[12.5px]">
                        Tracking {project.settings?.locations?.[0] || 'US'} · {project.crawledAt ? 'Last Crawl: ' + new Date(project.crawledAt).toLocaleDateString() : 'No crawls yet'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/dashboard/seo/${projectId}/audit`}>
                        <ZoruButton variant="outline">Run Audit</ZoruButton>
                    </Link>
                    <Link href={`/dashboard/seo/${projectId}/grid`}>
                        <ZoruButton>
                            <Map className="h-4 w-4" />
                            Grid Tracker
                        </ZoruButton>
                    </Link>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Domain Authority"
                    value={metrics.domainAuthority || 'N/A'}
                    icon={BarChart}
                    desc="Normalized score (0-100)"
                />
                <StatCard
                    title="Backlinks"
                    value={metrics.totalBacklinks || 0}
                    icon={LinkIcon}
                    desc={`${metrics.linkingDomains || 0} Referring Domains`}
                />
                <StatCard
                    title="Health Score"
                    value={project.healthScore || 'N/A'}
                    icon={Target}
                    desc="Based on last technical audit"
                />
                <StatCard
                    title="Keywords Tracked"
                    value={project.settings?.targetedKeywords?.length || 0}
                    icon={Star}
                    desc="In top 100 positions"
                />
            </div>

            <div className="flex items-center gap-2 border-b border-zoru-line">
                {(['overview', 'keywords', 'competitors'] as TabKey[]).map(key => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={`-mb-px border-b-2 px-3 py-2 text-[13px] capitalize transition-colors ${
                            tab === key
                                ? 'border-zoru-ink text-zoru-ink'
                                : 'border-transparent text-zoru-ink-muted hover:text-zoru-ink'
                        }`}
                    >
                        {key}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <ZoruCard className="p-6">
                    <div className="mb-4">
                        <div className="text-sm text-zoru-ink">Estimated Traffic Trend</div>
                        <div className="mt-1 text-[11.5px] text-zoru-ink-muted">
                            Organic vs Social traffic over the last 6 months (Simulated)
                        </div>
                    </div>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <ComposedChart data={metrics.trafficData}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis />
                            <ChartTooltip />
                            <Bar dataKey="direct" stackId="a" fill="var(--color-direct)" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="social" stackId="a" fill="var(--color-social)" />
                            <Bar dataKey="organic" stackId="a" fill="var(--color-organic)" radius={[4, 4, 0, 0]} />
                        </ComposedChart>
                    </ChartContainer>
                </ZoruCard>
            )}

            {tab === 'keywords' && (
                <ZoruCard className="p-6">
                    <div className="mb-4 text-sm text-zoru-ink">Top Performing Keywords</div>
                    <p className="text-zoru-ink-muted text-[12.5px]">Keyword table coming soon...</p>
                </ZoruCard>
            )}

            {tab === 'competitors' && (
                <ZoruCard className="p-6">
                    <div className="mb-4 text-sm text-zoru-ink">Competitor Analysis</div>
                    <div className="flex flex-col gap-2">
                        {project.competitors?.map((comp: string) => (
                            <div key={comp} className="flex justify-between items-center p-3 border border-zoru-line rounded-[var(--zoru-radius)]">
                                <span className="text-zoru-ink">{comp}</span>
                                <ZoruButton size="sm" variant="ghost">View Report</ZoruButton>
                            </div>
                        ))}
                        {(!project.competitors || project.competitors.length === 0) && (
                            <p className="text-zoru-ink-muted text-[12.5px]">No competitors added.</p>
                        )}
                    </div>
                </ZoruCard>
            )}
        </div>
    );
}
