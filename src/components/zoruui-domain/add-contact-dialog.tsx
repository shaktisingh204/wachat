'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ScrollArea,
  Button,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LuUserPlus,
  LuLoader } from 'react-icons/lu';
import type { WithId } from 'mongodb';

import { handleAddNewContact } from '@/app/actions/contact.actions';
import { useToast } from '@/hooks/use-toast';
import type { Project,
  Tag } from '@/lib/definitions';
import { countryCodes } from '@/lib/country-codes';

import { MultiSelectCombobox } from './multi-select-combobox';

/**
 * AddContactDialog — ZoruUI-styled contact creation modal.
 *
 * Uses Dialog, Input, Select, and a Button trigger so it
 * matches the rest of the Wachat contacts toolbar.
 */

import * as React from 'react';

import { cn } from '@/lib/utils';

const initialState = {
  message: null,
  error: null,
  contactId: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="rose"
      size="md"
      disabled={pending}
      leading={
        pending ? (
          <LuLoader className="h-3.5 w-3.5 animate-spin" />
        ) : undefined
      }
    >
      {pending ? 'Adding…' : 'Add contact'}
    </Button>
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
  const { toast } = useToast();
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ZoruDialogTrigger asChild>
        <Button
          variant="rose"
          size="md"
          leading={<LuUserPlus className="h-3.5 w-3.5" strokeWidth={2} />}
        >
          Add contact
        </Button>
      </ZoruDialogTrigger>

      <ZoruDialogContent
        className={cn(
          'max-w-[520px] rounded-[18px] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-0 shadow-lg',
        )}
      >
        <form action={wrappedFormAction} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="tagIds" value={selectedTagIds.join(',')} />
          <input
            type="hidden"
            name="phoneNumberId"
            value={selectedPhoneNumberId}
          />
          <input type="hidden" name="countryCode" value={countryCode} />

          <ZoruDialogHeader className="flex flex-row items-start gap-3 border-b border-[var(--st-border)] px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
              <LuUserPlus className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <ZoruDialogTitle className="text-[16px] font-semibold text-[var(--st-text)] leading-tight">
                Add new contact
              </ZoruDialogTitle>
              <ZoruDialogDescription className="mt-0.5 text-[12px] text-[var(--st-text-secondary)] leading-snug">
                Manually add a contact to your project. They&apos;ll become
                available for chat and broadcasts right away.
              </ZoruDialogDescription>
            </div>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* WhatsApp number */}
            <Field label="WhatsApp number" htmlFor="phoneNumberId-dialog">
              <Select
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
              </Select>
            </Field>

            {/* Full name */}
            <Field label="Full name" required htmlFor="name">
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Priya Sharma"
              />
            </Field>

            {/* Country + phone number */}
            <div className="grid grid-cols-[120px_1fr] items-end gap-3">
              <Field label="Country">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Code" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ScrollArea className="h-64">
                      {countryCodes.map((c) => (
                        <ZoruSelectItem key={c.name} value={c.code}>
                          +{c.code} ({c.name})
                        </ZoruSelectItem>
                      ))}
                    </ScrollArea>
                  </ZoruSelectContent>
                </Select>
              </Field>
              <Field label="Phone number" required htmlFor="phone">
                <Input
                  id="phone"
                  name="phone"
                  placeholder="9876543210"
                  required
                  inputMode="numeric"
                />
              </Field>
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]">
                Tags
              </Label>
              <MultiSelectCombobox
                options={tagOptions}
                selected={selectedTagIds}
                onSelectionChange={setSelectedTagIds}
                placeholder="Assign tags…"
              />
            </div>
          </div>

          <ZoruDialogFooter className="border-t border-[var(--st-border)] px-6 py-4 sm:justify-end gap-2">
            <Button
              type="button"
              variant="pill"
              size="md"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

/* ── local helpers ──────────────────────────────────────────────── */

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
      <Label
        htmlFor={htmlFor}
        className="text-[11.5px] font-semibold text-[var(--st-text-secondary)]"
      >
        {label}
        {required ? <span className="ml-1 text-[var(--st-text)]">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
