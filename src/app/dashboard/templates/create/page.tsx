'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { getProjectById } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project, Template } from '@/lib/definitions';

const LoadingSkeleton = () => (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3 mt-2" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
);

const CreateTemplateForm = dynamic(
  () => import('@/components/wabasimplify/create-template-form').then(mod => mod.CreateTemplateForm),
  { loading: () => <LoadingSkeleton /> }
);


function CreateTemplatePageContent() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialTemplate, setInitialTemplate] = useState<WithId<Template> | null>(null);
  const [isClient, setIsClient] = useState(false);
  const searchParams = useSearchParams();
  const action = searchParams.get('action');

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      document.title = `${action === 'edit' ? 'Edit' : action === 'clone' ? 'Clone' : 'Create'} Template | Wachat`;
      
      const storedProjectId = localStorage.getItem('activeProjectId');
      
      const templateJson = localStorage.getItem('templateToAction');
      if (templateJson) {
        try {
          const templateData = JSON.parse(templateJson);
          if (action === 'clone') {
            // When cloning, remove the original header sample URL
            // to force the user to provide a new one.
            delete templateData.headerSampleUrl;
          }
          setInitialTemplate(templateData);
        } catch (e) {
          console.error("Failed to parse template data from localStorage", e);
        }
        localStorage.removeItem('templateToAction');
      }

      if (storedProjectId) {
        getProjectById(storedProjectId).then(projectData => {
          setProject(projectData);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }
  }, [action, isClient]);

  const pageTitle = action === 'edit' ? 'Edit Message Template' : action === 'clone' ? 'Clone Message Template' : 'Create New Message Template';
  const pageDescription = action ? 'Modify the details below and submit it as a new template for approval.' : 'Design your template and submit it for approval.';

  if (!isClient || loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/dashboard/templates">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Templates
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">{pageTitle}</h1>
        <p className="text-muted-foreground">{pageDescription}</p>
      </div>
      
      {!loading && !project && (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Project Selected</AlertTitle>
            <AlertDescription>
                Please select a project from the main dashboard before creating a template.
            </AlertDescription>
        </Alert>
      )}

      {!loading && project && <CreateTemplateForm project={project} initialTemplate={initialTemplate} isCloning={action === 'clone'} />}

    </div>
  );
}

export default function CreateTemplatePage() {
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <CreateTemplatePageContent />
        </Suspense>
    )
}
