
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getProjectById } from '@/app/actions';
import { handleSyncTemplates } from '@/app/actions/template.actions';
import { getTemplates } from '@/app/actions/whatsapp.actions';
import { useRouter } from 'next/navigation';
import type { Project, Template, MetaFlow } from '@/lib/definitions';
import { BroadcastForm } from '@/components/wabasimplify/broadcast-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, RefreshCw, StopCircle, LoaderCircle, Clock, Play, AlertCircle, PlusCircle, BookCopy } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RequeueBroadcastDialog } from '@/components/wabasimplify/requeue-broadcast-dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { getMetaFlows } from '@/app/actions/meta-flow.actions';
import { TemplateCard } from '@/components/wabasimplify/template-card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useMemo } from 'react';


function TemplatesPageSkeleton() {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-10 w-48" />
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-10 w-full md:max-w-sm" />
            <Skeleton className="h-10 w-full sm:w-[180px]" />
            <Skeleton className="h-10 w-full sm:w-[180px]" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    )
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isSyncing, startTemplatesSyncTransition] = useTransition();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string|null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const router = useRouter();


  const fetchTemplates = useCallback(async (projectId: string, showToast = false) => {
    startLoadingTransition(async () => {
        try {
            const templatesData = await getTemplates(projectId);
            setTemplates(templatesData || []);
          if (showToast) {
            toast({ title: "Refreshed", description: "Template list has been updated." });
          }
        } catch (error: any) {
          console.error("Failed to fetch templates:", error);
          toast({
            title: "Error",
            description: "Could not fetch templates. Please try again.",
            variant: "destructive"
          });
        }
    });
  }, [toast, startLoadingTransition]);
  
  useEffect(() => {
    setIsClient(true);
    const storedProjectId = localStorage.getItem('activeProjectId');
    setActiveProjectId(storedProjectId);
  }, []);

  useEffect(() => {
    if (isClient) {
        document.title = 'Message Templates | SabNode';
        if (activeProjectId) {
            fetchTemplates(activeProjectId);
        }
    }
  }, [isClient, activeProjectId, fetchTemplates]);

  const onSync = useCallback(() => {
    if (!activeProjectId) {
        toast({ title: "Error", description: "No active project selected. Please go to the main dashboard and select a project.", variant: "destructive" });
        return;
    }
    startTemplatesSyncTransition(async () => {
      const result = await handleSyncTemplates(activeProjectId);
      if (result.error) {
        toast({ title: "Sync Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Sync Successful", description: result.message });
        await fetchTemplates(activeProjectId, true);
      }
    });
  }, [toast, activeProjectId, fetchTemplates, startTemplatesSyncTransition]);

  const filteredTemplates = useMemo(() => templates.filter(template => {
    const nameMatch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const categoryMatch = categoryFilter === 'ALL' || template.category === categoryFilter;
    const statusMatch = statusFilter === 'ALL' || template.status === statusFilter;
    return nameMatch && categoryMatch && statusMatch;
  }), [templates, searchQuery, categoryFilter, statusFilter]);

  const categories = useMemo(() => ['ALL', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean)))], [templates]);
  const statuses = useMemo(() => ['ALL', ...Array.from(new Set(templates.map(t => t.status).filter(Boolean)))], [templates]);
  
  const cardGradients = ['card-gradient-green', 'card-gradient-blue', 'card-gradient-purple', 'card-gradient-orange'];

  if (!isClient || (isLoading && templates.length === 0)) {
    return <TemplatesPageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                  <h1 className="text-3xl font-bold font-headline">Message Templates</h1>
                  <p className="text-muted-foreground">Manage and sync your WhatsApp message templates.</p>
              </div>
              <div className="flex items-center gap-2">
                  <Button onClick={onSync} disabled={isSyncing || !activeProjectId} variant="outline">
                    <RefreshCw className={`h-4 w-4 sm:mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Sync with Meta</span>
                  </Button>
                  <Button asChild variant="outline">
                      <Link href="/dashboard/templates/library">
                          <BookCopy className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Templates Library</span>
                      </Link>
                  </Button>
                  <Button asChild disabled={!activeProjectId}>
                      <Link href="/dashboard/templates/create">
                          <PlusCircle className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Create New Template</span>
                      </Link>
                  </Button>
              </div>
          </div>
          
          {!activeProjectId && isClient ? (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to manage templates.
                </AlertDescription>
            </Alert>
          ) : (
            <>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-grow w-full md:flex-grow-0 md:max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search templates by name..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filter by category..." />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(category => (
                                     <SelectItem key={category} value={category} className="capitalize">{category.replace(/_/g, ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full sm:w-auto">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Filter by status..." />
                            </SelectTrigger>
                            <SelectContent>
                                {statuses.map(status => (
                                     <SelectItem key={status} value={status} className="capitalize">{status.replace(/_/g, ' ')}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {filteredTemplates.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTemplates.map((template, index) => (
                        <TemplateCard
                        key={template._id.toString()}
                        template={template}
                        gradientClass={cardGradients[index % cardGradients.length]}
                        />
                    ))}
                    </div>
                ) : (
                    <div className="col-span-full">
                        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-20 text-center">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                            <h3 className="text-xl font-semibold mt-4">
                                {templates.length > 0 ? 'No Matching Templates' : 'No Templates Found'}
                            </h3>
                            <p className="text-muted-foreground mt-2">
                            {templates.length > 0
                                ? "Your filters did not match any templates. Try adjusting your search."
                                : 'Click "Sync with Meta" to fetch your templates, or create a new one.'}
                            </p>
                        </div>
                    </div>
                )}
            </>
      )}
    </div>
  );
}
