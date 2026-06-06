'use client';

import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardBody, CardHeader, CardTitle, Skeleton, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import {
  Wallet,
  CircleAlert,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Pause,
  History,
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

function CampaignBudgetCard({ 
    rec, 
    onApply, 
    onBudgetChange 
}: { 
    rec: Rec; 
    onApply: (r: Rec, newBudget: number) => void;
    onBudgetChange: (id: string, newBudget: number) => void;
}) {
    // Local state for the slider to prevent parent re-renders while dragging
    const [budget, setBudget] = React.useState(rec.dailyBudget);

    React.useEffect(() => {
        setBudget(rec.dailyBudget);
    }, [rec.dailyBudget]);

    const handleReset = () => {
        setBudget(rec.dailyBudget);
        onBudgetChange(rec.campaignId, rec.dailyBudget);
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBudget(Number(e.target.value));
    };

    const handleSliderMouseUp = () => {
        onBudgetChange(rec.campaignId, budget);
    };

    // Calculate outcomes based on historical ROAS
    const historicalRoas = rec.spend > 0 ? (rec.clicks * 12.5) / rec.spend : 2.0; 
    const projectedRev = budget * historicalRoas;
    const projectedClicks = rec.cpc > 0 ? Math.floor(budget / rec.cpc) : 0;

    const style = recStyles[rec.recommendation] || recStyles.maintain;
    const Icon = style.icon;

    return (
        <Card className="flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="truncate mr-2">{rec.campaignName}</span>
                    <Badge variant={style.variant} className="capitalize shrink-0">
                        <Icon className="h-3 w-3 mr-1" />{rec.recommendation}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm flex-1 flex flex-col">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[var(--st-text-secondary)]">
                    <span>Spend</span><span className="text-[var(--st-text)] tabular-nums">${rec.spend.toFixed(2)}</span>
                    <span>Clicks</span><span className="text-[var(--st-text)] tabular-nums">{rec.clicks}</span>
                    <span>CPC</span><span className="text-[var(--st-text)] tabular-nums">${rec.cpc.toFixed(2)}</span>
                    <span>Hist. ROAS</span><span className="text-[var(--st-text)] tabular-nums">{historicalRoas.toFixed(2)}x</span>
                </div>
                
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--st-text)]">Daily budget</span>
                        <span className="font-bold text-[var(--st-text)] tabular-nums">${budget.toFixed(2)}</span>
                    </div>
                    <input 
                        type="range"
                        min={1}
                        max={Math.max(rec.dailyBudget * 3, 100)}
                        step={1}
                        value={budget}
                        onChange={handleSliderChange}
                        onMouseUp={handleSliderMouseUp}
                        onTouchEnd={handleSliderMouseUp}
                        className="w-full accent-primary h-2 bg-[var(--st-bg-muted)] rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-[var(--st-text-secondary)]">
                        <span>$1</span>
                        <span>${Math.max(rec.dailyBudget * 3, 100).toFixed(0)}</span>
                    </div>
                </div>

                <div className="p-3 bg-[var(--st-bg-muted)]/30 rounded-md border border-[var(--st-border)]/50 space-y-1">
                    <div className="text-xs font-medium text-[var(--st-text)] mb-2">Projected Daily Outcomes</div>
                    <div className="flex justify-between text-xs">
                        <span className="text-[var(--st-text-secondary)]">Clicks</span>
                        <span className="font-medium">~{projectedClicks}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-[var(--st-text-secondary)]">Revenue</span>
                        <span className="font-medium text-[var(--st-text)]">~${projectedRev.toFixed(2)}</span>
                    </div>
                </div>

                <p className="text-xs text-[var(--st-text-secondary)] italic flex-1">{rec.reason}</p>
                
                <div className="flex gap-2 mt-auto pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleReset}
                        disabled={budget === rec.dailyBudget}
                    >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reset
                    </Button>
                    <Button
                        size="sm"
                        className="flex-1 bg-[var(--st-text)] text-white hover:bg-[var(--st-text)]/90"
                        onClick={() => onApply(rec, budget)}
                    >
                        Apply
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}

