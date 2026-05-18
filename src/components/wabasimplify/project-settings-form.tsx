
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleUpdateProjectSettings } from '@/app/actions/project.actions';
import type { WithId, Project } from '@/lib/definitions';
import { ZoruSeparator } from '../ui/separator';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Settings
    </ZoruButton>
  );
}

interface ProjectSettingsFormProps {
  project: WithId<Project>;
}

export function ProjectSettingsForm({ project }: ProjectSettingsFormProps) {
    const [state, formAction] = useActionState(handleUpdateProjectSettings as any, initialState as any);
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
            <ZoruCard className="card-gradient card-gradient-blue">
                <ZoruCardHeader>
                    <ZoruCardTitle>General Settings</ZoruCardTitle>
                    <ZoruCardDescription>Manage general settings for your project.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="messagesPerSecond">Messages Per Second (Concurrency)</ZoruLabel>
                        <ZoruInput
                            id="messagesPerSecond"
                            name="messagesPerSecond"
                            type="number"
                            defaultValue={project.messagesPerSecond || 80}
                            required
                        />
                         <p className="text-xs text-muted-foreground">The maximum number of messages your broadcast campaign will attempt to send per second.</p>
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SubmitButton />
                </ZoruCardFooter>
            </ZoruCard>
        </form>
    );
}
