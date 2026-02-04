'use client';

import { useState, useEffect, useTransition, use } from 'react';
import { getAds, updateEntityStatus } from '@/app/actions/ad-manager.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

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
    const [ads, setAds] = useState<any[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const { toast } = useToast();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        startLoadingTransition(async () => {
            const result = await getAds(adSetId);
            if (result.error) setError(result.error);
            setAds(result.ads || []);
        });
    }, [adSetId]);

    const handleStatusToggle = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        setAds(prev => prev.map(item =>
            item.id === id ? { ...item, status: newStatus } : item
        ));

        const result = await updateEntityStatus(id, 'ad', newStatus);

        if (result.success) {
            toast({ title: "Status Updated", description: `Ad is now ${newStatus.toLowerCase()}.` });
        } else {
            setAds(prev => prev.map(item =>
                item.id === id ? { ...item, status: currentStatus as any } : item
            ));
            toast({ title: "Update Failed", description: result.error, variant: "destructive" });
        }
    };

    if (isLoading) return <PageSkeleton />;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/dashboard/ad-manager/campaigns`}> {/* Ideally back to Ad Set list but simple back to campaigns is safer contextless */}
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
                        <ImageIcon className="h-6 w-6" /> Ads
                    </h1>
                    <p className="text-muted-foreground text-sm">Ad Set ID: {adSetId}</p>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error fetching Ads</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {ads.length === 0 ? (
                <Card className="border-dashed border-2 py-12">
                    <div className="flex flex-col items-center justify-center text-center gap-4">
                        <div className="bg-primary/10 p-4 rounded-full">
                            <ImageIcon className="h-12 w-12 text-primary" />
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
                                    <ImageIcon className="h-12 w-12 text-gray-300" />
                                )}
                                <div className="absolute top-2 right-2">
                                    <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'}>{ad.status}</Badge>
                                </div>
                            </div>
                            <CardHeader className="p-4">
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="text-base truncate" title={ad.name}>{ad.name}</CardTitle>
                                    <Switch
                                        className="scale-75"
                                        checked={ad.status === 'ACTIVE'}
                                        onCheckedChange={() => handleStatusToggle(ad.id, ad.status)}
                                    />
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
        </div>
    );
}