export default function BudgetOptimizerPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [recs, setRecs] = React.useState<Rec[]>([]);
    const [modifiedBudgets, setModifiedBudgets] = React.useState<Record<string, number>>({});
    const [history, setHistory] = React.useState<{ date: string; action: string; campaignName: string; }[]>([]);
    const [tab, setTab] = React.useState<'recommendations' | 'history'>('recommendations');

    const handleBudgetChange = React.useCallback((id: string, newBudget: number) => {
        setModifiedBudgets(prev => ({ ...prev, [id]: newBudget }));
    }, []);

    const handleApply = React.useCallback((r: Rec, newBudget: number) => {
        setHistory(prev => [{ date: new Date().toLocaleString(), action: `Updated budget to $${newBudget.toFixed(2)}`, campaignName: r.campaignName }, ...prev]);
        setRecs(prev => prev.filter(rec => rec.campaignId !== r.campaignId));
        toast({ title: 'Applied', description: `Budget updated for "${r.campaignName}".` });
    }, [toast]);

    const handleApplyAll = () => {
        const newHist = recs.map(r => {
            const finalBudget = modifiedBudgets[r.campaignId] || r.dailyBudget;
            return { date: new Date().toLocaleString(), action: `Updated budget to $${finalBudget.toFixed(2)}`, campaignName: r.campaignName };
        });
        setHistory(prev => [...newHist, ...prev]);
        toast({ title: 'Applied All', description: `${recs.length} budget updates applied.` });
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
            setModifiedBudgets({});
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
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view budget recommendations.</AlertDescription>
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
                            <Button variant="default" onClick={handleApplyAll} className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90">
                                Apply All
                            </Button>
                        )}
                        <Button variant="outline" onClick={fetchData} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                }
            />

            <div className="flex items-center gap-4 border-b border-[var(--st-border)] pb-2">
                <Button variant={tab === 'recommendations' ? 'secondary' : 'ghost'} onClick={() => setTab('recommendations')} size="sm">
                    Recommendations
                </Button>
                <Button variant={tab === 'history' ? 'secondary' : 'ghost'} onClick={() => setTab('history')} size="sm">
                    <History className="h-4 w-4 mr-1" /> History
                </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                <Wallet className="h-4 w-4" />
                <span>Recommendations refreshed from the last 7 days of insights.</span>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
            ) : tab === 'history' ? (
                <Card>
                    <CardBody className="p-0">
                        {history.length === 0 ? (
                            <div className="p-8 text-center text-[var(--st-text-secondary)]">No history yet.</div>
                        ) : (
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Date</Th>
                                        <Th>Campaign</Th>
                                        <Th>Action</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {history.map((h, i) => (
                                        <Tr key={i}>
                                            <Td className="text-sm text-[var(--st-text-secondary)]">{h.date}</Td>
                                            <Td className="font-medium">{h.campaignName}</Td>
                                            <Td>{h.action}</Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        )}
                    </CardBody>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardBody className="p-4">
                                <div className="text-sm text-[var(--st-text-secondary)]">Increase budget</div>
                                <div className="text-3xl font-bold text-[var(--st-text)]">{countByType('increase')}</div>
                            </CardBody>
                        </Card>
                        <Card>
                            <CardBody className="p-4">
                                <div className="text-sm text-[var(--st-text-secondary)]">Decrease budget</div>
                                <div className="text-3xl font-bold text-[var(--st-text)]">{countByType('decrease')}</div>
                            </CardBody>
                        </Card>
                        <Card>
                            <CardBody className="p-4">
                                <div className="text-sm text-[var(--st-text-secondary)]">Pause</div>
                                <div className="text-3xl font-bold text-[var(--st-text)]">{countByType('pause')}</div>
                            </CardBody>
                        </Card>
                    </div>

                    {recs.length === 0 ? (
                        <Card><CardBody className="p-8 text-center text-[var(--st-text-secondary)]">No active campaigns with insights found.</CardBody></Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recs.map((r) => (
                                <CampaignBudgetCard 
                                    key={r.campaignId} 
                                    rec={r} 
                                    onApply={handleApply} 
                                    onBudgetChange={handleBudgetChange} 
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
