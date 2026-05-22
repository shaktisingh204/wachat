'use client';

import { Button, Card, Input, Label, Switch, Textarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save } from 'lucide-react';

/**
 * <CustomFormForm /> — create + edit form for a tickets custom-form
 * entity.
 *
 * Sections: basics (name, slug) · fields repeater · settings (success
 * message, redirect URL, captcha toggle) · status. The repeater is
 * structured — no free-text JSON paste.
 */

import * as React from 'react';

import { EnumFormField } from '@/components/crm/enum-form-field';

import {
  saveForm,
  type SaveFormState,
} from '@/app/actions/crm-forms.actions';
import type {
  CrmFormDoc,
  CrmFormStatus,
} from '@/lib/rust-client/crm-forms';

import { FormFieldsRepeater } from './form-fields-repeater';

const BASE = '/dashboard/crm/tickets/custom-forms';

const initialState: SaveFormState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      {isEditing ? 'Save changes' : 'Create form'}
    </ZoruButton>
  );
}

interface CustomFormFormProps {
  initialData?: CrmFormDoc | null;
}

export function CustomFormForm({ initialData }: CustomFormFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const isEditing = !!initialData?._id;

  const [state, formAction] = useActionState(saveForm, initialState);

  const [status, setStatus] = useState<CrmFormStatus>(
    initialData?.status ?? 'draft',
  );
  const initialSettings = (initialData?.settings ?? {}) as Record<string, unknown>;
  const [captcha, setCaptcha] = useState<boolean>(
    Boolean(initialSettings.captcha),
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      const id = state.id ?? initialData?._id;
      router.push(id ? `${BASE}/${id}` : BASE);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router, initialData?._id]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {isEditing ? (
        <input type="hidden" name="formId" value={initialData!._id} />
      ) : null}
      <input type="hidden" name="status" value={status} />
      <input
        type="hidden"
        name="captcha"
        value={captcha ? 'true' : 'false'}
      />

      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">Basics</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <ZoruLabel htmlFor="name">
              Name <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="name"
              name="name"
              required
              defaultValue={initialData?.name ?? ''}
              placeholder="e.g. Contact us form"
            />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="slug">Slug</ZoruLabel>
            <ZoruInput
              id="slug"
              name="slug"
              defaultValue={initialData?.slug ?? ''}
              placeholder="auto-generated-from-name"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <ZoruLabel>Status</ZoruLabel>
            <EnumFormField
              enumName="kbStatus"
              name="statusPicker"
              initialId={status}
              placeholder="Status"
              onChange={(next) => setStatus((next ?? 'draft') as CrmFormStatus)}
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <FormFieldsRepeater initialFields={initialData?.fields} />
      </ZoruCard>

      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[14px] font-medium text-zoru-ink">Settings</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <ZoruLabel htmlFor="successMessage">Success message</ZoruLabel>
            <ZoruTextarea
              id="successMessage"
              name="successMessage"
              rows={2}
              defaultValue={String(initialSettings.successMessage ?? '')}
              placeholder="Shown to the submitter after a successful submission."
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <ZoruLabel htmlFor="redirectUrl">Redirect URL</ZoruLabel>
            <ZoruInput
              id="redirectUrl"
              name="redirectUrl"
              type="url"
              defaultValue={String(initialSettings.redirectUrl ?? '')}
              placeholder="https://example.com/thanks (optional)"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 sm:col-span-2">
            <div className="flex flex-col">
              <ZoruLabel htmlFor="captcha-toggle">Require CAPTCHA</ZoruLabel>
              <span className="text-xs text-muted-foreground">
                Recommended for public-facing forms to deter bot
                submissions.
              </span>
            </div>
            <ZoruSwitch
              id="captcha-toggle"
              checked={captcha}
              onCheckedChange={setCaptcha}
            />
          </div>
        </div>
      </ZoruCard>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <ZoruButton variant="ghost" asChild>
          <Link
            href={
              isEditing && initialData?._id ? `${BASE}/${initialData._id}` : BASE
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Link>
        </ZoruButton>
        <SubmitButton isEditing={isEditing} />
      </div>
    </form>
  );
}
