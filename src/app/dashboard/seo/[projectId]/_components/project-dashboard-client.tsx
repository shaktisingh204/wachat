'use client';

import {
  Button,
  Card,
  CardBody,
  Skeleton,
  useToast,
  Input,
  Field,
  Badge,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import { useEffect, useState } from 'react';

import { Star, Link as LinkIcon, BarChart, Globe, Target, Map, Trash2, Save, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { getSeoProject, getSiteMetrics, getKeywords, deleteSeoProject, updateSeoProject, addKeyword, deleteKeyword } from '@/app/actions/seo.actions';
import { Bar, CartesianGrid, XAxis, YAxis, ComposedChart } from 'recharts';
import { useRouter } from 'next/navigation';
import { fmtDate } from '@/lib/utils';

const ChartContainer = dynamic(() => import('@/components/sabcrm/20ui').then(mod => mod.ChartContainer), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }) as any;
const ChartTooltip = dynamic(() => import('@/components/sabcrm/20ui').then(mod => mod.ChartTooltip), { ssr: false }) as any;

const chartConfig = {
    organic: { label: 'Organic', color: 'var(--st-text)' },
    social: { label: 'Social', color: 'var(--st-text-secondary)' },
    direct: { label: 'Direct', color: 'var(--st-text-tertiary)' },
};

function MetricCard({ title, value, icon: Icon, desc }: { title: string, value: string | number, icon: React.ElementType, desc?: string }) {
    return (
        <Card padding="none">
            <CardBody className="p-4">
                <div className="flex items-start justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                </div>
                <div className="mt-3.5 text-[11.5px] leading-none text-[var(--st-text-secondary)]">{title}</div>
                <div className="mt-1.5 text-[22px] tracking-[-0.01em] leading-none text-[var(--st-text)]">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                {desc && <p className="mt-1 text-[11px] leading-tight text-[var(--st-text-secondary)]">{desc}</p>}
            </CardBody>
        </Card>
    );
}

function KeywordsTab({ projectId, project }: { projectId: string, project: any }) {
    const [keywords, setKeywords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKw, setNewKw] = useState('');
    const [adding, setAdding] = useState(false);
    const { toast } = useToast();

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
            toast.error(res.error);
        } else {
            toast.success('Keyword added');
            setNewKw('');
            fetchKeywords();
        }
        setAdding(false);
    };

    const handleDeleteKw = async (kwId: string) => {
        const res = await deleteKeyword(kwId, projectId);
        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success('Keyword removed');
            fetchKeywords();
        }
    };

    if (loading) return <Skeleton className="h-40 w-full" />;

    return (
        <Card padding="none">
            <CardBody className="p-6">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="text-sm text-[var(--st-text)] font-medium">Top Performing Keywords</div>
                        <p className="text-[var(--st-text-secondary)] text-[12.5px] mt-1">Track your keyword rankings over time.</p>
                    </div>
                    <form onSubmit={handleAdd} className="flex gap-2">
                        <Input
                            placeholder="Add new keyword..."
                            value={newKw}
                            onChange={(e) => setNewKw(e.target.value)}
                            className="w-[200px]"
                            disabled={adding}
                            aria-label="New keyword"
                        />
                        <Button type="submit" variant="primary" iconLeft={Plus} disabled={adding || !newKw.trim()}>
                            Add
                        </Button>
                    </form>
                </div>
                {keywords.length === 0 ? (
                    <EmptyState
                        icon={Star}
                        title="No keywords added yet"
                        description="Add some to start tracking rankings."
                    />
                ) : (
                    <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden">
                        <Table>
                            <THead className="bg-[var(--st-bg-muted)]">
                                <Tr>
                                    <Th>Keyword</Th>
                                    <Th>Location</Th>
                                    <Th align="right">Rank</Th>
                                    <Th align="right">Volume</Th>
                                    <Th align="right" width={48}><span className="sr-only">Actions</span></Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {keywords.map((kw: any) => (
                                    <Tr key={kw._id}>
                                        <Td className="font-medium">{kw.keyword}</Td>
                                        <Td>{kw.location === '2840' ? 'US' : kw.location}</Td>
                                        <Td align="right">
                                            {kw.currentRank ? (
                                                <Badge tone="neutral" kind="solid">{kw.currentRank}</Badge>
                                            ) : (
                                                <span className="text-[var(--st-text-secondary)]">-</span>
                                            )}
                                        </Td>
                                        <Td align="right">{kw.currentVolume?.toLocaleString() || '-'}</Td>
                                        <Td align="right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                iconLeft={Trash2}
                                                aria-label={`Remove keyword ${kw.keyword}`}
                                                onClick={() => handleDeleteKw(kw._id)}
                                            />
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </div>
                )}
            </CardBody>
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
                <div className="text-[11px] text-[var(--st-text-secondary)]">DA</div>
                <div className="text-sm font-semibold text-[var(--st-text)]">{metrics?.domainAuthority || '-'}</div>
            </div>
            <div>
                <div className="text-[11px] text-[var(--st-text-secondary)]">Backlinks</div>
                <div className="text-sm font-semibold text-[var(--st-text)]">{metrics?.totalBacklinks?.toLocaleString() || '-'}</div>
            </div>
            <div>
                <div className="text-[11px] text-[var(--st-text-secondary)]">Ref. Domains</div>
                <div className="text-sm font-semibold text-[var(--st-text)]">{metrics?.linkingDomains?.toLocaleString() || '-'}</div>
            </div>
        </div>
    );
}

function CompetitorsTab({ project }: { project: any }) {
    return (
        <Card padding="none">
            <CardBody className="p-6">
                <div className="mb-6">
                    <div className="text-sm text-[var(--st-text)] font-medium">Competitor Analysis</div>
                    <p className="text-[var(--st-text-secondary)] text-[12.5px] mt-1">Compare your metrics against tracked competitors.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    {project.competitors?.map((comp: string) => (
                        <div key={comp} className="flex flex-col p-4 border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                            <div className="flex justify-between items-center pb-3 border-b border-[var(--st-border)] border-dashed">
                                <span className="text-sm font-medium text-[var(--st-text)] flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                                    {comp}
                                </span>
                                <Button size="sm" variant="ghost" className="h-7 text-[11px]">View Report</Button>
                            </div>
                            <CompetitorMetrics domain={comp} />
                        </div>
                    ))}
                    {(!project.competitors || project.competitors.length === 0) && (
                        <div className="col-span-full">
                            <EmptyState
                                icon={Globe}
                                title="No competitors added"
                                description="Go to Settings to add competitors."
                            />
                        </div>
                    )}
                </div>
            </CardBody>
        </Card>
    );
}

function SettingsTab({ project, onUpdate }: { project: any, onUpdate: () => void }) {
    const [competitors, setCompetitors] = useState(project.competitors?.join(', ') || '');
    const [location, setLocation] = useState(project.settings?.locations?.[0] || 'US');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const compArray = competitors.split(',').map((s: string) => s.trim()).filter(Boolean);
        const res = await updateSeoProject(project._id, {
            competitors: compArray,
            settings: { ...project.settings, locations: [location] }
        });
        if (res.error) {
            toast.error(res.error);
        } else {
            toast.success('Settings updated');
            onUpdate();
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
        setDeleting(true);
        const res = await deleteSeoProject(project._id);
        if (res.error) {
            toast.error(res.error);
            setDeleting(false);
        } else {
            toast.success('Project deleted');
            router.push('/dashboard/seo');
        }
    };

    return (
        <Card padding="none" className="max-w-2xl">
            <CardBody className="p-6">
                <div className="mb-6">
                    <div className="text-sm text-[var(--st-text)] font-medium">Project Settings</div>
                    <p className="text-[var(--st-text-secondary)] text-[12.5px] mt-1">Update your SEO project settings or delete the project.</p>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-6">
                    <Field label="Competitors" help="Comma separated list of competitor domains.">
                        <Input
                            value={competitors}
                            onChange={(e) => setCompetitors(e.target.value)}
                            placeholder="example1.com, example2.com"
                        />
                    </Field>

                    <Field label="Target Location" help="Country code for rank tracking.">
                        <Input
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="US, UK, IN"
                        />
                    </Field>

                    <div className="flex gap-3">
                        <Button type="submit" variant="primary" iconLeft={Save} loading={saving}>
                            {saving ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </form>

                <div className="mt-10 pt-6 border-t border-[var(--st-border)] border-dashed">
                    <div className="mb-4">
                        <h3 className="text-sm font-medium text-[var(--st-text)]">Danger Zone</h3>
                        <p className="text-[12.5px] text-[var(--st-text-secondary)] mt-1">Deleting this project will permanently remove all associated audits, keywords, and history.</p>
                    </div>
                    <Button variant="danger" iconLeft={Trash2} onClick={handleDelete} loading={deleting}>
                        {deleting ? 'Deleting...' : 'Delete Project'}
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}

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
    const router = useRouter();
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
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle className="flex items-center gap-3">
                        <Globe className="h-7 w-7 text-[var(--st-text)]" aria-hidden="true" />
                        {project.domain}
                    </PageTitle>
                    <PageDescription>
                        Tracking {project.settings?.locations?.[0] || 'US'}. {project.crawledAt ? 'Last Crawl: ' + fmtDate(project.crawledAt) : 'No crawls yet'}
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="outline" onClick={() => router.push(`/dashboard/seo/${projectId}/audit`)}>
                        Run Audit
                    </Button>
                    <Button variant="primary" iconLeft={Map} onClick={() => router.push(`/dashboard/seo/${projectId}/grid`)}>
                        Grid Tracker
                    </Button>
                </PageActions>
            </PageHeader>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Domain Authority"
                    value={metrics.domainAuthority || 'N/A'}
                    icon={BarChart}
                    desc="Normalized score (0-100)"
                />
                <MetricCard
                    title="Backlinks"
                    value={metrics.totalBacklinks || 0}
                    icon={LinkIcon}
                    desc={`${metrics.linkingDomains || 0} Referring Domains`}
                />
                <MetricCard
                    title="Health Score"
                    value={project.healthScore || 'N/A'}
                    icon={Target}
                    desc="Based on last technical audit"
                />
                <MetricCard
                    title="Keywords Tracked"
                    value={project.settings?.targetedKeywords?.length || 0}
                    icon={Star}
                    desc="In top 100 positions"
                />
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="keywords">Keywords</TabsTrigger>
                    <TabsTrigger value="competitors">Competitors</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <Card padding="none">
                        <CardBody className="p-6">
                            <div className="mb-4">
                                <div className="text-sm text-[var(--st-text)] font-medium">Estimated Traffic Trend</div>
                                <div className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
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
                        </CardBody>
                    </Card>
                </TabsContent>

                <TabsContent value="keywords">
                    <KeywordsTab projectId={projectId} project={project} />
                </TabsContent>

                <TabsContent value="competitors">
                    <CompetitorsTab project={project} />
                </TabsContent>

                <TabsContent value="settings">
                    <SettingsTab project={project} onUpdate={() => setRefreshTrigger(r => r + 1)} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
