'use client';

import {
  Alert,
  Badge,
  Button,
  Skeleton,
} from '@/components/sabcrm/20ui';
import {
  Suspense,
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft,
  Database } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { CreateTemplateForm } from '@/app/wachat/_components/create-template-form';
import { getProjectById } from '@/app/actions/project.actions';
import type { WithId,
  Project } from '@/lib/definitions';

/**
 * Wachat Bulk → Create Template — bulk-create one template across many
 * projects. Keeps existing CreateTemplateForm, only 20ui chrome.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

function BulkTemplatePageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

function BulkTemplatePageContent() {
  const router = useRouter();
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<WithId<Project>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedProjectIds = JSON.parse(
      localStorage.getItem('bulkProjectIds') || '[]',
    );
    setProjectIds(storedProjectIds);

    async function fetchProjects() {
      if (storedProjectIds.length > 0) {
        const fetchedProjects = await Promise.all(
          storedProjectIds.map((id: string) => getProjectById(id)),
        );
        setProjects(fetchedProjects.filter(Boolean) as WithId<Project>[]);
      }
      setIsLoading(false);
    }

    fetchProjects();
  }, []);

  if (isLoading) {
    return <BulkTemplatePageSkeleton />;
  }

  if (projectIds.length === 0) {
    return (
      <Alert tone="danger" title="No projects selected">
        Go to the main dashboard to select projects for bulk template creation.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={ChevronLeft}
          className="-ml-2 mb-2"
          onClick={() => router.push('/wachat/bulk')}
        >
          Back to bulk actions
        </Button>
        <p
          className="text-[13px] [color:var(--st-text-secondary)]"
        >
          This template will be created for all {projects.length} selected
          projects.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {projects.map((p) => (
          <Badge key={p._id.toString()} tone="neutral" kind="outline">
            <Database
              className="h-3.5 w-3.5 [color:var(--st-text-tertiary)]"
              aria-hidden="true"
            />
            {p.name}
          </Badge>
        ))}
      </div>
      <CreateTemplateForm isBulkForm bulkProjectIds={projectIds} />
    </div>
  );
}

export default function BulkTemplatePage() {
  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Bulk', href: '/wachat/bulk' },
        { label: 'Template' },
      ]}
      title="Create Bulk Template"
      description="Create one WhatsApp message template across every selected project at once."
      width="narrow"
    >
      <Suspense fallback={<BulkTemplatePageSkeleton />}>
        <BulkTemplatePageContent />
      </Suspense>
    </WachatPage>
  );
}
