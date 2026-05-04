'use client';

/**
 * Wachat Bulk → Create Template — bulk-create one template across many
 * projects. Keeps existing CreateTemplateForm, only ZoruUI chrome.
 */

import * as React from 'react';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Database, AlertCircle } from 'lucide-react';

import { CreateTemplateForm } from '@/components/wabasimplify/create-template-form';
import { getProjectById } from '@/app/actions/project.actions';
import type { WithId, Project } from '@/lib/definitions';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruSkeleton,
} from '@/components/zoruui';

function BulkTemplatePageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ZoruSkeleton className="h-8 w-48" />
      <ZoruSkeleton className="h-24 w-full" />
      <ZoruSkeleton className="h-96 w-full" />
    </div>
  );
}

function BulkTemplatePageContent() {
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
      <ZoruAlert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>No projects selected</ZoruAlertTitle>
        <ZoruAlertDescription>
          Go to the main dashboard to select projects for bulk template
          creation.
        </ZoruAlertDescription>
      </ZoruAlert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <ZoruButton variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/wachat/bulk">
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to bulk actions
          </Link>
        </ZoruButton>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Create Bulk Template
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          This template will be created for all {projects.length} selected
          projects.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {projects.map((p) => (
          <span
            key={p._id.toString()}
            className="inline-flex items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-2.5 py-1 text-[12px] text-zoru-ink"
          >
            <Database className="h-3.5 w-3.5 text-zoru-ink-muted" />
            {p.name}
          </span>
        ))}
      </div>
      <CreateTemplateForm isBulkForm bulkProjectIds={projectIds} />
    </div>
  );
}

export default function BulkTemplatePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/bulk">
              Bulk
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Template</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <Suspense fallback={<BulkTemplatePageSkeleton />}>
        <BulkTemplatePageContent />
      </Suspense>
    </div>
  );
}
