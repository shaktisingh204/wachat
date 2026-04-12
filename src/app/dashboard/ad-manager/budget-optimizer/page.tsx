'use client';

import * as React from 'react';
import { LuWallet, LuAlertCircle, LuRefreshCw, LuTrendingUp, LuTrendingDown, LuPause, LuMinus } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

const recStyles: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary'; icon: typeof LuTrendingUp }> = {
    increase: { variant: 'default', icon: LuTrendingUp },
    decrease: { variant: 'secondary', icon: LuTrendingDown },
    pause: { variant: 'destructive', icon: LuPause },
    maintain: { variant: 'outline', icon: LuMinus },
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
            <div className="p-8">
                <Alert>
                    <LuAlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view budget recommendations.</AlertDescription>
                </Alert>
            </div>
        );
    }

    const countByType = (type: string) => recs.filter((r) => r.recommendation === type).length;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LuWallet className="h-6 w-6" /> Budget optimizer
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        AI-driven budget recommendations based on last 7 days performance.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                    <LuRefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="text-sm text-muted-foreground">Increase budget</div>
                                <div className="text-3xl font-bold text-green-600">{countByType('increase')}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="text-sm text-muted-foreground">Decrease budget</div>
                                <div className="text-3xl font-bold text-amber-600">{countByType('decrease')}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="text-sm text-muted-foreground">Pause</div>
                                <div className="text-3xl font-bold text-red-600">{countByType('pause')}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {recs.length === 0 ? (
                        <Card><CardContent className="p-8 text-center text-muted-foreground">No active campaigns with insights found.</CardContent></Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recs.map((r) => {
                                const style = recStyles[r.recommendation] || recStyles.maintain;
                                const Icon = style.icon;
                                return (
                                    <Card key={r.campaignId}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                                                <span className="truncate mr-2">{r.campaignName}</span>
                                                <Badge variant={style.variant} className="capitalize shrink-0">
                                                    <Icon className="h-3 w-3 mr-1" />{r.recommendation}
                                                </Badge>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 text-sm">
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                                                <span>Spend</span><span className="text-foreground tabular-nums">${r.spend.toFixed(2)}</span>
                                                <span>Clicks</span><span className="text-foreground tabular-nums">{r.clicks}</span>
                                                <span>CPC</span><span className="text-foreground tabular-nums">${r.cpc.toFixed(2)}</span>
                                                <span>CTR</span><span className="text-foreground tabular-nums">{r.ctr.toFixed(2)}%</span>
                                                <span>Daily budget</span><span className="text-foreground tabular-nums">${r.dailyBudget.toFixed(2)}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground italic">{r.reason}</p>
                                            <Button
                                                size="sm"
                                                className="w-full mt-1"
                                                onClick={() => toast({ title: 'Acknowledged', description: `Recommendation for "${r.campaignName}" noted.` })}
                                            >
                                                Apply
                                            </Button>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
