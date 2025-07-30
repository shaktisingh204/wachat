
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project, Template } from '@/lib/definitions';
import { handleBulkBroadcast } from '@/app/actions/broadcast.actions';

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>}
      Send to All
    </Button>
  );
}

interface BulkBroadcastFormProps {
  sourceProjectName: string;
  targetProjects: WithId<Project>[];
  templates: WithId<Template>[];
}

export function BulkBroadcastForm({ sourceProjectName, targetProjects, templates }: BulkBroadcastFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const approvedTemplates = templates.filter(t => t.status === 'APPROVED');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      toast({ title: 'No template selected', description: 'Please choose a template to send.', variant: 'destructive' });
      return;
    }
    
    startTransition(async () => {
        const projectIds = targetProjects.map(p => p._id.toString());
        const result = await handleBulkBroadcast(selectedTemplate, projectIds);

        if (result.error) {
            toast({ title: 'Error Starting Broadcasts', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success!', description: result.message });
        }
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Bulk Broadcast</CardTitle>
          <CardDescription>
            Send a template from "{sourceProjectName}" to all contacts in the selected projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-select">Template to Send</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger id="template-select">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {approvedTemplates.map(t => (
                  <SelectItem key={t._id.toString()} value={t._id.toString()}>
                    {t.name} ({t.language})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Only approved templates are shown. This broadcast will not use any variables.</p>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton disabled={!selectedTemplate} />
        </CardFooter>
      </form>
    </Card>
  );
}
