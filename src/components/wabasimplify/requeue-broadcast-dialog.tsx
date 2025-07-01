
'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RotateCw, LoaderCircle } from 'lucide-react';
import { handleRequeueBroadcast } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project, Template } from '@/lib/definitions';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Requeuing...
        </>
      ) : (
        'Requeue Broadcast'
      )}
    </Button>
  );
}

interface RequeueBroadcastDialogProps {
  broadcastId: string;
  originalTemplateId: string;
  project: Pick<WithId<Project>, '_id' | 'phoneNumbers'> | null;
  templates: WithId<Template>[];
}

export function RequeueBroadcastDialog({ broadcastId, originalTemplateId, project, templates }: RequeueBroadcastDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleRequeueBroadcast, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(originalTemplateId);
  
  const selectedTemplate = templates.find(t => t._id.toString() === selectedTemplateId);
  const showImageUpload = selectedTemplate?.components?.some(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format));

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success', description: state.message });
      setOpen(false);
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      formRef.current?.reset();
      setSelectedTemplateId(originalTemplateId);
    }
    setOpen(isOpen);
  };
  
  const approvedTemplates = templates.filter(t => t.status?.toUpperCase() === 'APPROVED');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCw />
          Requeue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="broadcastId" value={broadcastId} />
          <DialogHeader>
            <DialogTitle>Requeue Broadcast</DialogTitle>
            <DialogDescription>Configure options for this new broadcast attempt.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateId">Message Template</Label>
              <Select name="templateId" value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger id="templateId">
                  <SelectValue placeholder="Choose an approved template..." />
                </SelectTrigger>
                <SelectContent searchable>
                  {approvedTemplates.length > 0 ? (
                    approvedTemplates.map((template) => (
                      <SelectItem key={template._id.toString()} value={template._id.toString()}>
                        {template.name} (<span className="capitalize">{template.status ? template.status.replace(/_/g, " ").toLowerCase() : 'N/A'}</span>)
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No approved templates found.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {showImageUpload && (
              <div className="space-y-2">
                <Label htmlFor="headerImageUrl">Header Media URL (Optional)</Label>
                <Input
                  id="headerImageUrl"
                  name="headerImageUrl"
                  type="url"
                  placeholder="Leave blank to use template default"
                />
                <p className="text-xs text-muted-foreground">
                  Provide a new public media URL to override the template's header.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Target Contacts</Label>
              <RadioGroup defaultValue="ALL" name="requeueScope" className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ALL" id="scope-all" />
                  <Label htmlFor="scope-all">All Original Contacts</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FAILED" id="scope-failed" />
                  <Label htmlFor="scope-failed">Only Failed Contacts</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
