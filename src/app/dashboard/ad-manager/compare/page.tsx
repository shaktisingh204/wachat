'use client';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  ArrowDown,
  ArrowUp,
  GitCompareArrows,
  Inbox,
  X,
} from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader, AmNoProject } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
import { listCampaigns } from '@/app/actions/ad-manager.actions';
import { compareCampaigns } from '@/app/actions/ad-manager-features.actions';

type Campaign = { id: string; name: string; status: string };
type ComparisonRow = { campaignId: string; campaign_name: string; impressions: string; reach: string; clicks: string; spend: string; cpc: string; cpm: string; ctr: string };

const METRICS: { key: keyof ComparisonRow; label: string; format: (v: string) => string; higherIsBetter: boolean }[] = [
    { key: 'impressions', label: 'Impressions', format: (v) => Number(v || 0).toLocaleString(), higherIsBetter: true },
    { key: 'reach', label: 'Reach', format: (v) => Number(v || 0).toLocaleString(), higherIsBetter: true },
    { key: 'clicks', label: 'Clicks', format: (v) => Number(v || 0).toLocaleString(), higherIsBetter: true },
    { key: 'spend', label: 'Spend', format: (v) => `$${Number(v || 0).toFixed(2)}`, higherIsBetter: false },
    { key: 'cpc', label: 'CPC', format: (v) => `$${Number(v || 0).toFixed(2)}`, higherIsBetter: false },
    { key: 'cpm', label: 'CPM', format: (v) => `$${Number(v || 0).toFixed(2)}`, higherIsBetter: false },
    { key: 'ctr', label: 'CTR', format: (v) => `${Number(v || 0).toFixed(2)}%`, higherIsBetter: true },
];

function statusTone(status: string): 'success' | 'warning' | 'neutral' {
    const s = status.toUpperCase();
    if (s === 'ACTIVE') return 'success';
    if (s === 'PAUSED') return 'warning';
    return 'neutral';
}

export default function CampaignComparePage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [isClient, setIsClient] = React.useState(false);
    const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [results, setResults] = React.useState<ComparisonRow[]>([]);
    const [loadingList, setLoadingList] = React.useState(true);
    const [comparing, setComparing] = React.useState(false);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    React.useEffect(() => {
        if (!activeAccount) return;
        setLoadingList(true);
        listCampaigns(activeAccount.account_id).then((res) => {
            if (res.error) {
                toast.error({ title: 'Could not load campaigns', description: res.error });
            } else {
                setCampaigns((res.data || []).map((c: any) => ({ id: c.id, name: c.name, status: c.status })));
            }
            setLoadingList(false);
        });
    }, [activeAccount, toast]);

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) { next.delete(id); } else {
                if (next.size >= 5) { toast({ title: 'You can compare up to 5 campaigns', tone: 'warning' }); return prev; }
                next.add(id);
            }
            return next;
        });
    };

    const runComparison = async () => {
        if (selected.size < 2) { toast({ title: 'Select at least 2 campaigns to compare', tone: 'warning' }); return; }
        setComparing(true);
        const res = await compareCampaigns(Array.from(selected));
        if (res.error) {
            toast.error({ title: 'Comparison failed', description: res.error });
        } else {
            setResults(res.comparisons || []);
        }
        setComparing(false);
    };

    const clearAll = () => { setSelected(new Set()); setResults([]); };

    if (!isClient) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Compare" />
                <div className="space-y-4">
                    <Skeleton height={80} width="100%" />
                    <Skeleton height={300} width="100%" />
                </div>
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Compare" />
                <AmNoProject />
            </div>
        );
    }

    const bestWorst = (metricKey: keyof ComparisonRow, higherIsBetter: boolean) => {
        if (results.length < 2) return { best: '', worst: '' };
        const vals = results.map((r) => ({ id: r.campaignId, v: Number(r[metricKey] || 0) }));
        vals.sort((a, b) => a.v - b.v);
        const best = higherIsBetter ? vals[vals.length - 1].id : vals[0].id;
        const worst = higherIsBetter ? vals[0].id : vals[vals.length - 1].id;
        return { best, worst };
    };

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Compare" />
            <AmHeader
                title="Campaign comparison"
                description="Select 2 to 5 campaigns to compare side by side."
                actions={
                    <div className="flex gap-2 items-center">
                        <GitCompareArrows className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                        {selected.size > 0 && (
                            <Button variant="outline" size="sm" iconLeft={X} onClick={clearAll}>
                                Clear
                            </Button>
                        )}
                        <Button variant="primary" loading={comparing} disabled={selected.size < 2} onClick={runComparison}>
                            {comparing ? 'Comparing' : `Compare (${selected.size})`}
                        </Button>
                    </div>
                }
            />

            {loadingList ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={40} width="100%" />)}</div>
            ) : (
                <Card>
                    <CardHeader><CardTitle className="text-base">Select campaigns</CardTitle></CardHeader>
                    <CardBody className="max-h-60 overflow-y-auto space-y-2">
                        {campaigns.length === 0 ? (
                            <EmptyState
                                icon={Inbox}
                                size="sm"
                                title="No campaigns found"
                                description="There are no campaigns in this ad account yet."
                            />
                        ) : campaigns.map((c) => (
                            <div key={c.id} className="flex items-center gap-3 rounded-[var(--st-radius)] p-1.5 hover:bg-[var(--st-bg-muted)]/50">
                                <Checkbox
                                    checked={selected.has(c.id)}
                                    onChange={() => toggle(c.id)}
                                    label={<span className="block truncate">{c.name}</span>}
                                    className="min-w-0 flex-1"
                                />
                                <Badge tone={statusTone(c.status)} kind="soft" className="shrink-0">{c.status}</Badge>
                            </div>
                        ))}
                    </CardBody>
                </Card>
            )}

            {results.length > 0 && (
                <Card padding="none">
                    <CardBody className="overflow-x-auto p-0">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th className="sticky left-0 z-10 bg-[var(--st-bg-secondary)]">Metric</Th>
                                    {results.map((r) => (
                                        <Th key={r.campaignId} className="min-w-[140px]">
                                            {r.campaign_name || r.campaignId}
                                        </Th>
                                    ))}
                                </Tr>
                            </THead>
                            <TBody>
                                {METRICS.map((m) => {
                                    const bw = bestWorst(m.key, m.higherIsBetter);
                                    return (
                                        <Tr key={m.key}>
                                            <Td className="sticky left-0 z-10 bg-[var(--st-bg-secondary)] font-medium">{m.label}</Td>
                                            {results.map((r) => {
                                                const isBest = r.campaignId === bw.best;
                                                const isWorst = r.campaignId === bw.worst;
                                                return (
                                                    <Td key={r.campaignId} className="tabular-nums">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span className={isBest ? 'font-semibold text-[var(--st-text)]' : 'text-[var(--st-text)]'}>
                                                                {m.format(r[m.key])}
                                                            </span>
                                                            {isBest && (
                                                                <Badge tone="success" kind="soft" className="shrink-0">
                                                                    <ArrowUp className="h-3 w-3" aria-hidden="true" /> Best
                                                                </Badge>
                                                            )}
                                                            {isWorst && (
                                                                <Badge tone="danger" kind="soft" className="shrink-0">
                                                                    <ArrowDown className="h-3 w-3" aria-hidden="true" /> Worst
                                                                </Badge>
                                                            )}
                                                        </span>
                                                    </Td>
                                                );
                                            })}
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
