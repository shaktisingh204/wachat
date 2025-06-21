'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { handleStartBroadcast } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { LoaderCircle, Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import type { Project } from '@/app/dashboard/page';

type Template = {
  name: string;
  category: string;
  body: string;
};

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
          Processing...
        </>
      ) : (
        <>
          <Send className="mr-2 h-4 w-4" />
          Start Broadcast
        </>
      )}
    </Button>
  );
}

export function BroadcastForm({ templates, project }: { templates: WithId<Template>[]; project: WithId<Project> | null }) {
  const [state, formAction] = useFormState(handleStartBroadcast, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      formRef.current?.reset();
      setFileName('');
    }
    if (state?.error) {
      toast({
        title: 'Broadcast Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  if (!project) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>No Project Selected</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Action Required</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard page before sending a broadcast.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="projectId" value={project._id.toString()} />
        <CardHeader>
          <CardTitle>New Broadcast Campaign</CardTitle>
          <CardDescription>Select a phone number, template, and upload your contacts CSV file.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="phoneNumberId">1. Select Phone Number</Label>
            <Select name="phoneNumberId" required>
              <SelectTrigger id="phoneNumberId">
                <SelectValue placeholder="Choose a number..." />
              </SelectTrigger>
              <SelectContent>
                {project.phoneNumbers?.map((phone) => (
                  <SelectItem key={phone.id} value={phone.id}>
                    {phone.display_phone_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="templateId">2. Select Message Template</Label>
            <Select name="templateId" required>
              <SelectTrigger id="templateId">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template._id.toString()} value={template._id.toString()}>
                    {template.name} ({template.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="csvFile">3. Upload Contacts</Label>
            <Input
              id="csvFile"
              name="csvFile"
              type="file"
              accept=".csv"
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              className="file:text-primary file:font-medium"
            />
            <p className="text-xs text-muted-foreground">
              CSV with 'phone' column. For variables like {'{{1}}'}, use 'variable1' columns.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
