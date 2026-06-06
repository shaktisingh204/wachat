'use client';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  EmptyState,
  SegmentedControl,
  Dialog,
  DialogContent,
  DialogTrigger,
  useToast } from '@/components/sabcrm/20ui';
import {
  Image as ImageIcon,
  RefreshCw,
  ExternalLink } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader, AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useAdManager } from '@/context/ad-manager-context';
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

type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED';

const FILTER_ITEMS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
    { value: 'ALL', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PAUSED', label: 'Paused' },
];

export default function AdPreviewsPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [ads, setAds] = React.useState<Ad[]>([]);
    const [filter, setFilter] = React.useState<StatusFilter>('ALL');

    const fetchData = React.useCallback(async () => {
        if (!activeAccount) return;
        setLoading(true);
        const actId = activeAccount.id;
        const res = await getAdPreviews(actId);
        if (res.error) {
            toast.error({ title: 'Error', description: res.error });
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
                    <Button
                        variant="outline"
                        onClick={fetchData}
                        loading={loading}
                        iconLeft={RefreshCw}
                    >
                        Refresh
                    </Button>
                }
            />

            <SegmentedControl
                aria-label="Filter ads by status"
                items={FILTER_ITEMS}
                value={filter}
                onChange={setFilter}
                size="sm"
            />

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={256} />)}
                </div>
            ) : filtered.length === 0 ? (
                <Card padding="none">
                    <CardBody>
                        <EmptyState
                            icon={ImageIcon}
                            title="No ads found"
                            description="No ad creatives match this filter yet."
                        />
                    </CardBody>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((ad) => {
                        const img = ad.creative?.thumbnail_url || ad.creative?.image_url;
                        const fbUrl = `https://www.facebook.com/ads/manager/creation/edit/?act=${activeAccount.account_id}&selected_adset_id=&selected_campaign_id=&selected_ad_id=${ad.id}`;
                        return (
                            <Card key={ad.id} padding="none" className="overflow-hidden">
                                {img ? (
                                    <Dialog>
                                        <DialogTrigger
                                            aria-label={`Enlarge preview for ${ad.name}`}
                                            className="block h-40 w-full bg-[var(--st-bg-secondary)] overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={img} alt={ad.name} className="w-full h-full object-cover" />
                                        </DialogTrigger>
                                        <DialogContent className="w-[90vw] max-w-6xl h-[90vh] p-2 flex flex-col justify-center items-center">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={img} alt={ad.name} className="w-full h-full object-contain" />
                                        </DialogContent>
                                    </Dialog>
                                ) : (
                                    <div className="h-40 bg-[var(--st-bg-secondary)] flex items-center justify-center text-[var(--st-text-secondary)]">
                                        <ImageIcon className="h-10 w-10" aria-hidden="true" />
                                    </div>
                                )}
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                                        <span className="truncate">{ad.name}</span>
                                        <Badge tone={ad.status === 'ACTIVE' ? 'success' : 'neutral'}>
                                            {ad.status}
                                        </Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardBody className="space-y-2 text-sm">
                                    {ad.creative?.title && <p className="font-medium text-[var(--st-text)]">{ad.creative.title}</p>}
                                    {ad.creative?.body && (
                                        <p className="text-[var(--st-text-secondary)] text-xs line-clamp-3">{ad.creative.body}</p>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        iconRight={ExternalLink}
                                        onClick={() => window.open(fbUrl, '_blank', 'noopener,noreferrer')}
                                    >
                                        View on Facebook
                                    </Button>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
