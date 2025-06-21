'use client';

import { useEffect, useState } from 'react';
import { CreateTemplateForm } from '@/components/wabasimplify/create-template-form';
import Link from 'next/link';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreateTemplatePage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Create Template | WABASimplify';
    const storedProjectId = localStorage.getItem('activeProjectId');
    setProjectId(storedProjectId);
    setLoading(false);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/dashboard/templates">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Templates
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">Create New Message Template</h1>
        <p className="text-muted-foreground">Design your template, get AI suggestions, and submit it for approval.</p>
      </div>

      {loading && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
            <div className="lg:col-span-1">
                <Skeleton className="h-96 w-full" />
            </div>
         </div>
      )}
      
      {!loading && !projectId && (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Project Selected</AlertTitle>
            <AlertDescription>
                Please select a project from the main dashboard before creating a template.
            </AlertDescription>
        </Alert>
      )}

      {!loading && projectId && <CreateTemplateForm projectId={projectId} />}

    </div>
  );
}
