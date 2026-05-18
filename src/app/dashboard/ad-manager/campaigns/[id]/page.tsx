'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruSkeleton,
  ZoruAlert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  ZoruSwitch,
  ZoruBadge,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition,
  use } from 'react';
import { getAdSets,
  updateEntityStatus } from '@/app/actions/ad-manager.actions';

import { AlertCircle, ArrowLeft, Layers, ChevronRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AmBreadcrumb, AmHeader } from '../../_components/am-page-shell';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <ZoruSkeleton className="h-8 w-64" />
            <ZoruCard>
                <ZoruCardHeader><ZoruSkeleton className="h-6 w-1/3" /></ZoruCardHeader>
                <ZoruCardContent><ZoruSkeleton className="h-48 w-full" /></ZoruCardContent>
            </ZoruCard>
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

    useEffect(() => {
        startLoadingTransition(async () => {
            const result = await getAdSets(campaignId);
            if (result.error) setError(result.error);
            setAdSets(result.adSets || []);
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
                        <ZoruButton variant="ghost" size="icon" asChild>
                            <Link href="/dashboard/ad-manager/campaigns">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </ZoruButton>
                        <ZoruButton variant="outline" size="icon" onClick={() => setRefreshKey((k) => k + 1)}>
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </ZoruButton>
                    </div>
                }
            />

            {error && (
                <ZoruAlert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <ZoruAlertTitle>Error fetching Ad Sets</ZoruAlertTitle>
                    <ZoruAlertDescription>{error}</ZoruAlertDescription>
                </ZoruAlert>
            )}

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" /> Ad Sets
                    </ZoruCardTitle>
                    <ZoruCardDescription>Manage the ad sets within this campaign.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="border rounded-md">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead>Ad Set Name</ZoruTableHead>
                                    <ZoruTableHead>Budget</ZoruTableHead>
                                    <ZoruTableHead>Optimization</ZoruTableHead>
                                    <ZoruTableHead>Results</ZoruTableHead>
                                    <ZoruTableHead>Cost/Result</ZoruTableHead>
                                    <ZoruTableHead></ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {adSets.length > 0 ? (
                                    adSets.map((adSet) => (
                                        <ZoruTableRow key={adSet.id}>
                                            <ZoruTableCell>
                                                <div className="flex items-center gap-2">
                                                    <ZoruSwitch
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
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(adSet.daily_budget) / 100)} Daily
                                            </ZoruTableCell>
                                            <ZoruTableCell><ZoruBadge variant="outline">{adSet.optimization_goal}</ZoruBadge></ZoruTableCell>
                                            <ZoruTableCell>{adSet.insights?.clicks || 0} Clicks</ZoruTableCell>
                                            <ZoruTableCell>
                                                {adSet.insights?.clicks > 0
                                                    ? `$${(Number(adSet.insights.spend) / Number(adSet.insights.clicks)).toFixed(2)}`
                                                    : '-'}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruButton variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/ad-manager/ad-sets/${adSet.id}`}>
                                                        Ads <ChevronRight className="ml-1 h-4 w-4" />
                                                    </Link>
                                                </ZoruButton>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={7} className="h-24 text-center">No ad sets found.</ZoruTableCell>
                                    </ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
