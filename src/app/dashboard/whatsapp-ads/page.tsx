

'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { getProjectById } from '@/app/actions';
import { getAdCampaigns, handleCreateWhatsAppAd } from '@/app/actions/facebook.actions';
import type { WithId } from 'mongodb';
import type { AdCampaign, Project } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, Megaphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CreateAdDialog } from '@/components/wabasimplify/create-ad-dialog';
import Link from 'next/link';

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
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isCreateAdOpen, setIsCreateAdOpen] = useState(false);

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startLoadingTransition(async () => {
            const [campaignsData, projectData] = await Promise.all([
                getAdCampaigns(projectId),
                getProjectById(projectId)
            ]);
            setCampaigns(campaignsData);
            setProject(projectData);
        });
    }, [projectId]);

    useEffect(() => {
        setIsClient(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            fetchData();
        }
    }, [projectId, fetchData]);
    
    const hasMarketingSetup = !!(project?.adAccountId && project.facebookPageId && project.accessToken);

    if (!isClient || isLoading) {
        return <AdsPageSkeleton />;
    }

    if (!projectId) {
         return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to manage ads.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <>
            {project && (
                <CreateAdDialog 
                    isOpen={isCreateAdOpen} 
                    onOpenChange={setIsCreateAdOpen}
                    project={project}
                    onAdCreated={fetchData}
                />
            )}
             <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Megaphone/> Ads Manager</h1>
                        <p className="text-muted-foreground">Create and manage your "Click to WhatsApp" ad campaigns.</p>
                    </div>
                    <Button onClick={() => setIsCreateAdOpen(true)} disabled={!hasMarketingSetup}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create New Ad
                    </Button>
                </div>

                {!hasMarketingSetup && (
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Marketing Settings Required</AlertTitle>
                        <AlertDescription>
                            Please configure your Ad Account ID and Facebook Page ID in{' '}
                            <Link href="/dashboard/settings?tab=marketing" className="font-semibold text-primary hover:underline">Settings &rarr; Marketing</Link>
                            {' '}before you can create ads.
                        </AlertDescription>
                    </Alert>
                )}

                <Card className="card-gradient card-gradient-blue">
                    <CardHeader>
                        <CardTitle>Your Campaigns</CardTitle>
                        <CardDescription>A list of all ad campaigns created through Wachat.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Campaign Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Daily Budget</TableHead>
                                        <TableHead>Created At</TableHead>
                                        <TableHead>Meta Campaign ID</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {campaigns.length > 0 ? (
                                        campaigns.map((campaign) => (
                                            <TableRow key={campaign._id.toString()}>
                                                <TableCell className="font-medium">{campaign.name}</TableCell>
                                                <TableCell><Badge variant={campaign.status === 'PAUSED' ? 'secondary' : 'default'}>{campaign.status}</Badge></TableCell>
                                                <TableCell>${campaign.dailyBudget.toFixed(2)}</TableCell>
                                                <TableCell>{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
                                                <TableCell className="font-mono text-xs">{campaign.metaCampaignId}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">No ad campaigns created yet.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
