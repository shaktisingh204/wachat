
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import type { WithId } from 'mongodb';
import { getProjectById, handleSyncPhoneNumbers } from '@/app/actions';
import type { Project, PhoneNumber } from '@/app/dashboard/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MoreHorizontal, AlertCircle, RefreshCw, LoaderCircle, Edit, UserCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { EditPhoneNumberDialog } from '@/components/wabasimplify/edit-phone-number-dialog';

function NumbersPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96 mt-2" />
                </div>
                <Skeleton className="h-10 w-48" />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                 {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-60 w-full" />)}
            </div>
        </div>
    );
}

export default function NumbersPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isSyncing, startSyncTransition] = useTransition();
  const [isLoading, startLoadingTransition] = useTransition();
  const [editingPhone, setEditingPhone] = useState<PhoneNumber | null>(null);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string|null>(null);
  const router = useRouter();


  const fetchProjectData = useCallback(async (projectId: string) => {
    startLoadingTransition(async () => {
        try {
            const projectData = await getProjectById(projectId);
            setProject(projectData || null);
        } catch (error) {
          console.error("Failed to fetch project data:", error);
          toast({
            title: "Error",
            description: "Failed to load project numbers. Please try again later.",
            variant: "destructive",
          });
        }
    });
  }, [toast]);
  
  useEffect(() => {
    setIsClient(true);
    const storedProjectId = localStorage.getItem('activeProjectId');
    setActiveProjectId(storedProjectId);
  }, []);


  useEffect(() => {
    if (isClient && activeProjectId) {
      fetchProjectData(activeProjectId);
    }
  }, [isClient, activeProjectId, fetchProjectData]);

  const onSync = () => {
    if (!activeProjectId) {
        toast({ title: "Error", description: "No active project selected.", variant: "destructive" });
        return;
    }
    startSyncTransition(async () => {
      const result = await handleSyncPhoneNumbers(activeProjectId);
      if (result.error) {
        toast({ title: "Sync Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Sync Successful", description: result.message });
        await fetchProjectData(activeProjectId);
      }
    });
  };

  const getStatusVariant = (status?: string) => {
    if (!status) return 'outline';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('verified')) return 'default';
    if (lowerStatus.includes('pending')) return 'secondary';
    return 'destructive';
  }

  const getQualityVariant = (quality?: string) => {
    if (!quality) return 'outline';
    const lowerQuality = quality.toLowerCase();
    if (lowerQuality === 'green' || lowerQuality === 'high') return 'default';
    if (lowerQuality === 'yellow' || lowerQuality === 'medium') return 'secondary';
    if (lowerQuality === 'unknown') return 'secondary';
    return 'destructive';
  }
  
  const phoneNumbers: PhoneNumber[] = project?.phoneNumbers || [];
    
  return (
    <>
      {editingPhone && project && (
        <EditPhoneNumberDialog
            isOpen={!!editingPhone}
            onOpenChange={() => setEditingPhone(null)}
            phone={editingPhone}
            project={project}
            onUpdateSuccess={() => fetchProjectData(project._id.toString())}
        />
      )}
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline">Phone Number Management</h1>
            <p className="text-muted-foreground">
              {project ? `Your registered WhatsApp phone numbers for project "${project.name}".` : 'Manage your project\'s WhatsApp phone numbers.'}
              </p>
          </div>
          <Button onClick={onSync} disabled={isSyncing || !project || isLoading} variant="outline">
            {isSyncing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync Phone Numbers
          </Button>
        </div>

        {isLoading ? (
          <NumbersPageSkeleton />
        ) : !project ? (
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Project Selected</AlertTitle>
              <AlertDescription>
                  Please select a project from the main dashboard page to see its phone numbers.
              </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {phoneNumbers.length > 0 ? (
                  phoneNumbers.map(phone => (
                      <Card key={phone.id} className="flex flex-col">
                          <CardHeader className="flex-row items-center gap-4">
                              <div className="relative flex-shrink-0">
                                  {phone.profile?.profile_picture_url ? (
                                      <Image 
                                          src={phone.profile.profile_picture_url} 
                                          alt={phone.verified_name} 
                                          width={56} 
                                          height={56} 
                                          className="rounded-full border"
                                          data-ai-hint="business logo" 
                                      />
                                  ) : (
                                      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                                          <UserCircle className="h-8 w-8 text-muted-foreground"/>
                                      </div>
                                  )}
                              </div>
                              <div className="flex-1">
                                  <CardTitle className="text-base">{phone.verified_name}</CardTitle>
                                  <p className="text-sm font-mono text-muted-foreground">{phone.display_phone_number}</p>
                              </div>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm flex-grow">
                              <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Status</span>
                                  <Badge variant={getStatusVariant(phone.code_verification_status)} className="capitalize">
                                      {phone.code_verification_status ? phone.code_verification_status.replace(/_/g, ' ').toLowerCase() : 'N/A'}
                                  </Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Quality</span>
                                  <Badge variant={getQualityVariant(phone.quality_rating)} className="capitalize">
                                      {phone.quality_rating || 'N/A'}
                                  </Badge>
                              </div>
                               <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">About</span>
                                  <p className="truncate w-40 text-right">{phone.profile?.about || 'Not set'}</p>
                              </div>
                          </CardContent>
                          <CardFooter>
                              <Button variant="secondary" className="w-full" onClick={() => setEditingPhone(phone)}>
                                  <Edit className="mr-2 h-4 w-4"/>
                                  Edit Profile
                              </Button>
                          </CardFooter>
                      </Card>
                  ))
              ) : (
                   <Card className="md:col-span-2 lg:col-span-3">
                       <CardContent className="h-48 flex flex-col items-center justify-center text-center">
                           <p className="text-lg font-semibold">No Phone Numbers Found</p>
                           <p className="text-muted-foreground">Click "Sync Phone Numbers" to fetch them from your Meta Business Account.</p>
                       </CardContent>
                   </Card>
              )}
          </div>
        )}
      </div>
    </>
  );
}
