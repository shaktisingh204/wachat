'use client';

import {
  Button,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  Switch,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Save } from 'lucide-react';

import { updateOptInOutSettings } from '@/app/actions/wachat-auto-reply-settings.actions';
import type { Project,
  WithId } from '@/lib/definitions';

/**
 * OptInOutForm (wachat-local, 20ui).
 *
 * Replaces the legacy opt-in-out-form. Now backed by the Rust crate via
 * `updateOptInOutSettings`, with the same form fields and switch.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const initialState: { message: string | null; error: string | null } = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending}
      loading={pending}
      iconLeft={pending ? undefined : Save}
    >
      Save Opt-in/Out Settings
    </Button>
  );
}

interface OptInOutFormProps {
  project: WithId<Project>;
}

export function OptInOutForm({ project }: OptInOutFormProps) {
  const [state, formAction] = useActionState(
    updateOptInOutSettings as any,
    initialState as any,
  );
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const settings = project.optInOutSettings;

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message, tone: 'success' });
    }
    if (state.error) {
      toast({
        title: 'Error',
        description: state.error,
        tone: 'danger',
      });
    }
  }, [state, toast]);

  return (
    <form action={formAction as any} ref={formRef}>
      <input type="hidden" name="projectId" value={project._id.toString()} />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Opt-in &amp; Opt-out</CardTitle>
            <CardDescription>
              Manage keywords for user subscription preferences.
            </CardDescription>
          </div>
          <Switch
            name="enabled"
            defaultChecked={settings?.enabled}
            aria-label="Enable opt-in &amp; opt-out automation"
          />
        </div>
      </CardHeader>
      <CardBody className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h4 className="text-[14px] [color:var(--st-text)]">
            Opt-in Settings
          </h4>
          <Field label="Opt-in Keywords" id="optInKeywords">
            <Textarea
              id="optInKeywords"
              name="optInKeywords"
              defaultValue={settings?.optInKeywords?.join(', ')}
              placeholder="start, subscribe, yes"
            />
          </Field>
          <Field label="Opt-in Response Message" id="optInResponse">
            <Textarea
              id="optInResponse"
              name="optInResponse"
              defaultValue={settings?.optInResponse}
              placeholder="You have successfully subscribed!"
            />
          </Field>
        </div>
        <div className="flex flex-col gap-4">
          <h4 className="text-[14px] [color:var(--st-danger)]">
            Opt-out Settings
          </h4>
          <Field label="Opt-out Keywords" id="optOutKeywords">
            <Textarea
              id="optOutKeywords"
              name="optOutKeywords"
              defaultValue={settings?.optOutKeywords?.join(', ')}
              placeholder="stop, unsubscribe, cancel"
            />
          </Field>
          <Field label="Opt-out Response Message" id="optOutResponse">
            <Textarea
              id="optOutResponse"
              name="optOutResponse"
              defaultValue={settings?.optOutResponse}
              placeholder="You have been unsubscribed."
            />
          </Field>
        </div>
      </CardBody>
      <CardFooter>
        <SubmitButton />
      </CardFooter>
    </form>
  );
}
