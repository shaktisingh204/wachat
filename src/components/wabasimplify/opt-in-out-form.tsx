
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project } from '@/lib/definitions';
import { handleUpdateOptInOutSettings } from '@/app/actions';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Opt-in/Out Settings
    </Button>
  );
}

interface OptInOutFormProps {
  project: WithId<Project>;
}

export function OptInOutForm({ project }: OptInOutFormProps) {
  const [state, formAction] = useActionState(handleUpdateOptInOutSettings, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const settings = project.optInOutSettings;

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast]);

  return (
    <Card className="card-gradient card-gradient-orange">
      <form action={formAction} ref={formRef}>
        <input type="hidden" name="projectId" value={project._id.toString()} />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
                <CardTitle>Opt-in & Opt-out</CardTitle>
                <CardDescription>Manage keywords for user subscription preferences.</CardDescription>
            </div>
            <Switch name="enabled" defaultChecked={settings?.enabled} />
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-semibold text-primary">Opt-in Settings</h4>
                <div className="space-y-2">
                    <Label htmlFor="optInKeywords">Opt-in Keywords</Label>
                    <Textarea id="optInKeywords" name="optInKeywords" defaultValue={settings?.optInKeywords?.join(', ')} placeholder="start, subscribe, yes" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="optInResponse">Opt-in Response Message</Label>
                    <Textarea id="optInResponse" name="optInResponse" defaultValue={settings?.optInResponse} placeholder="You have successfully subscribed!" />
                </div>
            </div>
            <div className="space-y-4">
                <h4 className="font-semibold text-destructive">Opt-out Settings</h4>
                 <div className="space-y-2">
                    <Label htmlFor="optOutKeywords">Opt-out Keywords</Label>
                    <Textarea id="optOutKeywords" name="optOutKeywords" defaultValue={settings?.optOutKeywords?.join(', ')} placeholder="stop, unsubscribe, cancel" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="optOutResponse">Opt-out Response Message</Label>
                    <Textarea id="optOutResponse" name="optOutResponse" defaultValue={settings?.optOutResponse} placeholder="You have been unsubscribed." />
                </div>
            </div>
        </CardContent>
        <CardFooter>
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
