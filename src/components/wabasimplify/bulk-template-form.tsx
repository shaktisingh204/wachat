
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Copy, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project, Template } from '@/lib/definitions';
import { handleApplyTemplateToProjects } from '@/app/actions/template.actions';

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
      Apply to All
    </Button>
  );
}

interface BulkTemplateFormProps {
  sourceProjectName: string;
  targetProjects: WithId<Project>[];
  templates: WithId<Template>[];
}

export function BulkTemplateForm({ sourceProjectName, targetProjects, templates }: BulkTemplateFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      toast({ title: 'No template selected', description: 'Please choose a template to apply.', variant: 'destructive' });
      return;
    }
    
    startTransition(async () => {
        const projectIds = targetProjects.map(p => p._id.toString());
        const result = await handleApplyTemplateToProjects(selectedTemplate, projectIds);

        if (result.success) {
            toast({ title: 'Success!', description: 'Template applied to all selected projects.' });
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
            Choose a template from "{sourceProjectName}" to add to all selected projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-select">Template to Apply</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t._id.toString()} value={t._id.toString()}>
                    {t.name} ({t.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">This will add or update the template with the same name and language in each selected project.</p>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton disabled={!selectedTemplate} />
        </CardFooter>
      </form>
    </Card>
  );
}
