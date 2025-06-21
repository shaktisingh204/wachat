'use client';

import { Button } from '@/components/ui/button';
import { TemplateCard } from '@/components/wabasimplify/template-card';
import { PlusCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { getTemplates, handleSyncTemplates } from '@/app/actions';
import { WithId } from 'mongodb';
import { useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type Template = {
  name: string;
  category: string;
  body: string;
  language: string;
  status: string;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, startSyncTransition] = useTransition();
  const { toast } = useToast();

  const fetchTemplates = async (showToast = false) => {
    setLoading(true);
    try {
      const projectId = localStorage.getItem('activeProjectId');
      if (projectId) {
        const templatesData = await getTemplates(projectId);
        setTemplates(templatesData as WithId<Template>[]);
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
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    document.title = 'Message Templates | WABASimplify';
    fetchTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSync = () => {
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
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Message Templates</h1>
          <p className="text-muted-foreground">Manage and sync your WhatsApp message templates.</p>
        </div>
        <div className="flex gap-2">
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
      
      {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
      ) : templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template._id.toString()}
              template={template}
            />
          ))}
        </div>
      ) : (
        <div className="col-span-full">
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-20 text-center">
            <h3 className="text-xl font-semibold">No Templates Found</h3>
            <p className="text-muted-foreground mt-2">
              Click "Sync with Meta" to fetch your templates, or create a new one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
