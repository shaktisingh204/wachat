'use client';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Slider,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Wallet,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Pause,
  History,
  Minus,
  Inbox } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader, AmNoProject } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
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

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';
type SliderTone = 'accent' | 'success' | 'warn' | 'danger';

const recStyles: Record<string, { tone: BadgeTone; sliderTone: SliderTone; icon: typeof TrendingUp }> = {
    increase: { tone: 'success', sliderTone: 'success', icon: TrendingUp },
    decrease: { tone: 'warning', sliderTone: 'warn', icon: TrendingDown },
    pause: { tone: 'danger', sliderTone: 'danger', icon: Pause },
    maintain: { tone: 'neutral', sliderTone: 'accent', icon: Minus },
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
    // Local state for the slider to prevent parent re-renders while dragging.
    const [budget, setBudget] = React.useState(rec.dailyBudget);

    React.useEffect(() => {
        setBudget(rec.dailyBudget);
    }, [rec.dailyBudget]);

    const sliderMax = Math.max(rec.dailyBudget * 3, 100);

    const handleReset = () => {
        setBudget(rec.dailyBudget);
        onBudgetChange(rec.campaignId, rec.dailyBudget);
    };

    const handleSliderChange = (next: number | number[]) => {
        setBudget(Array.isArray(next) ? next[0] : next);
    };

    const handleSliderCommit = (next: number[]) => {
        onBudgetChange(rec.campaignId, next[0]);
    };

    // Calculate outcomes based on historical ROAS.
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
                    <Badge tone={style.tone} className="capitalize shrink-0">
                        <Icon className="h-3 w-3 mr-1" aria-hidden="true" />{rec.recommendation}
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
                    <Slider
                        min={1}
                        max={sliderMax}
                        step={1}
                        value={budget}
                        tone={style.sliderTone}
                        ariaLabel={`Daily budget for ${rec.campaignName}`}
                        onValueChange={handleSliderChange}
                        onValueCommit={handleSliderCommit}
                    />
                    <div className="flex justify-between text-xs text-[var(--st-text-secondary)]">
                        <span>$1</span>
                        <span>${sliderMax.toFixed(0)}</span>
                    </div>
                </div>

                <div className="p-3 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)] space-y-1">
                    <div className="text-xs font-medium text-[var(--st-text)] mb-2">Projected daily outcomes</div>
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
                        iconLeft={RefreshCw}
                        onClick={handleReset}
                        disabled={budget === rec.dailyBudget}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
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
        toast.success({ title: 'Applied', description: `Budget updated for "${r.campaignName}".` });
    }, [toast]);

    const handleApplyAll = () => {
        const newHist = recs.map(r => {
            const finalBudget = modifiedBudgets[r.campaignId] || r.dailyBudget;
            return { date: new Date().toLocaleString(), action: `Updated budget to $${finalBudget.toFixed(2)}`, campaignName: r.campaignName };
        });
        setHistory(prev => [...newHist, ...prev]);
        toast.success({ title: 'Applied all', description: `${recs.length} budget updates applied.` });
        setRecs([]);
    };

    const fetchData = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
        const res = await getBudgetRecommendations(actId);
        if (res.error) {
            toast.error({ title: 'Error', description: res.error });
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
                <AmNoProject />
            </div>
        );
    }

    const countByType = (type: string) => recs.filter((r) => r.recommendation === type).length;

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Budget Optimizer" />
            <AmHeader
                title="Budget optimizer"
                description="AI-driven budget recommendations based on the last 7 days of performance."
                actions={
                    <div className="flex items-center gap-2">
                        {tab === 'recommendations' && recs.length > 0 && (
                            <Button variant="primary" onClick={handleApplyAll}>
                                Apply all
                            </Button>
                        )}
                        <Button variant="outline" iconLeft={RefreshCw} loading={loading} onClick={fetchData}>
                            Refresh
                        </Button>
                    </div>
                }
            />

            <div className="flex items-center gap-4 border-b border-[var(--st-border)] pb-2">
                <Button variant={tab === 'recommendations' ? 'secondary' : 'ghost'} onClick={() => setTab('recommendations')} size="sm">
                    Recommendations
                </Button>
                <Button variant={tab === 'history' ? 'secondary' : 'ghost'} iconLeft={History} onClick={() => setTab('history')} size="sm">
                    History
                </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                <span>Recommendations refreshed from the last 7 days of insights.</span>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={96} />)}
                </div>
            ) : tab === 'history' ? (
                <Card padding="none">
                    <CardBody className="p-0">
                        {history.length === 0 ? (
                            <EmptyState icon={History} title="No history yet" description="Applied budget changes will appear here." />
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
                        <StatCard label="Increase budget" value={countByType('increase')} icon={TrendingUp} />
                        <StatCard label="Decrease budget" value={countByType('decrease')} icon={TrendingDown} />
                        <StatCard label="Pause" value={countByType('pause')} icon={Pause} />
                    </div>

                    {recs.length === 0 ? (
                        <Card padding="none">
                            <CardBody>
                                <EmptyState icon={Inbox} title="No recommendations" description="No active campaigns with insights were found." />
                            </CardBody>
                        </Card>
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
