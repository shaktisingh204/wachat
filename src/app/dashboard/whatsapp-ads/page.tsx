
'use client';

import { useEffect, useState, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getAdCampaigns } from '@/app/actions';
import type { AdCampaign, Project } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Megaphone, BookOpen, AlertCircle } from 'lucide-react';
import { CreateAdDialog } from '@/components/wabasimplify/create-ad-dialog';
import { getProjectById } from '@/app/actions';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function AdsPageSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-10 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function WhatsAppAdsPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [campaigns, setCampaigns] = useState<WithId<AdCampaign>[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const storedProjectId = localStorage.getItem('activeProjectId');
      if (storedProjectId) {
        startLoadingTransition(async () => {
          const [projectData, campaignsData] = await Promise.all([
            getProjectById(storedProjectId),
            getAdCampaigns(storedProjectId),
          ]);
          setProject(projectData);
          setCampaigns(campaignsData);
        });
      }
    }
  }, [isClient]);

  const onAdCreated = () => {
    if (project) {
        startLoadingTransition(async () => {
            const campaignsData = await getAdCampaigns(project._id.toString());
            setCampaigns(campaignsData);
        });
    }
  };

  const getStatusVariant = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'active') return 'default';
    if (lowerStatus === 'paused') return 'secondary';
    return 'destructive';
  };

  if (!isClient || isLoading) {
    return <AdsPageSkeleton />;
  }

  const hasMarketingKeys = project && project.adAccountId && project.facebookPageId;
  
  return (
    <>
      {project && hasMarketingKeys && (
        <CreateAdDialog 
            isOpen={isDialogOpen} 
            onOpenChange={setIsDialogOpen} 
            project={project}
            onAdCreated={onAdCreated}
        />
      )}
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline">WhatsApp Ad Campaigns</h1>
            <p className="text-muted-foreground">Create and manage your "Click to WhatsApp" ads.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/whatsapp-ads/roadmap">
                <BookOpen className="mr-2 h-4 w-4"/>
                View Roadmap
              </Link>
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} disabled={!project || !hasMarketingKeys}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Ad
            </Button>
          </div>
        </div>

        {!project ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Project Selected</AlertTitle>
              <AlertDescription>
                  Please select a project from the main dashboard page to manage ad campaigns.
              </AlertDescription>
            </Alert>
        ) : !hasMarketingKeys ? (
          <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Marketing Settings Required</AlertTitle>
              <AlertDescription className="space-y-2">
                  <p>To create and manage WhatsApp Ads, you must first configure your Ad Account ID and Facebook Page ID in your project settings.</p>
                  <Button asChild size="sm">
                      <Link href="/dashboard/settings?tab=marketing">Go to Settings</Link>
                  </Button>
              </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your Campaigns</CardTitle>
              <CardDescription>A list of all ad campaigns created for this project.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop Table View */}
              <div className="hidden md:block border rounded-md">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Campaign Name</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Daily Budget</TableHead>
                              <TableHead>Meta Campaign ID</TableHead>
                              <TableHead>Created At</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {campaigns.length > 0 ? campaigns.map((ad) => (
                              <TableRow key={ad._id.toString()}>
                                  <TableCell className="font-medium">{ad.name}</TableCell>
                                  <TableCell><Badge variant={getStatusVariant(ad.status)}>{ad.status}</Badge></TableCell>
                                  <TableCell>{ad.dailyBudget.toFixed(2)}</TableCell>
                                  <TableCell className="font-mono text-xs">{ad.metaCampaignId}</TableCell>
                                  <TableCell>{new Date(ad.createdAt).toLocaleDateString()}</TableCell>
                              </TableRow>
                          )) : (
                              <TableRow><TableCell colSpan={5} className="h-24 text-center">No ad campaigns found.</TableCell></TableRow>
                          )}
                      </TableBody>
                  </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                  {campaigns.length > 0 ? campaigns.map((ad) => (
                      <Card key={ad._id.toString()}>
                          <CardHeader className="pb-4">
                              <div className="flex justify-between items-start">
                                  <CardTitle className="text-base">{ad.name}</CardTitle>
                                  <Badge variant={getStatusVariant(ad.status)}>{ad.status}</Badge>
                              </div>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                  <span className="text-muted-foreground">Daily Budget:</span>
                                  <span>{ad.dailyBudget.toFixed(2)}</span>
                              </div>
                            <div className="flex justify-between">
                                  <span className="text-muted-foreground">Created:</span>
                                  <span>{new Date(ad.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="text-xs text-muted-foreground pt-2">
                                  <p className="font-mono break-all">ID: {ad.metaCampaignId}</p>
                              </div>
                          </CardContent>
                      </Card>
                  )) : (
                      <div className="h-24 text-center flex items-center justify-center">No ad campaigns found.</div>
                  )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
