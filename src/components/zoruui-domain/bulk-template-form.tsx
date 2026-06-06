'use client';

import { Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui';
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
  const { toast } = useToast();

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
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Bulk Add Template</CardTitle>
          <CardDescription>
            Choose a template from &ldquo;{sourceProjectName}&rdquo; to add to all selected
            projects.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-select">Template to apply</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Select a template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t._id.toString()} value={t._id.toString()}>
                    {t.name} ({t.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--st-text-secondary)]">
              This will add or update the template with the same name and language in each
              selected project.
            </p>
          </div>
        </CardBody>
        <CardFooter>
          <Button type="submit" disabled={isPending || !selectedTemplate}>
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Apply to all
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
