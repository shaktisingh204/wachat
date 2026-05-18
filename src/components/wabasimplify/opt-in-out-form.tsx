'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruButton,
  ZoruLabel,
  ZoruSwitch,
  ZoruTextarea,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Project } from '@/lib/definitions';
import { handleUpdateOptInOutSettings } from '@/app/actions/index.ts';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Opt-in/Out Settings
    </ZoruButton>
  );
}

interface OptInOutFormProps {
  project: WithId<Project>;
}

export function OptInOutForm({ project }: OptInOutFormProps) {
  const [state, formAction] = useActionState(handleUpdateOptInOutSettings as any, initialState as any);
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
    <ZoruCard className="card-gradient card-gradient-orange">
      <form action={formAction} ref={formRef}>
        <input type="hidden" name="projectId" value={project._id.toString()} />
        <ZoruCardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
                <ZoruCardTitle>Opt-in & Opt-out</ZoruCardTitle>
                <ZoruCardDescription>Manage keywords for user subscription preferences.</ZoruCardDescription>
            </div>
            <ZoruSwitch name="enabled" defaultChecked={settings?.enabled} />
          </div>
        </ZoruCardHeader>
        <ZoruCardContent className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <h4 className="font-semibold text-primary">Opt-in Settings</h4>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="optInKeywords">Opt-in Keywords</ZoruLabel>
                    <ZoruTextarea id="optInKeywords" name="optInKeywords" defaultValue={settings?.optInKeywords?.join(', ')} placeholder="start, subscribe, yes" />
                </div>
                 <div className="space-y-2">
                    <ZoruLabel htmlFor="optInResponse">Opt-in Response Message</ZoruLabel>
                    <ZoruTextarea id="optInResponse" name="optInResponse" defaultValue={settings?.optInResponse} placeholder="You have successfully subscribed!" />
                </div>
            </div>
            <div className="space-y-4">
                <h4 className="font-semibold text-destructive">Opt-out Settings</h4>
                 <div className="space-y-2">
                    <ZoruLabel htmlFor="optOutKeywords">Opt-out Keywords</ZoruLabel>
                    <ZoruTextarea id="optOutKeywords" name="optOutKeywords" defaultValue={settings?.optOutKeywords?.join(', ')} placeholder="stop, unsubscribe, cancel" />
                </div>
                 <div className="space-y-2">
                    <ZoruLabel htmlFor="optOutResponse">Opt-out Response Message</ZoruLabel>
                    <ZoruTextarea id="optOutResponse" name="optOutResponse" defaultValue={settings?.optOutResponse} placeholder="You have been unsubscribed." />
                </div>
            </div>
        </ZoruCardContent>
        <ZoruCardFooter>
          <SubmitButton />
        </ZoruCardFooter>
      </form>
    </ZoruCard>
  );
}
