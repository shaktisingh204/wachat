'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Badge, Skeleton } from '@/components/zoruui';
import {
  Image as ImageIcon,
  CircleAlert,
  RefreshCw,
  ExternalLink } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader, AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
import { useToast } from '@/hooks/use-toast';
import { getAdPreviews } from '@/app/actions/ad-manager-features.actions';

type Ad = {
    id: string;
    name: string;
    status: string;
    creative?: {
        id: string;
        name?: string;
        thumbnail_url?: string;
        image_url?: string;
        title?: string;
        body?: string;
    };
};

export default function AdPreviewsPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [ads, setAds] = React.useState<Ad[]>([]);
    const [filter, setFilter] = React.useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');

    const fetchData = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const actId = `act_${activeAccount.account_id.replace(/^act_/, '')}`;
        const res = await getAdPreviews(actId);
        if (res.error) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
            setAds([]);
        } else {
            setAds(res.ads || []);
        }
        setLoading(false);
    }, [activeAccount, toast]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = filter === 'ALL' ? ads : ads.filter((a) => a.status === filter);

    if (!activeAccount) {
        return (
            <div className="space-y-4">
                <AmBreadcrumb page="Ad previews" />
                <AmErrorAlert message="Pick an ad account to view ad previews." />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Ad previews" />
            <AmHeader
                title="Ad preview gallery"
                description="Browse your ad creatives and preview copy."
                actions={
                    <ZoruButton variant="outline" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
                    </ZoruButton>
                }
            />

            <div className="flex gap-2">
                {(['ALL', 'ACTIVE', 'PAUSED'] as const).map((s) => (
                    <ZoruButton
                        key={s}
                        variant={filter === s ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(s)}
                    >
                        {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                    </ZoruButton>
                ))}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <ZoruSkeleton key={i} className="h-64" />)}
                </div>
            ) : filtered.length === 0 ? (
                <ZoruCard><ZoruCardContent className="p-8 text-center text-muted-foreground">No ads found.</ZoruCardContent></ZoruCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((ad) => {
                        const img = ad.creative?.thumbnail_url || ad.creative?.image_url;
                        return (
                            <ZoruCard key={ad.id} className="overflow-hidden">
                                {img ? (
                                    <div className="h-40 bg-muted overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img} alt={ad.name} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="h-40 bg-muted flex items-center justify-center text-muted-foreground">
                                        <ImageIcon className="h-10 w-10" />
                                    </div>
                                )}
                                <ZoruCardHeader className="pb-2">
                                    <ZoruCardTitle className="text-sm font-medium flex items-center justify-between">
                                        <span className="truncate mr-2">{ad.name}</span>
                                        <ZoruBadge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                            {ad.status}
                                        </ZoruBadge>
                                    </ZoruCardTitle>
                                </ZoruCardHeader>
                                <ZoruCardContent className="space-y-1 text-sm">
                                    {ad.creative?.title && <p className="font-medium">{ad.creative.title}</p>}
                                    {ad.creative?.body && (
                                        <p className="text-muted-foreground text-xs line-clamp-3">{ad.creative.body}</p>
                                    )}
                                    <a
                                        href={`https://www.facebook.com/ads/manager/creation/edit/?act=${activeAccount.account_id}&selected_adset_id=&selected_campaign_id=&selected_ad_id=${ad.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                                    >
                                        View on Facebook <ExternalLink className="h-3 w-3" />
                                    </a>
                                </ZoruCardContent>
                            </ZoruCard>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
