'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';

import type { WithId,
  Project,
  Template } from '@/lib/definitions';
import { handleApplyTemplateToProjects } from '@/app/actions/template.actions';

interface BulkTemplateFormProps {
  sourceProjectName: string;
  targetProjects: WithId<Project>[];
  templates: WithId<Template>[];
}

export function BulkTemplateForm({
  sourceProjectName,
  targetProjects,
  templates,
}: BulkTemplateFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      toast({
        title: 'No template selected',
        description: 'Please choose a template to apply.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const projectIds = targetProjects.map((p) => p._id.toString());
      const result = await handleApplyTemplateToProjects(selectedTemplate, projectIds);
      if (result.success) {
        toast({ title: 'Success', description: 'Template applied to all selected projects.' });
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <ZoruCard>
      <form onSubmit={handleSubmit}>
        <ZoruCardHeader>
          <ZoruCardTitle>Bulk Add Template</ZoruCardTitle>
          <ZoruCardDescription>
            Choose a template from &ldquo;{sourceProjectName}&rdquo; to add to all selected
            projects.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <div className="space-y-2">
            <ZoruLabel htmlFor="template-select">Template to apply</ZoruLabel>
            <ZoruSelect value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <ZoruSelectTrigger id="template-select">
                <ZoruSelectValue placeholder="Select a template…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {templates.map((t) => (
                  <ZoruSelectItem key={t._id.toString()} value={t._id.toString()}>
                    {t.name} ({t.language})
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <p className="text-xs text-zoru-ink-muted">
              This will add or update the template with the same name and language in each
              selected project.
            </p>
          </div>
        </ZoruCardContent>
        <ZoruCardFooter>
          <ZoruButton type="submit" disabled={isPending || !selectedTemplate}>
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Apply to all
          </ZoruButton>
        </ZoruCardFooter>
      </form>
    </ZoruCard>
  );
}
