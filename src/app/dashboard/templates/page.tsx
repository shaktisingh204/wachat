
'use client';

import { Button } from '@/components/ui/button';
import { TemplateCard } from '@/components/wabasimplify/template-card';
import { PlusCircle, RefreshCw, Search, FileText } from 'lucide-react';
import Link from 'next/link';
import { getTemplates, handleSyncTemplates } from '@/app/actions';
import { WithId } from 'mongodb';
import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Template } from '@/app/dashboard/page';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchTemplates = useCallback(async (showToast = false) => {
    startLoadingTransition(async () => {
        try {
          const projectId = localStorage.getItem('activeProjectId');
          if (projectId) {
            const templatesData = await getTemplates(projectId);
            setTemplates(templatesData || []);
          }
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
  }, []);

  useEffect(() => {
    if (isClient) {
      document.title = 'Message Templates | Wachat';
      fetchTemplates();
    }
  }, [isClient, fetchTemplates]);

  const onSync = useCallback(() => {
    startSyncTransition(async () => {
      const projectId = localStorage.getItem('activeProjectId');
      if (!projectId) {
        toast({ title: "Error", description: "No active project selected. Please go to the main dashboard and select a project.", variant: "destructive" });
        return;
      }
      const result = await handleSyncTemplates(projectId);
      if (result.error) {
        toast({ title: "Sync Failed", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Sync Successful", description: result.message });
        await fetchTemplates(true);
      }
    });
  }, [toast, fetchTemplates, startSyncTransition]);

  const filteredTemplates = useMemo(() => templates.filter(template => {
    const nameMatch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const categoryMatch = categoryFilter === 'ALL' || template.category === categoryFilter;
    const statusMatch = statusFilter === 'ALL' || template.status === statusFilter;
    return nameMatch && categoryMatch && statusMatch;
  }), [templates, searchQuery, categoryFilter, statusFilter]);

  const categories = useMemo(() => ['ALL', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean)))], [templates]);
  const statuses = useMemo(() => ['ALL', ...Array.from(new Set(templates.map(t => t.status).filter(Boolean)))], [templates]);
  
  if (!isClient || (isLoading && templates.length === 0)) {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Message Templates</h1>
                    <p className="text-muted-foreground">Manage and sync your WhatsApp message templates.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" disabled>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync with Meta
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard/templates/create">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New Template
                        </Link>
                    </Button>
                </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Message Templates</h1>
          <p className="text-muted-foreground">Manage and sync your WhatsApp message templates.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={onSync} disabled={isSyncing} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync with Meta
            </Button>
            <Button asChild>
                <Link href="/dashboard/templates/create">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Template
                </Link>
            </Button>
        </div>
      </div>
      
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
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template._id.toString()}
              template={template}
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
    </div>
  );
}
