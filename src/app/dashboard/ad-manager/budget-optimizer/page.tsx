'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Skeleton,
} from '@/components/zoruui';
import {
  Wallet,
  CircleAlert,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Pause,
  Minus } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { getBudgetRecommendations } from '@/app/actions/ad-manager-features.actions';

type Rec = {
    campaignId: string;
    campaignName: string;
    spend: number;
    clicks: number;
    cpc: number;
    ctr: number;
    dailyBudget: number;
    recommendation: string;
    reason: string;
};

const recStyles: Record<string, { variant: 'default' | 'danger' | 'outline' | 'secondary'; icon: typeof TrendingUp }> = {
    increase: { variant: 'default', icon: TrendingUp },
    decrease: { variant: 'secondary', icon: TrendingDown },
    pause: { variant: 'danger', icon: Pause },
    maintain: { variant: 'outline', icon: Minus },
};

export default function BudgetOptimizerPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [recs, setRecs] = React.useState<Rec[]>([]);

    const fetchData = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
        const res = await getBudgetRecommendations(actId);
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
            setRecs([]);
        } else {
            setRecs(res.recommendations || []);
        }
        setLoading(false);
    }, [activeAccount, toast]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Budget Optimizer" />
                <ZoruAlert>
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to view budget recommendations.</ZoruAlertDescription>
                </ZoruAlert>
            </div>
        );
    }

    const countByType = (type: string) => recs.filter((r) => r.recommendation === type).length;

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Budget Optimizer" />
            <AmHeader
                title="Budget optimizer"
                description="AI-driven budget recommendations based on last 7 days performance."
                actions={
                    <ZoruButton variant="outline" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </ZoruButton>
                }
            />

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span>Recommendations refreshed from the last 7 days of insights.</span>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <ZoruSkeleton key={i} className="h-24" />)}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ZoruCard>
                            <ZoruCardContent className="p-4">
                                <div className="text-sm text-muted-foreground">Increase budget</div>
                                <div className="text-3xl font-bold text-green-600">{countByType('increase')}</div>
                            </ZoruCardContent>
                        </ZoruCard>
                        <ZoruCard>
                            <ZoruCardContent className="p-4">
                                <div className="text-sm text-muted-foreground">Decrease budget</div>
                                <div className="text-3xl font-bold text-amber-600">{countByType('decrease')}</div>
                            </ZoruCardContent>
                        </ZoruCard>
                        <ZoruCard>
                            <ZoruCardContent className="p-4">
                                <div className="text-sm text-muted-foreground">Pause</div>
                                <div className="text-3xl font-bold text-red-600">{countByType('pause')}</div>
                            </ZoruCardContent>
                        </ZoruCard>
                    </div>

                    {recs.length === 0 ? (
                        <ZoruCard><ZoruCardContent className="p-8 text-center text-muted-foreground">No active campaigns with insights found.</ZoruCardContent></ZoruCard>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recs.map((r) => {
                                const style = recStyles[r.recommendation] || recStyles.maintain;
                                const Icon = style.icon;
                                return (
                                    <ZoruCard key={r.campaignId}>
                                        <ZoruCardHeader className="pb-2">
                                            <ZoruCardTitle className="text-sm font-medium flex items-center justify-between">
                                                <span className="truncate mr-2">{r.campaignName}</span>
                                                <ZoruBadge variant={style.variant} className="capitalize shrink-0">
                                                    <Icon className="h-3 w-3 mr-1" />{r.recommendation}
                                                </ZoruBadge>
                                            </ZoruCardTitle>
                                        </ZoruCardHeader>
                                        <ZoruCardContent className="space-y-2 text-sm">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                                                <span>Spend</span><span className="text-foreground tabular-nums">${r.spend.toFixed(2)}</span>
                                                <span>Clicks</span><span className="text-foreground tabular-nums">{r.clicks}</span>
                                                <span>CPC</span><span className="text-foreground tabular-nums">${r.cpc.toFixed(2)}</span>
                                                <span>CTR</span><span className="text-foreground tabular-nums">{r.ctr.toFixed(2)}%</span>
                                                <span>Daily budget</span><span className="text-foreground tabular-nums">${r.dailyBudget.toFixed(2)}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground italic">{r.reason}</p>
                                            <ZoruButton
                                                size="sm"
                                                className="w-full mt-1"
                                                onClick={() => toast({ title: 'Acknowledged', description: `Recommendation for "${r.campaignName}" noted.` })}
                                            >
                                                Apply
                                            </ZoruButton>
                                        </ZoruCardContent>
                                    </ZoruCard>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
