'use client';

import { Alert, AlertDescription, AlertTitle, Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Skeleton, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import {
  GitCompareArrows,
  CircleAlert,
  X } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/components/sabcrm/20ui';
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
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
                if (next.size >= 5) { toast({ title: 'Max 5 campaigns' }); return prev; }
                next.add(id);
            }
            return next;
        });
    };

    const runComparison = async () => {
        if (selected.size < 2) { toast({ title: 'Select at least 2 campaigns' }); return; }
        setComparing(true);
        const res = await compareCampaigns(Array.from(selected));
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-[300px] w-full" />
                </div>
            </div>
        );
    }

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Compare" />
                <Alert>
                    <CircleAlert className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to compare campaigns.</AlertDescription>
                </Alert>
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
                description="Select 2-5 campaigns to compare side by side."
                actions={
                    <div className="flex gap-2 items-center">
                        <GitCompareArrows className="h-5 w-5 text-[var(--st-text-secondary)]" />
                        {selected.size > 0 && (
                            <Button variant="outline" size="sm" onClick={clearAll}>
                                <X className="h-4 w-4 mr-1" /> Clear
                            </Button>
                        )}
                        <Button onClick={runComparison} disabled={comparing || selected.size < 2}>
                            {comparing ? 'Comparing...' : `Compare (${selected.size})`}
                        </Button>
                    </div>
                }
            />

            {loadingList ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
                <Card>
                    <CardHeader><CardTitle className="text-base">Select campaigns</CardTitle></CardHeader>
                    <CardBody className="max-h-60 overflow-y-auto space-y-2">
                        {campaigns.length === 0 ? (
                            <p className="text-sm text-[var(--st-text-secondary)]">No campaigns found.</p>
                        ) : campaigns.map((c) => (
                            <label key={c.id} className="flex items-center gap-3 cursor-pointer hover:bg-[var(--st-bg-muted)]/50 rounded p-1.5">
                                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                                <span className="text-sm flex-1 truncate">{c.name}</span>
                                <span className="text-xs text-[var(--st-text-secondary)]">{c.status}</span>
                            </label>
                        ))}
                    </CardBody>
                </Card>
            )}

            {results.length > 0 && (
                <Card>
                    <CardBody className="p-0 overflow-x-auto">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th className="sticky left-0 bg-[var(--st-bg-secondary)] z-10">Metric</Th>
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
                                            <Td className="font-medium sticky left-0 bg-[var(--st-bg-secondary)] z-10">{m.label}</Td>
                                            {results.map((r) => {
                                                const isBest = r.campaignId === bw.best;
                                                const isWorst = r.campaignId === bw.worst;
                                                return (
                                                    <Td
                                                        key={r.campaignId}
                                                        className={`tabular-nums ${isBest ? 'text-[var(--st-text)] font-semibold' : ''} ${isWorst ? 'text-[var(--st-text)]' : ''}`}
                                                    >
                                                        {m.format(r[m.key])}
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
