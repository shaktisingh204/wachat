'use client';

import { Button, Card, Skeleton, useZoruToast, ZoruChartContainer, ZoruChartTooltip, Input, Label, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/sabcrm/20ui/compat';
import { useEffect, useState, use } from 'react';

import { Star, Link as LinkIcon, BarChart, Globe, Target, Map, Trash2, Save, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { getSeoProject, getSiteMetrics, getKeywords, deleteSeoProject, updateSeoProject, addKeyword, deleteKeyword } from '@/app/actions/seo.actions';
import { Bar, CartesianGrid, XAxis, YAxis, ComposedChart } from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const ChartContainer = dynamic(() => import("@/components/zoruui").then(mod => mod.ZoruChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }) as any;
const ChartTooltip = dynamic(() => import("@/components/zoruui").then(mod => mod.ZoruChartTooltip), { ssr: false }) as any;

const chartConfig = {
    organic: { label: "Organic", color: "hsl(var(--chart-1))" },
    social: { label: "Social", color: "hsl(var(--chart-2))" },
    direct: { label: "Direct", color: "hsl(var(--chart-3))" },
};

function StatCard({ title, value, icon: Icon, desc }: { title: string, value: string | number, icon: React.ElementType, desc?: string }) {
    return (
        <Card className="p-4">
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
        </Card>
    );
}

function KeywordsTab({ projectId, project }: { projectId: string, project: any }) {
    const [keywords, setKeywords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKw, setNewKw] = useState('');
    const [adding, setAdding] = useState(false);
    const { toast } = useZoruToast();

    const fetchKeywords = async () => {
        setLoading(true);
        try {
            const data = await getKeywords(projectId);
            setKeywords(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeywords();
    }, [projectId]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKw.trim()) return;
        setAdding(true);
        const res = await addKeyword(projectId, newKw.trim());
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Keyword added' });
            setNewKw('');
            fetchKeywords();
        }
        setAdding(false);
    };

    const handleDeleteKw = async (kwId: string) => {
        const res = await deleteKeyword(kwId, projectId);
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Keyword removed' });
            fetchKeywords();
        }
    };

    if (loading) return <Skeleton className="h-40 w-full" />;

    return (
        <Card className="p-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="text-sm text-zoru-ink font-medium">Top Performing Keywords</div>
                    <p className="text-zoru-ink-muted text-[12.5px] mt-1">Track your keyword rankings over time.</p>
                </div>
                <form onSubmit={handleAdd} className="flex gap-2">
                    <Input 
                        placeholder="Add new keyword..." 
                        value={newKw} 
                        onChange={(e) => setNewKw(e.target.value)} 
                        className="w-[200px]"
                        disabled={adding}
                    />
                    <Button type="submit" disabled={adding || !newKw.trim()}>
                        <Plus className="h-4 w-4 mr-2" /> Add
                    </Button>
                </form>
            </div>
            {keywords.length === 0 ? (
                <div className="text-center py-8 text-zoru-ink-muted text-[13px]">
                    No keywords added yet. Add some to start tracking rankings.
                </div>
            ) : (
                <div className="border border-zoru-line rounded-[var(--zoru-radius)] overflow-hidden">
                    <Table>
                        <TableHeader className="bg-zoru-surface-2">
                            <TableRow>
                                <TableHead>Keyword</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead className="text-right">Rank</TableHead>
                                <TableHead className="text-right">Volume</TableHead>
                                <TableHead className="text-right w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {keywords.map((kw: any) => (
                                <TableRow key={kw._id}>
                                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                                    <TableCell>{kw.location === '2840' ? 'US' : kw.location}</TableCell>
                                    <TableCell className="text-right">
                                        {kw.currentRank ? (
                                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-zoru-ink text-zoru-surface text-[11px] font-semibold">
                                                {kw.currentRank}
                                            </span>
                                        ) : (
                                            <span className="text-zoru-ink-muted">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">{kw.currentVolume?.toLocaleString() || '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zoru-ink hover:text-zoru-ink hover:bg-zoru-surface-2" onClick={() => handleDeleteKw(kw._id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </Card>
    );
}

function CompetitorMetrics({ domain }: { domain: string }) {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSiteMetrics(domain).then(res => {
            setMetrics(res);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [domain]);

    if (loading) return <Skeleton className="h-16 w-full mt-2" />;

    return (
        <div className="grid grid-cols-3 gap-4 mt-3">
            <div>
                <div className="text-[11px] text-zoru-ink-muted">DA</div>
                <div className="text-sm font-semibold text-zoru-ink">{metrics?.domainAuthority || '-'}</div>
            </div>
            <div>
                <div className="text-[11px] text-zoru-ink-muted">Backlinks</div>
                <div className="text-sm font-semibold text-zoru-ink">{metrics?.totalBacklinks?.toLocaleString() || '-'}</div>
            </div>
            <div>
                <div className="text-[11px] text-zoru-ink-muted">Ref. Domains</div>
                <div className="text-sm font-semibold text-zoru-ink">{metrics?.linkingDomains?.toLocaleString() || '-'}</div>
            </div>
        </div>
    );
}

function CompetitorsTab({ project }: { project: any }) {
    return (
        <Card className="p-6">
            <div className="mb-6">
                <div className="text-sm text-zoru-ink font-medium">Competitor Analysis</div>
                <p className="text-zoru-ink-muted text-[12.5px] mt-1">Compare your metrics against tracked competitors.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {project.competitors?.map((comp: string) => (
                    <div key={comp} className="flex flex-col p-4 border border-zoru-line rounded-[var(--zoru-radius)] bg-zoru-surface">
                        <div className="flex justify-between items-center pb-3 border-b border-zoru-line border-dashed">
                            <span className="text-sm font-medium text-zoru-ink flex items-center gap-2">
                                <Globe className="h-4 w-4 text-zoru-ink-muted" />
                                {comp}
                            </span>
                            <Button size="sm" variant="ghost" className="h-7 text-[11px]">View Report</Button>
                        </div>
                        <CompetitorMetrics domain={comp} />
                    </div>
                ))}
                {(!project.competitors || project.competitors.length === 0) && (
                    <div className="col-span-full py-8 text-center border border-zoru-line border-dashed rounded-[var(--zoru-radius)]">
                        <p className="text-zoru-ink-muted text-[13px]">No competitors added.</p>
                        <p className="text-[11px] text-zoru-ink-muted mt-1">Go to Settings to add competitors.</p>
                    </div>
                )}
            </div>
        </Card>
    );
}

function SettingsTab({ project, onUpdate }: { project: any, onUpdate: () => void }) {
    const [competitors, setCompetitors] = useState(project.competitors?.join(', ') || '');
    const [location, setLocation] = useState(project.settings?.locations?.[0] || 'US');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();
    const { toast } = useZoruToast();

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const compArray = competitors.split(',').map((s: string) => s.trim()).filter(Boolean);
        const res = await updateSeoProject(project._id, {
            competitors: compArray,
            settings: { ...project.settings, locations: [location] }
        });
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Settings updated' });
            onUpdate();
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
        setDeleting(true);
        const res = await deleteSeoProject(project._id);
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
            setDeleting(false);
        } else {
            toast({ title: 'Success', description: 'Project deleted' });
            router.push('/dashboard/seo');
        }
    };

    return (
        <Card className="p-6 max-w-2xl">
            <div className="mb-6">
                <div className="text-sm text-zoru-ink font-medium">Project Settings</div>
                <p className="text-zoru-ink-muted text-[12.5px] mt-1">Update your SEO project settings or delete the project.</p>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col gap-6">
                <div className="space-y-2">
                    <Label htmlFor="competitors">Competitors</Label>
                    <Input 
                        id="competitors" 
                        value={competitors} 
                        onChange={(e) => setCompetitors(e.target.value)} 
                        placeholder="example1.com, example2.com" 
                    />
                    <p className="text-[11px] text-zoru-ink-muted">Comma separated list of competitor domains.</p>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="location">Target Location</Label>
                    <Input 
                        id="location" 
                        value={location} 
                        onChange={(e) => setLocation(e.target.value)} 
                        placeholder="US, UK, IN" 
                    />
                    <p className="text-[11px] text-zoru-ink-muted">Country code for rank tracking.</p>
                </div>

                <div className="flex gap-3">
                    <Button type="submit" disabled={saving}>
                        {saving ? 'Saving...' : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Settings
                            </>
                        )}
                    </Button>
                </div>
            </form>

            <div className="mt-10 pt-6 border-t border-zoru-line border-dashed">
                <div className="mb-4">
                    <h3 className="text-sm font-medium text-zoru-ink">Danger Zone</h3>
                    <p className="text-[12.5px] text-zoru-ink-muted mt-1">Deleting this project will permanently remove all associated audits, keywords, and history.</p>
                </div>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting ? 'Deleting...' : 'Delete Project'}
                </Button>
            </div>
        </Card>
    );
}

import { fmtDate } from '@/lib/utils';

type TabKey = 'overview' | 'keywords' | 'competitors' | 'settings';

export function ProjectDashboardClient({ 
    projectId, 
    initialProject, 
    initialMetrics 
}: { 
    projectId: string, 
    initialProject: any, 
    initialMetrics: any 
}) {
    const { toast } = useZoruToast();
    const [project, setProject] = useState<any>(initialProject);
    const [metrics, setMetrics] = useState<any>(initialMetrics);
    const [tab, setTab] = useState<TabKey>('overview');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        if (refreshTrigger > 0) {
            getSeoProject(projectId).then(proj => {
                if (proj) {
                    setProject(proj);
                    getSiteMetrics(proj.domain).then(setMetrics);
                }
            });
        }
    }, [refreshTrigger, projectId]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-[28px] leading-none text-zoru-ink flex items-center gap-3">
                        <Globe className="h-7 w-7 text-zoru-ink" />
                        {project.domain}
                    </h1>
                    <p className="text-zoru-ink-muted mt-2 text-[12.5px]">
                        Tracking {project.settings?.locations?.[0] || 'US'} · {project.crawledAt ? 'Last Crawl: ' + fmtDate(project.crawledAt) : 'No crawls yet'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/dashboard/seo/${projectId}/audit`}>
                        <Button variant="outline">Run Audit</Button>
                    </Link>
                    <Link href={`/dashboard/seo/${projectId}/grid`}>
                        <Button>
                            <Map className="h-4 w-4 mr-2" />
                            Grid Tracker
                        </Button>
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
                {(['overview', 'keywords', 'competitors', 'settings'] as TabKey[]).map(key => (
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
                <Card className="p-6">
                    <div className="mb-4">
                        <div className="text-sm text-zoru-ink font-medium">Estimated Traffic Trend</div>
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
                </Card>
            )}

            {tab === 'keywords' && <KeywordsTab projectId={projectId} project={project} />}

            {tab === 'competitors' && <CompetitorsTab project={project} />}

            {tab === 'settings' && <SettingsTab project={project} onUpdate={() => setRefreshTrigger(r => r + 1)} />}
        </div>
    );
}
