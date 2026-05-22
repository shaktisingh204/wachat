'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Skeleton } from '@/components/zoruui';
import {
  Filter,
  RefreshCw,
  DollarSign } from 'lucide-react';

import * as React from 'react';

import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { getConversionFunnel } from '@/app/actions/ad-manager-features.actions';
import {
    AmBreadcrumb,
    AmErrorAlert,
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
                    <ZoruButton variant="outline" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </ZoruButton>
                }
            />

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => <ZoruSkeleton key={i} className="h-14" />)}
                </div>
            ) : !funnel ? (
                <ZoruCard><ZoruCardContent className="p-8 text-center text-muted-foreground">No funnel data available.</ZoruCardContent></ZoruCard>
            ) : (
                <>
                    <ZoruCard>
                        <ZoruCardContent className="p-4 flex items-center gap-3">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <div className="text-sm text-muted-foreground">Total spend (30d)</div>
                                <div className="text-2xl font-bold tabular-nums">${funnel.spend.toFixed(2)}</div>
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>

                    <ZoruCard>
                        <ZoruCardHeader><ZoruCardTitle className="text-base">Funnel steps</ZoruCardTitle></ZoruCardHeader>
                        <ZoruCardContent className="space-y-4">
                            {STEPS.map((step, idx) => {
                                const count = funnel[step.key];
                                const prevCount = idx > 0 ? funnel[STEPS[idx - 1].key] : count;
                                const dropOff = idx > 0 && prevCount > 0 ? ((1 - count / prevCount) * 100).toFixed(1) : null;
                                const widthPct = Math.max((count / maxVal) * 100, 2);
                                const costPer = funnel.spend > 0 && count > 0 ? (funnel.spend / count).toFixed(2) : '—';

                                return (
                                    <div key={step.key}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">{step.label}</span>
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="tabular-nums font-semibold">{count.toLocaleString()}</span>
                                                {dropOff && (
                                                    <span className="text-red-500 text-xs">-{dropOff}%</span>
                                                )}
                                                <span className="text-muted-foreground text-xs tabular-nums">
                                                    ${costPer}/ea
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-6">
                                            <div
                                                className="bg-blue-500 h-6 rounded-full transition-all duration-500"
                                                style={{ width: `${widthPct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </ZoruCardContent>
                    </ZoruCard>

                    <ZoruCard>
                        <ZoruCardHeader><ZoruCardTitle className="text-base">Cost per step</ZoruCardTitle></ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                {STEPS.map((step) => {
                                    const count = funnel[step.key];
                                    const cost = count > 0 ? (funnel.spend / count).toFixed(2) : '—';
                                    return (
                                        <div key={step.key} className="text-center">
                                            <div className="text-xs text-muted-foreground">{step.label}</div>
                                            <div className="text-lg font-bold tabular-nums">${cost}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ZoruCardContent>
                    </ZoruCard>
                </>
            )}
        </div>
    );
}
