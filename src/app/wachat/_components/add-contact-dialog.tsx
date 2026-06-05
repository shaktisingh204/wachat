'use client';

import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2,
  UserPlus } from 'lucide-react';
import type { WithId } from 'mongodb';

import { handleAddNewContact } from '@/app/actions/contact.actions';
import { countryCodes } from '@/lib/country-codes';
import type { Project,
  Tag } from '@/lib/definitions';

/**
 * AddContactDialog (wachat-local, 20ui).
 *
 * Replaces the legacy add-contact-dialog. Same server
 * action (handleAddNewContact), same hidden form fields, same project
 * + tag selection behaviour.
 */

import * as React from 'react';

import { MultiSelectCombobox } from './multi-select-combobox';

const initialState = {
  message: null as string | null,
  error: null as string | null,
  contactId: undefined as string | undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" size={14} aria-hidden="true" /> : null}
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
        toast({ title: 'Success', description: state.message, tone: 'success' });
        formRef.current?.reset();
        onAdded();
        setOpen(false);
      }
      if (state.error) {
        toast({
          title: 'Error',
          description: state.error,
          tone: 'danger',
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

  const phoneOptions = (project?.phoneNumbers || []).map((phone) => ({
    value: phone.id,
    label: `${phone.display_phone_number} (${phone.verified_name})`,
  }));

  const countryOptions = countryCodes.map((c) => ({
    value: c.code,
    label: `+${c.code} (${c.name})`,
  }));

  return (
    <>
      <Button variant="primary" size="md" iconLeft={UserPlus} onClick={() => handleOpenChange(true)}>
        Add contact
      </Button>

      <form action={wrappedFormAction} ref={formRef}>
        <Modal
          open={open}
          onClose={() => handleOpenChange(false)}
          size="md"
          title={
            <span className="flex flex-row items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center"
                style={{
                  borderRadius: 'var(--st-radius-sm)',
                  background: 'var(--st-surface-muted)',
                  color: 'var(--st-text)',
                }}
              >
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>Add new contact</span>
            </span>
          }
          description="Manually add a contact to your project. They'll become available for chat and broadcasts right away."
          footer={
            <div className="flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <SubmitButton />
            </div>
          }
        >
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <input type="hidden" name="tagIds" value={selectedTagIds.join(',')} />
          <input
            type="hidden"
            name="phoneNumberId"
            value={selectedPhoneNumberId}
          />
          <input type="hidden" name="countryCode" value={countryCode} />

          <div className="flex flex-col gap-5">
            <Field label="WhatsApp number">
              <Select
                value={selectedPhoneNumberId}
                onChange={(v) => setSelectedPhoneNumberId(v ?? '')}
                options={phoneOptions}
                placeholder="Choose a number…"
                aria-label="WhatsApp number"
              />
            </Field>

            <Field label="Full name" required>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Priya Sharma"
              />
            </Field>

            <div className="grid grid-cols-[120px_1fr] items-end gap-3">
              <Field label="Country">
                <Select
                  value={countryCode}
                  onChange={(v) => setCountryCode(v ?? '')}
                  options={countryOptions}
                  placeholder="Code"
                  searchable
                  aria-label="Country"
                />
              </Field>
              <Field label="Phone number" required>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="9876543210"
                  required
                  inputMode="numeric"
                />
              </Field>
            </div>

            <Field label="Tags">
              <MultiSelectCombobox
                options={tagOptions}
                selected={selectedTagIds}
                onSelectionChange={setSelectedTagIds}
                placeholder="Assign tags…"
              />
            </Field>
          </div>
        </Modal>
      </form>
    </>
  );
}
