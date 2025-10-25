
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleUpdateProjectSettings } from '@/app/actions/project.actions';
import type { WithId, Project } from '@/lib/definitions';
import { Separator } from '../ui/separator';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Settings
    </Button>
  );
}

interface ProjectSettingsFormProps {
  project: WithId<Project>;
}

export function ProjectSettingsForm({ project }: ProjectSettingsFormProps) {
    const [state, formAction] = useActionState(handleUpdateProjectSettings, initialState);
    const { toast } = useToast();
    
    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <Card className="card-gradient card-gradient-blue">
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>Manage general settings for your project.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="messagesPerSecond">Messages Per Second (Concurrency)</Label>
                        <Input
                            id="messagesPerSecond"
                            name="messagesPerSecond"
                            type="number"
                            defaultValue={project.messagesPerSecond || 80}
                            required
                        />
                         <p className="text-xs text-muted-foreground">The maximum number of messages your broadcast campaign will attempt to send per second.</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
