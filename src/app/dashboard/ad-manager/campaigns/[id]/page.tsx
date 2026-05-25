'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Skeleton,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Switch,
  Badge,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Input,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition,
  use 
} from 'react';
import { 
  getAdSets,
  getInsights,
  updateAdSet,
  updateEntityStatus 
} from '@/app/actions/ad-manager.actions';

import { AlertCircle, ArrowLeft, Layers, ChevronRight, RefreshCw, Check, X, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AmBreadcrumb, AmHeader } from '../../_components/am-page-shell';

const insightsCache = new Map<string, { data: any[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-8 w-64" />
            <Card>
                <ZoruCardHeader><Skeleton className="h-6 w-1/3" /></ZoruCardHeader>
                <ZoruCardContent><Skeleton className="h-48 w-full" /></ZoruCardContent>
            </Card>
        </div>
    );
}

export default function AdSetsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: campaignId } = use(params);
    const [adSets, setAdSets] = useState<any[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const { toast } = useToast();
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Filters
    const [minRoas, setMinRoas] = useState<string>('');
    const [maxCpa, setMaxCpa] = useState<string>('');

    // Inline Editing
    const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
    const [editBudgetAmount, setEditBudgetAmount] = useState<string>('');
    const [isSavingBudget, setIsSavingBudget] = useState(false);

    useEffect(() => {
        startLoadingTransition(async () => {
            setError(null);
            const [adSetsResult, insightsResult] = await Promise.all([
                getAdSets(campaignId),
                (async () => {
                    const cacheKey = `insights_${campaignId}`;
                    const cached = insightsCache.get(cacheKey);
                    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                        return { data: cached.data };
                    }
                    const res = await getInsights(campaignId, { level: 'adset', date_preset: 'maximum' });
                    if (!res.error && res.data) {
                        insightsCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
                    }
                    return res;
                })()
            ]);

            if (adSetsResult.error) {
                setError(adSetsResult.error);
                return;
            }

            const rawAdSets = adSetsResult.adSets || [];
            const insightsData = insightsResult.data || [];

            const merged = rawAdSets.map(adSet => {
                const insight = insightsData.find(i => i.adset_id === adSet.id);
                return { ...adSet, insights: insight || adSet.insights || {} };
            });

            setAdSets(merged);
        });
    }, [campaignId, refreshKey]);

    const handleStatusToggle = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        setAdSets(prev => prev.map(item =>
            item.id === id ? { ...item, status: newStatus } : item
        ));

        const result = await updateEntityStatus(id, 'adset', newStatus);

        if (result.success) {
            toast({ title: "Status Updated", description: `Ad Set is now ${newStatus.toLowerCase()}.` });
        } else {
            setAdSets(prev => prev.map(item =>
                item.id === id ? { ...item, status: currentStatus as any } : item
            ));
            toast({ title: "Update Failed", description: result.error, variant: "destructive" });
        }
    };

    const handleSaveBudget = async (id: string) => {
        const amount = Number(editBudgetAmount);
        if (isNaN(amount) || amount <= 0) {
            toast({ title: "Invalid Amount", description: "Please enter a valid budget amount.", variant: "destructive" });
            return;
        }

        setIsSavingBudget(true);
        const previousAdSets = [...adSets];
        const newDailyBudget = (amount * 100).toString();
        
        setAdSets(prev => prev.map(item =>
            item.id === id ? { ...item, daily_budget: newDailyBudget } : item
        ));
        setEditingBudgetId(null);

        const result = await updateAdSet(id, { daily_budget: newDailyBudget });

        if (result.error) {
            setAdSets(previousAdSets);
            toast({ title: "Update Failed", description: result.error, variant: "destructive" });
        } else {
            toast({ title: "Budget Updated", description: `Ad Set budget has been updated to ₹${amount}.` });
        }
        setIsSavingBudget(false);
    };

    const getCpa = (insights: any) => {
        const spend = Number(insights?.spend || 0);
        const clicks = Number(insights?.clicks || 0);
        return clicks > 0 ? (spend / clicks) : 0;
    };

    const getRoas = (insights: any) => {
        const roasArr = insights?.purchase_roas || [];
        return roasArr.length > 0 ? Number(roasArr[0].value) : 0;
    };

    const filteredAdSets = adSets.filter(adSet => {
        let pass = true;
        const roasVal = getRoas(adSet.insights);
        const cpaVal = getCpa(adSet.insights);

        if (minRoas && !isNaN(Number(minRoas))) {
            if (roasVal < Number(minRoas)) pass = false;
        }
        if (maxCpa && !isNaN(Number(maxCpa))) {
            if (cpaVal > Number(maxCpa)) pass = false;
        }
        return pass;
    });

    if (isLoading) return <PageSkeleton />;

    return (
        <div className="flex flex-col gap-6">
            <AmBreadcrumb
                page={`Campaign ${campaignId}`}
                parent={{ label: "Campaigns", href: "/dashboard/ad-manager/campaigns" }}
            />

            <AmHeader
                title="Ad Sets"
                description={`Campaign ID: ${campaignId}`}
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/dashboard/ad-manager/campaigns">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => {
                            insightsCache.delete(`insights_${campaignId}`);
                            setRefreshKey((k) => k + 1);
                        }}>
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                }
            />

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>Error fetching Ad Sets</ZoruAlertTitle>
                    <ZoruAlertDescription>{error}</ZoruAlertDescription>
                </Alert>
            )}

            <Card>
                <ZoruCardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <ZoruCardTitle className="flex items-center gap-2">
                                <Layers className="h-5 w-5" /> Ad Sets
                            </ZoruCardTitle>
                            <ZoruCardDescription>Manage the ad sets within this campaign.</ZoruCardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Min ROAS"
                                value={minRoas}
                                onChange={(e) => setMinRoas(e.target.value)}
                                className="w-32"
                                type="number"
                                min="0"
                                step="0.1"
                            />
                            <Input
                                placeholder="Max CPA (₹)"
                                value={maxCpa}
                                onChange={(e) => setMaxCpa(e.target.value)}
                                className="w-32"
                                type="number"
                                min="0"
                                step="0.1"
                            />
                        </div>
                    </div>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="border rounded-md">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead>Ad Set Name</ZoruTableHead>
                                    <ZoruTableHead>Budget</ZoruTableHead>
                                    <ZoruTableHead>ROAS</ZoruTableHead>
                                    <ZoruTableHead>Optimization</ZoruTableHead>
                                    <ZoruTableHead>Results</ZoruTableHead>
                                    <ZoruTableHead>Cost/Result</ZoruTableHead>
                                    <ZoruTableHead></ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {filteredAdSets.length > 0 ? (
                                    filteredAdSets.map((adSet) => (
                                        <ZoruTableRow key={adSet.id}>
                                            <ZoruTableCell>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={adSet.status === 'ACTIVE'}
                                                        onCheckedChange={() => handleStatusToggle(adSet.id, adSet.status)}
                                                    />
                                                    <span className="text-xs text-muted-foreground">{adSet.status}</span>
                                                </div>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="font-medium">
                                                <Link href={`/dashboard/ad-manager/ad-sets/${adSet.id}`} className="hover:underline">
                                                    {adSet.name}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                {editingBudgetId === adSet.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-sm text-muted-foreground">₹</span>
                                                        <Input
                                                            value={editBudgetAmount}
                                                            onChange={(e) => setEditBudgetAmount(e.target.value)}
                                                            className="h-8 w-24 px-2"
                                                            autoFocus
                                                            type="number"
                                                            min="1"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveBudget(adSet.id);
                                                                if (e.key === 'Escape') setEditingBudgetId(null);
                                                            }}
                                                            disabled={isSavingBudget}
                                                        />
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-green-600"
                                                            onClick={() => handleSaveBudget(adSet.id)}
                                                            disabled={isSavingBudget}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-red-600"
                                                            onClick={() => setEditingBudgetId(null)}
                                                            disabled={isSavingBudget}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => {
                                                        setEditingBudgetId(adSet.id);
                                                        setEditBudgetAmount((Number(adSet.daily_budget || 0) / 100).toString());
                                                    }}>
                                                        <span>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(adSet.daily_budget) / 100)} Daily</span>
                                                        <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                {getRoas(adSet.insights) > 0 ? `${getRoas(adSet.insights).toFixed(2)}x` : '-'}
                                            </ZoruTableCell>
                                            <ZoruTableCell><Badge variant="outline">{adSet.optimization_goal}</Badge></ZoruTableCell>
                                            <ZoruTableCell>{adSet.insights?.clicks || 0} Clicks</ZoruTableCell>
                                            <ZoruTableCell>
                                                {adSet.insights?.clicks > 0
                                                    ? `₹${getCpa(adSet.insights).toFixed(2)}`
                                                    : '-'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/ad-manager/ad-sets/${adSet.id}`}>
                                                        Ads <ChevronRight className="ml-1 h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={8} className="h-24 text-center">No ad sets found matching the criteria.</ZoruTableCell>
                                    </ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
