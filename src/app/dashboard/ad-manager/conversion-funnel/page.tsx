'use client';

import * as React from 'react';
import { LuFilter, LuCircleAlert, LuRefreshCw, LuDollarSign } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { getConversionFunnel } from '@/app/actions/ad-manager-features.actions';

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
            <div>
                <Alert>
                    <LuCircleAlert className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view the conversion funnel.</AlertDescription>
                </Alert>
            </div>
        );
    }

    const maxVal = funnel ? Math.max(funnel.impressions, 1) : 1;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LuFilter className="h-6 w-6" /> Conversion funnel
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Last 30 days funnel from impressions to purchases.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                    <LuRefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
                </div>
            ) : !funnel ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No funnel data available.</CardContent></Card>
            ) : (
                <>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <LuDollarSign className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <div className="text-sm text-muted-foreground">Total spend (30d)</div>
                                <div className="text-2xl font-bold tabular-nums">${funnel.spend.toFixed(2)}</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Funnel steps</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
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
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Cost per step</CardTitle></CardHeader>
                        <CardContent>
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
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
