
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project } from '@/lib/definitions';
import { handleBulkBroadcast } from '@/app/actions/broadcast.actions';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
      Distribute & Send
    </Button>
  );
}

interface BulkBroadcastFormProps {
  sourceProjectName: string;
  targetProjects: WithId<Project>[];
}

export function BulkBroadcastForm({ sourceProjectName, targetProjects }: BulkBroadcastFormProps) {
  const [state, formAction] = useActionState(handleBulkBroadcast, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setFile(null);
    }
    if (state.error) {
      toast({ title: 'Error Starting Broadcasts', description: state.error, variant: 'destructive' });
    }
  }, [state, toast]);

  return (
    <Card>
      <form action={formAction} ref={formRef}>
        <input type="hidden" name="projectIds" value={targetProjects.map(p => p._id.toString()).join(',')} />
        <CardHeader>
          <CardTitle>Bulk Broadcast from File</CardTitle>
          <CardDescription>
            Upload a single contact file. The contacts will be evenly distributed and sent from all {targetProjects.length} selected projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="templateName">Template Name</Label>
            <Input id="templateName" name="templateName" required placeholder="e.g., offer_update_v2" />
            <p className="text-xs text-muted-foreground">This template must exist with the same name and language across all selected projects.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">Language Code</Label>
            <Input id="language" name="language" required placeholder="e.g., en_US" defaultValue="en_US" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactFile">Contact File</Label>
            <Input 
                id="contactFile" 
                name="contactFile" 
                type="file" 
                required 
                accept=".csv,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
             <p className="text-xs text-muted-foreground">A CSV or XLSX file. The first column must be the phone number.</p>
          </div>
        </CardContent>
        <CardFooter>
          <SubmitButton disabled={!file} />
        </CardFooter>
      </form>
    </Card>
  );
}
