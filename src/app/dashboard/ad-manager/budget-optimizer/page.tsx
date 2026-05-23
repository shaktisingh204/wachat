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
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Wallet,
  CircleAlert,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Pause,
  History,
  CheckAll,
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
    const [history, setHistory] = React.useState<{ date: string; action: string; campaignName: string; }[]>([]);
    const [tab, setTab] = React.useState<'recommendations' | 'history'>('recommendations');

    const handleApply = (r: Rec) => {
        setHistory(prev => [{ date: new Date().toLocaleString(), action: `Applied ${r.recommendation} budget`, campaignName: r.campaignName }, ...prev]);
        setRecs(prev => prev.filter(rec => rec.campaignId !== r.campaignId));
        toast({ title: 'Applied', description: `Recommendation for "${r.campaignName}" applied.` });
    };

    const handleApplyAll = () => {
        const newHist = recs.map(r => ({ date: new Date().toLocaleString(), action: `Applied ${r.recommendation} budget`, campaignName: r.campaignName }));
        setHistory(prev => [...newHist, ...prev]);
        toast({ title: 'Applied All', description: `${recs.length} recommendations applied.` });
        setRecs([]);
    };

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
                <Alert>
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription>Pick an ad account to view budget recommendations.</ZoruAlertDescription>
                </Alert>
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
                    <div className="flex items-center gap-2">
                        {tab === 'recommendations' && recs.length > 0 && (
                            <Button variant="default" onClick={handleApplyAll} className="bg-[#1877F2] hover:bg-[#1877F2]/90">
                                Apply All
                            </Button>
                        )}
                        <Button variant="outline" onClick={fetchData} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                }
            />

            <div className="flex items-center gap-4 border-b border-border pb-2">
                <Button variant={tab === 'recommendations' ? 'secondary' : 'ghost'} onClick={() => setTab('recommendations')} size="sm">
                    Recommendations
                </Button>
                <Button variant={tab === 'history' ? 'secondary' : 'ghost'} onClick={() => setTab('history')} size="sm">
                    <History className="h-4 w-4 mr-1" /> History
                </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span>Recommendations refreshed from the last 7 days of insights.</span>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
            ) : tab === 'history' ? (
                <Card>
                    <ZoruCardContent className="p-0">
                        {history.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">No history yet.</div>
                        ) : (
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow>
                                        <ZoruTableHead>Date</ZoruTableHead>
                                        <ZoruTableHead>Campaign</ZoruTableHead>
                                        <ZoruTableHead>Action</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {history.map((h, i) => (
                                        <ZoruTableRow key={i}>
                                            <ZoruTableCell className="text-sm text-muted-foreground">{h.date}</ZoruTableCell>
                                            <ZoruTableCell className="font-medium">{h.campaignName}</ZoruTableCell>
                                            <ZoruTableCell>{h.action}</ZoruTableCell>
                                        </ZoruTableRow>
                                    ))}
                                </ZoruTableBody>
                            </Table>
                        )}
                    </ZoruCardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <ZoruCardContent className="p-4">
                                <div className="text-sm text-muted-foreground">Increase budget</div>
                                <div className="text-3xl font-bold text-green-600">{countByType('increase')}</div>
                            </ZoruCardContent>
                        </Card>
                        <Card>
                            <ZoruCardContent className="p-4">
                                <div className="text-sm text-muted-foreground">Decrease budget</div>
                                <div className="text-3xl font-bold text-amber-600">{countByType('decrease')}</div>
                            </ZoruCardContent>
                        </Card>
                        <Card>
                            <ZoruCardContent className="p-4">
                                <div className="text-sm text-muted-foreground">Pause</div>
                                <div className="text-3xl font-bold text-red-600">{countByType('pause')}</div>
                            </ZoruCardContent>
                        </Card>
                    </div>

                    {recs.length === 0 ? (
                        <Card><ZoruCardContent className="p-8 text-center text-muted-foreground">No active campaigns with insights found.</ZoruCardContent></Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recs.map((r) => {
                                const style = recStyles[r.recommendation] || recStyles.maintain;
                                const Icon = style.icon;
                                return (
                                    <Card key={r.campaignId}>
                                        <ZoruCardHeader className="pb-2">
                                            <ZoruCardTitle className="text-sm font-medium flex items-center justify-between">
                                                <span className="truncate mr-2">{r.campaignName}</span>
                                                <Badge variant={style.variant} className="capitalize shrink-0">
                                                    <Icon className="h-3 w-3 mr-1" />{r.recommendation}
                                                </Badge>
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
                                            <Button
                                                size="sm"
                                                className="w-full mt-1"
                                                onClick={() => handleApply(r)}
                                            >
                                                Apply
                                            </Button>
                                        </ZoruCardContent>
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
