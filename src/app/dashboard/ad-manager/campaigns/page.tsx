'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { getAdCampaigns, updateEntityStatus } from '@/app/actions/ad-manager.actions';
import type { WithId, AdCampaign } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, Megaphone, Wrench, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useProject } from '@/context/project-context';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

function AdsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96 mt-2" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                <CardContent><Skeleton className="h-48 w-full" /></CardContent>
            </Card>
        </div>
    );
}

export default function AdsManagerPage() {
    const [campaigns, setCampaigns] = useState<WithId<AdCampaign>[]>([]);
    const [adAccountId, setAdAccountId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const { sessionUser } = useProject();
    const { toast } = useToast();

    const fetchData = useCallback((id: string) => {
        startLoadingTransition(async () => {
            const campaignsData = await getAdCampaigns(id);
            if (campaignsData.error) setError(campaignsData.error);
            setCampaigns(campaignsData.campaigns || []);
        });
    }, []);

    useEffect(() => {
        const storedAdAccountId = localStorage.getItem('activeAdAccountId');
        setAdAccountId(storedAdAccountId);
        if (storedAdAccountId) {
            fetchData(storedAdAccountId);
        }
    }, [fetchData]);

    const handleStatusToggle = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        // Optimistic update
        setCampaigns(prev => prev.map(c =>
            c.metaCampaignId === id ? { ...c, status: newStatus } : c
        ));

        const result = await updateEntityStatus(id, 'campaign', newStatus);

        if (result.success) {
            toast({ title: "Status Updated", description: `Campaign is now ${newStatus.toLowerCase()}.` });
        } else {
            // Revert on failure
            setCampaigns(prev => prev.map(c =>
                c.metaCampaignId === id ? { ...c, status: currentStatus as any } : c
            ));
            toast({ title: "Update Failed", description: result.error, variant: "destructive" });
        }
    };

    if (isLoading) {
        return <AdsPageSkeleton />;
    }

    if (!adAccountId) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <Megaphone className="h-16 w-16 text-muted-foreground" />
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Ad Account Selected</AlertTitle>
                    <AlertDescription>
                        Please select an Ad Account from the Ad Accounts page to manage campaigns.
                    </AlertDescription>
                </Alert>
                <Button asChild>
                    <Link href="/dashboard/ad-manager/ad-accounts">
                        <Wrench className="mr-2 h-4 w-4" />
                        Go to Ad Accounts
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Megaphone /> Ads Manager</h1>
                    <p className="text-muted-foreground">Create and manage your "Click to WhatsApp" ad campaigns.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/ad-manager/create">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create New Ad
                    </Link>
                </Button>
            </div>
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Your Campaigns</CardTitle>
                    <CardDescription>
                        Manage your campaigns here. Toggle the switch to Pause/Activate. Click the name to view Ad Sets.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Campaign Name</TableHead>
                                    <TableHead>Impressions</TableHead>
                                    <TableHead>Clicks</TableHead>
                                    <TableHead>CTR</TableHead>
                                    <TableHead>Spend</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campaigns.length > 0 ? (
                                    campaigns.map((campaign) => (
                                        <TableRow key={campaign._id.toString()}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={campaign.status === 'ACTIVE'}
                                                        onCheckedChange={() => handleStatusToggle(campaign.metaCampaignId!, campaign.status)}
                                                    />
                                                    <span className="text-xs text-muted-foreground">{campaign.status}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <Link href={`/dashboard/ad-manager/campaigns/${campaign.metaCampaignId}`} className="hover:underline flex items-center gap-1">
                                                    {campaign.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{campaign.insights?.impressions || 'N/A'}</TableCell>
                                            <TableCell>{campaign.insights?.clicks || 'N/A'}</TableCell>
                                            <TableCell>{campaign.insights?.ctr ? `${Number(campaign.insights.ctr).toFixed(2)}%` : 'N/A'}</TableCell>
                                            <TableCell>${campaign.insights?.spend || '0.00'}</TableCell>
                                            <TableCell>{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/dashboard/ad-manager/campaigns/${campaign.metaCampaignId}`}>
                                                        View <ChevronRight className="ml-1 h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">No ad campaigns created yet.</TableCell>
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
