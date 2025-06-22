
'use client';

import { useEffect, useState, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { getProjectById, handleUpdateProjectSettings } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project } from '@/app/dashboard/page';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, LoaderCircle, Save } from 'lucide-react';

const updateSettingsInitialState = {
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
          Saving...
        </>
      ) : (
        <>
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </>
      )}
    </Button>
  );
}

export default function SettingsPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [messagesPerSecond, setMessagesPerSecond] = useState(80);
  const { toast } = useToast();
  const [state, formAction] = useActionState(handleUpdateProjectSettings, updateSettingsInitialState);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    document.title = 'Project Settings | Wachat';
    const storedProjectId = localStorage.getItem('activeProjectId');
    if (storedProjectId) {
      getProjectById(storedProjectId)
        .then((data) => {
          if (data) {
            setProject(data);
            setMessagesPerSecond(data.messagesPerSecond || 80);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isClient]);

  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
    }
    if (state?.error) {
      toast({
        title: 'Error updating settings',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  if (!isClient || loading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-8 w-1/3" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Project Settings</h1>
          <p className="text-muted-foreground">Manage settings for your project.</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Project Selected</AlertTitle>
          <AlertDescription>
            Please select a project from the main dashboard to manage its settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Project Settings</h1>
        <p className="text-muted-foreground">Manage settings for project "{project.name}".</p>
      </div>

      <form action={formAction}>
        <input type="hidden" name="projectId" value={project._id.toString()} />
        <Card>
          <CardHeader>
            <CardTitle>Broadcast Settings</CardTitle>
            <CardDescription>Configure the rate at which broadcast messages are sent.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="messagesPerSecond">Messages Per Second</Label>
              <Input
                id="messagesPerSecond"
                name="messagesPerSecond"
                type="number"
                min="1"
                step="10"
                value={messagesPerSecond}
                onChange={(e) => setMessagesPerSecond(Number(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                The number of messages to send per second. A batch of this size will be sent every second.
              </p>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <SubmitButton />
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
