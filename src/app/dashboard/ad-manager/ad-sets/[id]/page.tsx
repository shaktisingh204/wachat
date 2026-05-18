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
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruSwitch,
  ZoruBadge,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition,
  use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft,
  Image as ImageIcon,
  CircleAlert,
  RefreshCw,
  EllipsisVertical,
  Pause,
  Play,
  Copy,
  Trash2 } from 'lucide-react';
import { getAds,
  updateEntityStatus,
  duplicateAd,
  deleteAd } from '@/app/actions/ad-manager.actions';

import { useToast } from '@/hooks/use-toast';
import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <ZoruSkeleton className="h-8 w-64" />
            <div className="grid md:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <ZoruSkeleton key={i} className="h-64 w-full" />)}
            </div>
        </div>
    );
}

export default function AdsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: adSetId } = use(params);
    const router = useRouter();
    const [ads, setAds] = useState<any[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const { toast } = useToast();
    const [error, setError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const fetchAds = () => {
        startLoadingTransition(async () => {
            const result = await getAds(adSetId);
            if (result.error) setError(result.error);
            else setError(null);
            setAds(result.ads || []);
        });
    };

    useEffect(() => { fetchAds(); }, [adSetId]);

    const handleStatusToggle = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        setAds(prev => prev.map(item =>
            item.id === id ? { ...item, status: newStatus } : item
        ));

        const result = await updateEntityStatus(id, 'ad', newStatus);

        if (result.success) {
            toast({ title: 'Status Updated', description: `Ad is now ${newStatus.toLowerCase()}.` });
        } else {
            setAds(prev => prev.map(item =>
                item.id === id ? { ...item, status: currentStatus as any } : item
            ));
            toast({ title: 'Update Failed', description: result.error, variant: 'destructive' });
        }
    };

    const handleDuplicate = async (id: string) => {
        const result = await duplicateAd(id);
        if (result.error) {
            toast({ title: 'Duplicate Failed', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Duplicated', description: 'Ad duplicated successfully.' });
            fetchAds();
        }
    };

    const handleDelete = async (id: string) => {
        const result = await deleteAd(id);
        if (result.error) {
            toast({ title: 'Delete Failed', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Deleted', description: 'Ad deleted.' });
            setAds(prev => prev.filter(a => a.id !== id));
        }
        setDeleteId(null);
    };

    if (isLoading) return <PageSkeleton />;

    return (
        <div className="flex flex-col gap-6">
            <AmBreadcrumb page="Ads" parent={{ label: "Ad Sets", href: "/dashboard/ad-manager/ad-sets" }} />

            <AmHeader
                title="Ads"
                description={`Ad Set ID: ${adSetId}`}
                actions={
                    <div className="flex items-center gap-2">
                        <ZoruButton variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
                            <ArrowLeft className="h-4 w-4" />
                        </ZoruButton>
                        <ZoruButton variant="outline" size="icon" onClick={fetchAds} disabled={isLoading} aria-label="Refresh">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </ZoruButton>
                    </div>
                }
            />

            {error && (
                <ZoruAlert variant="destructive">
                    <CircleAlert className="h-4 w-4" />
                    <ZoruAlertTitle>Error fetching Ads</ZoruAlertTitle>
                    <ZoruAlertDescription>{error}</ZoruAlertDescription>
                </ZoruAlert>
            )}

            {ads.length === 0 ? (
                <ZoruCard className="border-dashed border-2 py-12">
                    <div className="flex flex-col items-center justify-center text-center gap-4">
                        <div className="bg-primary/10 p-4 rounded-full">
                            <ImageIcon className="h-12 w-12 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold">No Ads Found</h3>
                            <p className="text-muted-foreground mt-1">This ad set currently has no ads.</p>
                        </div>
                    </div>
                </ZoruCard>
            ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {ads.map((ad) => (
                        <ZoruCard key={ad.id} className="overflow-hidden">
                            <div className="aspect-video relative bg-gray-100 flex items-center justify-center overflow-hidden">
                                {ad.imageUrl ? (
                                    <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="h-12 w-12 text-gray-300" />
                                )}
                                <div className="absolute top-2 right-2">
                                    <ZoruBadge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'}>{ad.status}</ZoruBadge>
                                </div>
                            </div>
                            <ZoruCardHeader className="p-4">
                                <div className="flex justify-between items-start gap-2">
                                    <ZoruCardTitle className="text-base truncate" title={ad.name}>{ad.name}</ZoruCardTitle>
                                    <div className="flex items-center gap-1">
                                        <ZoruSwitch
                                            className="scale-75"
                                            checked={ad.status === 'ACTIVE'}
                                            onCheckedChange={() => handleStatusToggle(ad.id, ad.status)}
                                        />
                                        <ZoruDropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <ZoruButton variant="ghost" size="icon" className="h-8 w-8">
                                                    <EllipsisVertical className="h-4 w-4" />
                                                </ZoruButton>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem onClick={() => handleStatusToggle(ad.id, ad.status)}>
                                                    {ad.status === 'ACTIVE' ? (
                                                        <><Pause className="h-4 w-4 mr-2" /> Pause</>
                                                    ) : (
                                                        <><Play className="h-4 w-4 mr-2" /> Resume</>
                                                    )}
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem onClick={() => handleDuplicate(ad.id)}>
                                                    <Copy className="h-4 w-4 mr-2" /> Duplicate
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setDeleteId(ad.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                </ZoruDropdownMenuItem>
                                            </ZoruDropdownMenuContent>
                                        </ZoruDropdownMenu>
                                    </div>
                                </div>
                                <ZoruCardDescription className="text-xs">ID: {ad.id}</ZoruCardDescription>
                            </ZoruCardHeader>
                            <ZoruCardContent className="p-4 pt-0 text-sm grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-muted-foreground block text-xs">Impressions</span>
                                    <span className="font-medium">{ad.insights?.impressions || 0}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">Clicks</span>
                                    <span className="font-medium">{ad.insights?.clicks || 0}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">Spend</span>
                                    <span className="font-medium">${ad.insights?.spend || 0}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">CTR</span>
                                    <span className="font-medium">{ad.insights?.ctr ? Number(ad.insights.ctr).toFixed(2) : 0}%</span>
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>
                    ))}
                </div>
            )}

            {/* Delete confirmation */}
            <ZoruDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <ZoruDialogContent className="max-w-sm">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete ad?</ZoruDialogTitle>
                        <ZoruDialogDescription>This action cannot be undone. The ad will be permanently deleted.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <ZoruButton variant="outline" onClick={() => setDeleteId(null)}>Cancel</ZoruButton>
                        <ZoruButton variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
