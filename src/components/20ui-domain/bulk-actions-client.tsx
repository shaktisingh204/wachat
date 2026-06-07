'use client';

import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui';
import {
  useState,
  useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';

import type { WithId,
  Project,
  Template } from '@/lib/definitions';
import { BulkTemplateForm } from '@/components/20ui-domain/bulk-template-form';
import { BulkBroadcastForm } from './bulk-broadcast-form';

interface BulkActionsClientProps {
  sourceProjectName: string;
  allProjects: WithId<Project>[];
  initialTemplates: WithId<Template>[];
  initialSelectedProjects: WithId<Project>[];
}

export function BulkActionsClient({
  sourceProjectName,
  initialTemplates,
  initialSelectedProjects,
}: BulkActionsClientProps) {
  const [selectedProjects] = useState<WithId<Project>[]>(initialSelectedProjects);
  const router = useRouter();

  useEffect(() => {
    document.title = 'Bulk Actions | SabNode';
  }, []);

  const handleCreateTemplateClick = () => {
    localStorage.setItem(
      'bulkProjectIds',
      JSON.stringify(selectedProjects.map((p) => p._id.toString())),
    );
    router.push('/wachat/bulk/template');
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeading>
          <PageTitle>Bulk Actions</PageTitle>
          <PageDescription>
            Performing actions on {selectedProjects.length} selected project
            {selectedProjects.length === 1 ? '' : 's'}.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <BulkTemplateForm
          sourceProjectName={sourceProjectName}
          targetProjects={selectedProjects}
          templates={initialTemplates}
        />
        <BulkBroadcastForm
          sourceProjectName={sourceProjectName}
          targetProjects={selectedProjects}
        />

        {/* Create-new-template CTA — readable card with explicit
            ink/muted tokens (no shadcn-button-as-card hack). */}
        <Card className="flex h-full flex-col">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle className="mt-3">Create &amp; Apply New Template</CardTitle>
            <CardDescription>
              Build a template from scratch and apply it to all selected projects in one step.
            </CardDescription>
          </CardHeader>
          <CardBody className="mt-auto">
            <Button block onClick={handleCreateTemplateClick}>
              <FileText className="h-4 w-4" />
              New template
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
