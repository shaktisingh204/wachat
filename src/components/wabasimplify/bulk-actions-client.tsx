'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import {
  useState,
  useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';

import type { WithId,
  Project,
  Template } from '@/lib/definitions';
import { BulkTemplateForm } from '@/components/wabasimplify/bulk-template-form';
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
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Bulk Actions</ZoruPageTitle>
          <ZoruPageDescription>
            Performing actions on {selectedProjects.length} selected project
            {selectedProjects.length === 1 ? '' : 's'}.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

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
        <ZoruCard className="flex h-full flex-col">
          <ZoruCardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
              <FileText className="h-5 w-5" />
            </div>
            <ZoruCardTitle className="mt-3">Create &amp; Apply New Template</ZoruCardTitle>
            <ZoruCardDescription>
              Build a template from scratch and apply it to all selected projects in one step.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="mt-auto">
            <ZoruButton block onClick={handleCreateTemplateClick}>
              <FileText className="h-4 w-4" />
              New template
            </ZoruButton>
          </ZoruCardContent>
        </ZoruCard>
      </div>
    </div>
  );
}
