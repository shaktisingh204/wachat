'use client';

import { useState, useEffect, useTransition, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LuArrowLeft, LuImage, LuCircleAlert, LuRefreshCw, LuEllipsisVertical, LuPause, LuPlay, LuCopy, LuTrash2, LuChevronRight } from 'react-icons/lu';
import { getAds, updateEntityStatus, duplicateAd, deleteAd } from '@/app/actions/ad-manager.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-8 w-64" />
            <div className="grid md:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
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
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
                <Link href="/dashboard/ad-manager" className="hover:text-foreground transition-colors">Ad Manager</Link>
                <LuChevronRight className="h-3 w-3" />
                <Link href="/dashboard/ad-manager/campaigns" className="hover:text-foreground transition-colors">Campaigns</Link>
                <LuChevronRight className="h-3 w-3" />
                <span className="text-foreground font-medium">Ad Set</span>
            </nav>

            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <LuArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
                        <LuImage className="h-6 w-6" /> Ads
                    </h1>
                    <p className="text-muted-foreground text-sm">Ad Set ID: {adSetId}</p>
                </div>
                <Button variant="outline" size="icon" onClick={fetchAds} disabled={isLoading}>
                    <LuRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {error && (
                <Alert variant="destructive">
                    <LuCircleAlert className="h-4 w-4" />
                    <AlertTitle>Error fetching Ads</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {ads.length === 0 ? (
                <Card className="border-dashed border-2 py-12">
                    <div className="flex flex-col items-center justify-center text-center gap-4">
                        <div className="bg-primary/10 p-4 rounded-full">
                            <LuImage className="h-12 w-12 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold">No Ads Found</h3>
                            <p className="text-muted-foreground mt-1">This ad set currently has no ads.</p>
                        </div>
                    </div>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {ads.map((ad) => (
                        <Card key={ad.id} className="overflow-hidden">
                            <div className="aspect-video relative bg-gray-100 flex items-center justify-center overflow-hidden">
                                {ad.imageUrl ? (
                                    <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover" />
                                ) : (
                                    <LuImage className="h-12 w-12 text-gray-300" />
                                )}
                                <div className="absolute top-2 right-2">
                                    <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'}>{ad.status}</Badge>
                                </div>
                            </div>
                            <CardHeader className="p-4">
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="text-base truncate" title={ad.name}>{ad.name}</CardTitle>
                                    <div className="flex items-center gap-1">
                                        <Switch
                                            className="scale-75"
                                            checked={ad.status === 'ACTIVE'}
                                            onCheckedChange={() => handleStatusToggle(ad.id, ad.status)}
                                        />
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <LuEllipsisVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleStatusToggle(ad.id, ad.status)}>
                                                    {ad.status === 'ACTIVE' ? (
                                                        <><LuPause className="h-4 w-4 mr-2" /> Pause</>
                                                    ) : (
                                                        <><LuPlay className="h-4 w-4 mr-2" /> Resume</>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDuplicate(ad.id)}>
                                                    <LuCopy className="h-4 w-4 mr-2" /> Duplicate
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setDeleteId(ad.id)}
                                                >
                                                    <LuTrash2 className="h-4 w-4 mr-2" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <CardDescription className="text-xs">ID: {ad.id}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 text-sm grid grid-cols-2 gap-2">
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
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Delete confirmation */}
            <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete ad?</DialogTitle>
                        <DialogDescription>This action cannot be undone. The ad will be permanently deleted.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
