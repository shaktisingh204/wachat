
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreateTemplateForm } from '@/components/wabasimplify/create-template-form';
import Link from 'next/link';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { getProjectById } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project, Template } from '@/app/dashboard/page';

export default function CreateTemplateClientPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialTemplate, setInitialTemplate] = useState<WithId<Template> | null>(null);
  const searchParams = useSearchParams();
  const action = searchParams.get('action');

  useEffect(() => {
    document.title = `${action === 'edit' ? 'Edit' : action === 'clone' ? 'Clone' : 'Create'} Template | WABASimplify`;
    
    const storedProjectId = localStorage.getItem('activeProjectId');
    
    const templateJson = localStorage.getItem('templateToAction');
    if (templateJson) {
      try {
        setInitialTemplate(JSON.parse(templateJson));
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
  }, [action]);

  const pageTitle = action === 'edit' ? 'Edit Message Template' : action === 'clone' ? 'Clone Message Template' : 'Create New Message Template';
  const pageDescription = action ? 'Modify the details below and submit it as a new template for approval.' : 'Design your template and submit it for approval.';


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

      {loading && (
         <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
         </div>
      )}
      
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
