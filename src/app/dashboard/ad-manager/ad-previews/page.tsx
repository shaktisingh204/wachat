'use client';

import * as React from 'react';
import { LuImage, LuAlertCircle, LuRefreshCw, LuExternalLink } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
            <div className="p-8">
                <Alert>
                    <LuAlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view ad previews.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LuImage className="h-6 w-6" /> Ad preview gallery
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Browse your ad creatives and preview copy.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                    <LuRefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            <div className="flex gap-2">
                {(['ALL', 'ACTIVE', 'PAUSED'] as const).map((s) => (
                    <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
                        {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                    </Button>
                ))}
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
                </div>
            ) : filtered.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No ads found.</CardContent></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((ad) => {
                        const img = ad.creative?.thumbnail_url || ad.creative?.image_url;
                        return (
                            <Card key={ad.id} className="overflow-hidden">
                                {img ? (
                                    <div className="h-40 bg-muted overflow-hidden">
                                        <img src={img} alt={ad.name} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="h-40 bg-muted flex items-center justify-center text-muted-foreground">
                                        <LuImage className="h-10 w-10" />
                                    </div>
                                )}
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                                        <span className="truncate mr-2">{ad.name}</span>
                                        <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                            {ad.status}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1 text-sm">
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
                                        View on Facebook <LuExternalLink className="h-3 w-3" />
                                    </a>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
