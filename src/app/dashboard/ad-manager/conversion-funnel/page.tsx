'use client';

import {
    Badge,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    EmptyState,
    StatCard,
    Skeleton,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Button,
} from '@/components/sabcrm/20ui';
import { RefreshCw, DollarSign, Download, BarChart3 } from 'lucide-react';

import * as React from 'react';

import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { getConversionFunnel } from '@/app/actions/ad-manager-features.actions';
import {
    AmBreadcrumb,
    AmHeader,
    AmNoProject,
} from '@/app/dashboard/ad-manager/_components/am-page-shell';

type Funnel = {
    impressions: number;
    reach: number;
    clicks: number;
    addToCart: number;
    leads: number;
    purchases: number;
    spend: number;
};

const STEPS: { key: keyof Omit<Funnel, 'spend'>; label: string }[] = [
    { key: 'impressions', label: 'Impressions' },
    { key: 'reach', label: 'Reach' },
    { key: 'clicks', label: 'Clicks' },
    { key: 'addToCart', label: 'Add to Cart' },
    { key: 'leads', label: 'Leads' },
    { key: 'purchases', label: 'Purchases' },
];

export default function ConversionFunnelPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [funnel, setFunnel] = React.useState<Funnel | null>(null);

    const fetchData = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
        const res = await getConversionFunnel(actId);
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
            setFunnel(null);
        } else {
            setFunnel(res.funnel || null);
        }
        setLoading(false);
    }, [activeAccount, toast]);

    const handleExport = React.useCallback(() => {
        if (!funnel) return;

        const rows = [
            ['Step', 'Count', 'Drop-off %', 'Cost Per Step ($)'],
        ];

        let prevCount = funnel[STEPS[0].key];

        STEPS.forEach((step, idx) => {
            const count = funnel[step.key];
            const dropOff = idx > 0 && prevCount > 0 ? ((1 - count / prevCount) * 100).toFixed(1) : '0.0';
            const costPer = funnel.spend > 0 && count > 0 ? (funnel.spend / count).toFixed(2) : '0.00';
            rows.push([step.label, count.toString(), dropOff, costPer]);
            prevCount = count;
        });

        rows.push(['Total Spend', '', '', funnel.spend.toFixed(2)]);

        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `conversion_funnel_${activeAccount?.account_id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [funnel, activeAccount]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    if (!activeAccount) {
        return (
            <div className="space-y-4">
                <AmBreadcrumb page="Conversion funnel" />
                <AmNoProject />
            </div>
        );
    }

    const maxVal = funnel ? Math.max(funnel.impressions, 1) : 1;

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Conversion funnel" />
            <AmHeader
                title="Conversion funnel"
                description="Last 30 days funnel from impressions to purchases."
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            iconLeft={Download}
                            onClick={handleExport}
                            disabled={!funnel || loading}
                        >
                            Export CSV
                        </Button>
                        <Button
                            variant="outline"
                            iconLeft={RefreshCw}
                            onClick={fetchData}
                            disabled={loading}
                            loading={loading}
                        >
                            Refresh
                        </Button>
                    </div>
                }
            />

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} height={56} radius="var(--st-radius)" />
                    ))}
                </div>
            ) : !funnel ? (
                <Card>
                    <CardBody>
                        <EmptyState
                            icon={BarChart3}
                            title="No funnel data available"
                            description="There is no conversion data for this account over the last 30 days."
                        />
                    </CardBody>
                </Card>
            ) : (
                <>
                    <StatCard
                        icon={DollarSign}
                        label="Total spend (30d)"
                        value={`$${funnel.spend.toFixed(2)}`}
                    />

                    <Card>
                        <CardHeader><CardTitle className="text-base">Funnel steps</CardTitle></CardHeader>
                        <CardBody className="space-y-4">
                            {STEPS.map((step, idx) => {
                                const count = funnel[step.key];
                                const prevCount = idx > 0 ? funnel[STEPS[idx - 1].key] : count;
                                const dropOff = idx > 0 && prevCount > 0 ? ((1 - count / prevCount) * 100).toFixed(1) : null;
                                const widthPct = Math.max((count / maxVal) * 100, 2);
                                const costPer = funnel.spend > 0 && count > 0 ? (funnel.spend / count).toFixed(2) : '-';

                                return (
                                    <div key={step.key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-[var(--st-text)]">{step.label}</span>
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="tabular-nums font-semibold text-[var(--st-text)]">{count.toLocaleString()}</span>
                                                {dropOff && (
                                                    <Badge tone="danger" kind="soft">-{dropOff}%</Badge>
                                                )}
                                                <span className="text-[var(--st-text-secondary)] text-xs tabular-nums">
                                                    ${costPer}/ea
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-[var(--st-bg-muted)] rounded-[var(--st-radius-pill)] h-6">
                                            <div
                                                className="bg-[var(--st-accent)] h-6 rounded-[var(--st-radius-pill)] transition-all duration-500"
                                                style={{ width: `${widthPct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Cost per step</CardTitle></CardHeader>
                        <CardBody>
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Step</Th>
                                        <Th align="right">Count</Th>
                                        <Th align="right">Cost per result</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {STEPS.map((step) => {
                                        const count = funnel[step.key];
                                        const cost = count > 0 ? (funnel.spend / count).toFixed(2) : '-';
                                        return (
                                            <Tr key={step.key}>
                                                <Td>{step.label}</Td>
                                                <Td align="right" className="tabular-nums">{count.toLocaleString()}</Td>
                                                <Td align="right" className="tabular-nums font-semibold">${cost}</Td>
                                            </Tr>
                                        );
                                    })}
                                </TBody>
                            </Table>
                        </CardBody>
                    </Card>
                </>
            )}
        </div>
    );
}
