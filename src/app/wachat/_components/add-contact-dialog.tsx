'use client';

/**
 * AddContactDialog (wachat-local, ZoruUI).
 *
 * Replaces @/components/wabasimplify/add-contact-dialog. Same server
 * action (handleAddNewContact), same hidden form fields, same project
 * + tag selection behaviour.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, UserPlus } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleAddNewContact } from '@/app/actions/contact.actions';
import { countryCodes } from '@/lib/country-codes';
import type { Project, Tag } from '@/lib/definitions';

import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruLabel,
  ZoruScrollArea,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';

import { MultiSelectCombobox } from './multi-select-combobox';

const initialState = {
  message: null as string | null,
  error: null as string | null,
  contactId: undefined as string | undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending ? 'Adding…' : 'Add contact'}
    </ZoruButton>
  );
}

interface AddContactDialogProps {
  project: WithId<Project>;
  onAdded: () => void;
}

export function AddContactDialog({ project, onAdded }: AddContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    handleAddNewContact as any,
    initialState as any,
  );
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState(
    project.phoneNumbers?.[0]?.id || '',
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState('91');
  const hasRunEffectRef = useRef(false);

  useEffect(() => {
    if ((state.message || state.error) && !hasRunEffectRef.current) {
      if (state.message) {
        toast({ title: 'Success', description: state.message });
        formRef.current?.reset();
        onAdded();
        setOpen(false);
      }
      if (state.error) {
        toast({
          title: 'Error',
          description: state.error,
          variant: 'destructive',
        });
      }
      hasRunEffectRef.current = true;
    }
  }, [state, toast, onAdded]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      formRef.current?.reset();
      setSelectedTagIds([]);
      hasRunEffectRef.current = false;
    }
    setOpen(isOpen);
  };

  const wrappedFormAction = (formData: FormData) => {
    hasRunEffectRef.current = false;
    (formAction as any)(formData);
  };

  const tagOptions = (project.tags || []).map((tag: Tag) => ({
    value: tag._id.toString(),
    label: tag.name,
    color: tag.color,
  }));

  return (
    <ZoruDialog open={open} onOpenChange={handleOpenChange}>
      <ZoruDialogTrigger asChild>
        <ZoruButton size="md">
          <UserPlus />
          Add contact
        </ZoruButton>
      </ZoruDialogTrigger>

      <ZoruDialogContent className="max-w-[520px] p-0">
        <form action={wrappedFormAction} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="tagIds" value={selectedTagIds.join(',')} />
          <input
            type="hidden"
            name="phoneNumberId"
            value={selectedPhoneNumberId}
          />
          <input type="hidden" name="countryCode" value={countryCode} />

          <ZoruDialogHeader className="flex flex-row items-start gap-3 border-b border-zoru-line px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink">
              <UserPlus className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <ZoruDialogTitle className="text-[16px] text-zoru-ink">
                Add new contact
              </ZoruDialogTitle>
              <ZoruDialogDescription className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Manually add a contact to your project. They&apos;ll become
                available for chat and broadcasts right away.
              </ZoruDialogDescription>
            </div>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            <Field label="WhatsApp number" htmlFor="phoneNumberId-dialog">
              <ZoruSelect
                value={selectedPhoneNumberId}
                onValueChange={setSelectedPhoneNumberId}
              >
                <ZoruSelectTrigger id="phoneNumberId-dialog">
                  <ZoruSelectValue placeholder="Choose a number…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {(project?.phoneNumbers || []).map((phone) => (
                    <ZoruSelectItem key={phone.id} value={phone.id}>
                      {phone.display_phone_number} ({phone.verified_name})
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </Field>

            <Field label="Full name" required htmlFor="name">
              <ZoruInput
                id="name"
                name="name"
                required
                placeholder="e.g. Priya Sharma"
              />
            </Field>

            <div className="grid grid-cols-[120px_1fr] items-end gap-3">
              <Field label="Country">
                <ZoruSelect value={countryCode} onValueChange={setCountryCode}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Code" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruScrollArea className="h-64">
                      {countryCodes.map((c) => (
                        <ZoruSelectItem key={c.name} value={c.code}>
                          +{c.code} ({c.name})
                        </ZoruSelectItem>
                      ))}
                    </ZoruScrollArea>
                  </ZoruSelectContent>
                </ZoruSelect>
              </Field>
              <Field label="Phone number" required htmlFor="phone">
                <ZoruInput
                  id="phone"
                  name="phone"
                  placeholder="9876543210"
                  required
                  inputMode="numeric"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">
                Tags
              </ZoruLabel>
              <MultiSelectCombobox
                options={tagOptions}
                selected={selectedTagIds}
                onSelectionChange={setSelectedTagIds}
                placeholder="Assign tags…"
              />
            </div>
          </div>

          <ZoruDialogFooter className="gap-2 border-t border-zoru-line px-6 py-4 sm:justify-end">
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

function Field({
  label,
  required,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <ZoruLabel
        htmlFor={htmlFor}
        className="text-[11.5px] text-zoru-ink-muted"
      >
        {label}
        {required ? <span className="ml-1 text-zoru-danger">*</span> : null}
      </ZoruLabel>
      {children}
    </div>
  );
}
