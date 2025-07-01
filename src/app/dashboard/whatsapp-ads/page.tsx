
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import type { WithId } from 'mongodb';
import { getProjectById, getAdCampaigns, handleCreateWhatsAppAd } from '@/app/actions';
import type { Project, AdCampaign } from '@/app/dashboard/page';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Megaphone, PlusCircle, LoaderCircle } from 'lucide-react';
import { CreateAdDialog } from '@/components/wabasimplify/create-ad-dialog';

function WhatsAppAdsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
             <div>
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-48 mt-2" />
                    </div>
                    <Skeleton className="h-10 w-24" />
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
  const [adCampaigns, setAdCampaigns] = useState<WithId<AdCampaign>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const fetchData = useCallback(async (projectId: string) => {
    startLoadingTransition(async () => {
      const [projectData, adsData] = await Promise.all([
        getProjectById(projectId),
        getAdCampaigns(projectId),
      ]);
      setProject(projectData);
      setAdCampaigns(adsData);
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
    const storedProjectId = localStorage.getItem('activeProjectId');
    setActiveProjectId(storedProjectId);
  }, []);

  useEffect(() => {
    if (isClient && activeProjectId) {
      fetchData(activeProjectId);
    }
  }, [isClient, activeProjectId, fetchData]);

  if (!isClient || isLoading) {
      return <WhatsAppAdsPageSkeleton />;
  }

  if (!activeProjectId) {
    return (
        <Alert variant="destructive" className="max-w-lg mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Project Selected</AlertTitle>
            <AlertDescription>
                Please select a project from the main dashboard to manage WhatsApp Ads.
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <>
      {project && (
          <CreateAdDialog 
            isOpen={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            project={project}
            onAdCreated={() => fetchData(project._id.toString())}
          />
      )}
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <Megaphone className="h-8 w-8" />
            WhatsApp Ads
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Create and manage your "Click to WhatsApp" ad campaigns.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <CardTitle>Your Ad Campaigns</CardTitle>
                    <CardDescription>
                        A list of ad campaigns created for this project.
                    </CardDescription>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!project}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Ad
                </Button>
            </div>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adCampaigns.length > 0 ? (
                    adCampaigns.map((campaign) => (
                      <TableRow key={campaign._id.toString()}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <Badge variant={campaign.status === 'PAUSED' ? 'secondary' : 'default'}>{campaign.status}</Badge>
                        </TableCell>
                        <TableCell>INR {campaign.dailyBudget.toLocaleString()}</TableCell>
                        <TableCell>{new Date(campaign.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No ad campaigns found. Create one to get started.
                      </TableCell>
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
