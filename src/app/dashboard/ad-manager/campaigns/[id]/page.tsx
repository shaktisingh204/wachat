'use client';

import { useState, useEffect, useTransition, use } from 'react';
import { getAdSets, updateEntityStatus } from '@/app/actions/ad-manager.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft, Layers, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-8 w-64" />
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                <CardContent><Skeleton className="h-48 w-full" /></CardContent>
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

    useEffect(() => {
        startLoadingTransition(async () => {
            const result = await getAdSets(campaignId);
            if (result.error) setError(result.error);
            setAdSets(result.adSets || []);
        });
    }, [campaignId]);

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
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/ad-manager/campaigns">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
                        <Layers className="h-6 w-6" /> Ad Sets
                    </h1>
                    <p className="text-muted-foreground text-sm">Campaign ID: {campaignId}</p>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error fetching Ad Sets</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Ad Sets</CardTitle>
                    <CardDescription>Manage the ad sets within this campaign.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Ad Set Name</TableHead>
                                    <TableHead>Budget</TableHead>
                                    <TableHead>Optimization</TableHead>
                                    <TableHead>Results</TableHead>
                                    <TableHead>Cost/Result</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {adSets.length > 0 ? (
                                    adSets.map((adSet) => (
                                        <TableRow key={adSet.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={adSet.status === 'ACTIVE'}
                                                        onCheckedChange={() => handleStatusToggle(adSet.id, adSet.status)}
                                                    />
                                                    <span className="text-xs text-muted-foreground">{adSet.status}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <Link href={`/dashboard/ad-manager/ad-sets/${adSet.id}`} className="hover:underline">
                                                    {adSet.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(adSet.daily_budget) / 100)} Daily
                                            </TableCell>
                                            <TableCell><Badge variant="outline">{adSet.optimization_goal}</Badge></TableCell>
                                            <TableCell>{adSet.insights?.clicks || 0} Clicks</TableCell>
                                            <TableCell>
                                                {adSet.insights?.clicks > 0
                                                    ? `$${(Number(adSet.insights.spend) / Number(adSet.insights.clicks)).toFixed(2)}`
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/ad-manager/ad-sets/${adSet.id}`}>
                                                        Ads <ChevronRight className="ml-1 h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">No ad sets found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
