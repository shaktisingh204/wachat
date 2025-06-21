'use client';

import { useState, useEffect, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getProjectById, handleSyncPhoneNumbers } from '@/app/actions';
import type { Project, PhoneNumber } from '@/app/dashboard/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, AlertCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function NumbersPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, startSyncTransition] = useTransition();
  const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);
  const { toast } = useToast();

  const fetchProjectData = async () => {
    try {
      const storedProjectId = localStorage.getItem('activeProjectId');
      if (storedProjectId) {
        const projectData = await getProjectById(storedProjectId);
        setProject(projectData || null);
      }
    } catch (error) {
      console.error("Failed to fetch project data:", error);
      toast({
        title: "Error",
        description: "Failed to load project numbers. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchProjectData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSync = () => {
    startSyncTransition(async () => {
      const projectId = localStorage.getItem('activeProjectId');
      if (!projectId) {
        toast({ title: "Error", description: "No active project selected.", variant: "destructive" });
        return;
      }
      const result = await handleSyncPhoneNumbers(projectId);
      if (result.error) {
        toast({ title: "Sync Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Sync Successful", description: result.message });
        await fetchProjectData();
      }
    });
  };

  const onCheckHealth = () => {
    toast({
        title: "Health Status",
        description: "Health information (Status, Quality, Throughput) is shown in the table and is up-to-date with the latest sync."
    });
  };

  const getStatusVariant = (status?: string) => {
    if (!status) return 'outline';
    status = status.toLowerCase();
    if (status.includes('verified')) return 'default';
    if (status.includes('pending')) return 'secondary';
    return 'destructive';
  }

  const getQualityVariant = (quality?: string) => {
    if (!quality) return 'outline';
    quality = quality.toLowerCase();
    if (quality === 'green' || quality === 'high') return 'default';
    if (quality === 'yellow' || quality === 'medium') return 'secondary';
    if (quality === 'unknown') return 'secondary';
    return 'destructive';
  }
  
  const getThroughputVariant = (level?: string) => {
    if (!level) return 'outline';
    level = level.toLowerCase();
    if (level === 'high') return 'default';
    if (level === 'medium') return 'secondary';
    if (level === 'low') return 'destructive';
    return 'outline';
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4 mt-2" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
     return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Phone Number Management</h1>
                <p className="text-muted-foreground">Manage your project's WhatsApp phone numbers.</p>
            </div>
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard page to see its phone numbers.
                </AlertDescription>
            </Alert>
        </div>
     )
  }

  const phoneNumbers: PhoneNumber[] = project.phoneNumbers || [];
    
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Phone Number Management</h1>
          <p className="text-muted-foreground">Your registered WhatsApp phone numbers for project "{project.name}".</p>
        </div>
        <Button onClick={onSync} disabled={isSyncing || !project} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync Phone Numbers
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Numbers</CardTitle>
          <CardDescription>A list of your phone numbers retrieved from your WhatsApp Business Account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number / Name</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Throughput</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phoneNumbers.length > 0 ? (
                phoneNumbers.map((phone) => (
                  <TableRow key={phone.id}>
                    <TableCell className="font-medium">
                      <div>{phone.display_phone_number}</div>
                      <div className="text-xs text-muted-foreground">{phone.verified_name}</div>
                    </TableCell>
                     <TableCell>
                       <Badge variant="outline" className="capitalize">
                         {phone.platform_type?.replace(/_/g, ' ').toLowerCase() || 'N/A'}
                       </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusVariant(phone.code_verification_status)}
                        className="capitalize"
                      >
                        {phone.code_verification_status?.replace(/_/g, ' ').toLowerCase() || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getQualityVariant(phone.quality_rating)}
                        className="capitalize"
                      >
                        {phone.quality_rating?.replace(/_/g, ' ').toLowerCase() || 'N/A'}
                      </Badge>
                    </TableCell>
                     <TableCell>
                       <Badge variant={getThroughputVariant(phone.throughput?.level)} className="capitalize">
                         {phone.throughput?.level?.toLowerCase() || 'N/A'}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => setSelectedPhone(phone)}>View Details</DropdownMenuItem>
                          <DropdownMenuItem onSelect={onCheckHealth}>Check Health Status</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            disabled
                          >
                            Remove (API Sync)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No phone numbers found for this project.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedPhone} onOpenChange={(open) => !open && setSelectedPhone(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Phone Number Details</DialogTitle>
            <DialogDescription>{selectedPhone?.display_phone_number} | {selectedPhone?.verified_name}</DialogDescription>
          </DialogHeader>
          {selectedPhone && (
              <div className="mt-2 text-sm max-h-96 overflow-y-auto">
                <pre className="p-4 bg-muted/50 rounded-md whitespace-pre-wrap font-code">
                    {JSON.stringify(selectedPhone, null, 2)}
                </pre>
              </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
