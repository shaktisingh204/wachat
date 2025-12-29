
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { getProjectById } from '@/app/actions/index.ts';
import { getAdCampaigns } from '@/app/actions/facebook.actions';
import type { WithId } from 'mongodb';
import type { AdCampaign, Project } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, Megaphone, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CreateAdDialog } from '@/components/wabasimplify/create-ad-dialog';
import Link from 'next/link';
import { useProject } from '@/context/project-context';
import { FeatureLock, FeatureLockOverlay } from '@/components/wabasimplify/feature-lock';


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
            <CardHeader><Skeleton className="h-6 w-1/3"/></CardHeader>
            <CardContent><Skeleton className="h-48 w-full"/></CardContent>
        </Card>
      </div>
    );
}

export default function AdsManagerPage() {
    const [campaigns, setCampaigns] = useState<WithId<AdCampaign>[]>([]);
    const { activeProject, isLoadingProject, sessionUser } = useProject();
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const [isCreateAdOpen, setIsCreateAdOpen] = useState(false);

    const isAllowed = sessionUser?.plan?.features?.whatsappAds ?? false;

    const fetchData = useCallback(() => {
        if (!activeProject) return;
        startLoadingTransition(async () => {
            const campaignsData = await getAdCampaigns(activeProject._id.toString());
            setCampaigns(campaignsData.campaigns || []);
        });
    }, [activeProject]);

    useEffect(() => {
        setIsClient(true);
        if (activeProject) {
            fetchData();
        }
    }, [activeProject, fetchData]);
    
    if (!isClient || isLoadingProject) {
        return <AdsPageSkeleton />;
    }

    if (!activeProject) {
         return (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <Megaphone className="h-16 w-16 text-muted-foreground" />
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to manage its ads, or go to the Project Connections page to connect your projects.
                    </AlertDescription>
                </Alert>
                <Button asChild>
                    <Link href="/dashboard/facebook/all-projects">
                        <Wrench className="mr-2 h-4 w-4" />
                        Go to Project Connections
                    </Link>
                </Button>
            </div>
        );
    }
    
    if (isLoading) {
        return <AdsPageSkeleton />;
    }

    const hasMarketingSetup = !!(activeProject?.adAccountId && activeProject.facebookPageId && activeProject.accessToken);

    return (
        <>
            {activeProject && (
                <CreateAdDialog 
                    isOpen={isCreateAdOpen} 
                    onOpenChange={setIsCreateAdOpen}
                    project={activeProject}
                    onAdCreated={fetchData}
                />
            )}
             <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Megaphone/> Ads Manager</h1>
                        <p className="text-muted-foreground">Create and manage your "Click to WhatsApp" ad campaigns.</p>
                    </div>
                    <FeatureLock isAllowed={isAllowed}>
                        <Button onClick={() => setIsCreateAdOpen(true)} disabled={!hasMarketingSetup}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New Ad
                        </Button>
                    </FeatureLock>
                </div>
                 <div className="relative">
                    <FeatureLockOverlay isAllowed={isAllowed} featureName="Ads Manager" />
                    <FeatureLock isAllowed={isAllowed}>
                        {!hasMarketingSetup && (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Marketing Settings Required</AlertTitle>
                                <AlertDescription>
                                    This project is not yet connected to Facebook. Go to the {' '}
                                    <Link href="/dashboard/facebook/all-projects" className="font-semibold text-primary hover:underline">Project Connections</Link>
                                    {' '}page to connect it.
                                </AlertDescription>
                            </Alert>
                        )}

                        <Card className="card-gradient card-gradient-blue mt-4">
                            <CardHeader>
                                <CardTitle>Your Campaigns</CardTitle>
                                <CardDescription>A list of all ad campaigns created through SabNode, with performance insights.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Campaign Name</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Impressions</TableHead>
                                                <TableHead>Clicks</TableHead>
                                                <TableHead>CTR</TableHead>
                                                <TableHead>Spend</TableHead>
                                                <TableHead>Created</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {campaigns.length > 0 ? (
                                                campaigns.map((campaign) => (
                                                    <TableRow key={campaign._id.toString()}>
                                                        <TableCell className="font-medium">{campaign.name}</TableCell>
                                                        <TableCell><Badge variant={campaign.status === 'PAUSED' ? 'secondary' : 'default'}>{campaign.status}</Badge></TableCell>
                                                        <TableCell>{campaign.insights?.impressions || 'N/A'}</TableCell>
                                                        <TableCell>{campaign.insights?.clicks || 'N/A'}</TableCell>
                                                        <TableCell>{campaign.insights?.ctr ? `${Number(campaign.insights.ctr).toFixed(2)}%` : 'N/A'}</TableCell>
                                                        <TableCell>${campaign.insights?.spend || '0.00'}</TableCell>
                                                        <TableCell>{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="h-24 text-center">No ad campaigns created yet.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </FeatureLock>
                </div>
            </div>
        </>
    );
}
