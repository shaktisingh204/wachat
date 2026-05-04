'use client';

/**
 * OptInOutForm (wachat-local, ZoruUI).
 *
 * Replaces @/components/wabasimplify/opt-in-out-form. Same server
 * action (handleUpdateOptInOutSettings), same form fields and switch.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Save } from 'lucide-react';

import { handleUpdateOptInOutSettings } from '@/app/actions/index.ts';
import type { Project, WithId } from '@/lib/definitions';

import {
  ZoruButton,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruLabel,
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

const initialState: { message: string | null; error: string | null } = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Save />}
      Save Opt-in/Out Settings
    </ZoruButton>
  );
}

interface OptInOutFormProps {
  project: WithId<Project>;
}

export function OptInOutForm({ project }: OptInOutFormProps) {
  const [state, formAction] = useActionState(
    handleUpdateOptInOutSettings as any,
    initialState as any,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const settings = project.optInOutSettings;

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
    }
    if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <form action={formAction as any} ref={formRef}>
      <input type="hidden" name="projectId" value={project._id.toString()} />
      <ZoruCardHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <ZoruCardTitle>Opt-in &amp; Opt-out</ZoruCardTitle>
            <ZoruCardDescription>
              Manage keywords for user subscription preferences.
            </ZoruCardDescription>
          </div>
          <ZoruSwitch name="enabled" defaultChecked={settings?.enabled} />
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h4 className="text-[14px] text-zoru-ink">Opt-in Settings</h4>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="optInKeywords">Opt-in Keywords</ZoruLabel>
            <ZoruTextarea
              id="optInKeywords"
              name="optInKeywords"
              defaultValue={settings?.optInKeywords?.join(', ')}
              placeholder="start, subscribe, yes"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="optInResponse">
              Opt-in Response Message
            </ZoruLabel>
            <ZoruTextarea
              id="optInResponse"
              name="optInResponse"
              defaultValue={settings?.optInResponse}
              placeholder="You have successfully subscribed!"
            />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <h4 className="text-[14px] text-zoru-danger">Opt-out Settings</h4>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="optOutKeywords">Opt-out Keywords</ZoruLabel>
            <ZoruTextarea
              id="optOutKeywords"
              name="optOutKeywords"
              defaultValue={settings?.optOutKeywords?.join(', ')}
              placeholder="stop, unsubscribe, cancel"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="optOutResponse">
              Opt-out Response Message
            </ZoruLabel>
            <ZoruTextarea
              id="optOutResponse"
              name="optOutResponse"
              defaultValue={settings?.optOutResponse}
              placeholder="You have been unsubscribed."
            />
          </div>
        </div>
      </ZoruCardContent>
      <ZoruCardFooter>
        <SubmitButton />
      </ZoruCardFooter>
    </form>
  );
}
