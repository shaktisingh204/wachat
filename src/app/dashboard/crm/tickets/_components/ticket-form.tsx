'use client';

/**
 * <TicketForm> — single source of truth for both Create and Edit flows.
 *
 * Server-action driven via `saveTicketAction`. The form encodes every
 * relational/reference field as an `<EntityFormField>` so the value
 * stored is an id (or an inline-created string for reference entities).
 * The enum-typed fields (`status`, `priority`, `severity`, `channel`)
 * use `<ZoruSelect>` because they're closed vocabularies on the Rust
 * side rather than picker-backed entities. Custom fields are rendered
 * below the standard fields and submitted as a single `customFields`
 * JSON blob — the action layer fans them out via
 * `applyCustomFieldsToEntity`.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
  CustomFieldInput,
  type CustomFieldValue,
} from '@/components/crm/custom-field-input';
import { saveTicketAction } from '@/app/actions/crm/tickets.actions';
import type { CrmTicketDoc } from '@/lib/rust-client/crm-tickets';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

interface TicketFormProps {
  /** Existing ticket — present in Edit mode, omit for Create. */
  initial?: CrmTicketDoc | null;
  /** Custom field definitions for `belongs_to = 'ticket'`. */
  customFields: WsCustomField[];
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create ticket'}
    </ZoruButton>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

/* ─── Enum vocabularies (mirror crm_extras_types + crm_core) ──── */

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'web', label: 'Web' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'chat', label: 'Chat' },
  { value: 'phone', label: 'Phone' },
  { value: 'portal', label: 'Portal' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'reopened', label: 'Reopened' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'sev1', label: 'Sev 1 — critical' },
  { value: 'sev2', label: 'Sev 2 — high' },
  { value: 'sev3', label: 'Sev 3 — normal' },
  { value: 'sev4', label: 'Sev 4 — low' },
];

export function TicketForm({ initial, customFields }: TicketFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveTicketAction, INITIAL_STATE);

  const editing = !!initial?._id;

  // The enum-typed fields are controlled by local state because the
  // ZoruSelect is a controlled Radix component. They sync into hidden
  // inputs so the form's FormData carries them on submit.
  const [channel, setChannel] = useState<string>(initial?.channel ?? 'email');
  const [status, setStatus] = useState<string>(initial?.status ?? 'open');
  const [priority, setPriority] = useState<string>(initial?.priority ?? '');
  const [severity, setSeverity] = useState<string>(initial?.severity ?? 'sev3');

  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, CustomFieldValue>
  >(() => {
    const seed: Record<string, CustomFieldValue> = {};
    const bag = (initial?.customFields ?? {}) as Record<string, unknown>;
    for (const f of customFields) {
      const v = bag[f.name];
      if (v !== undefined) {
        seed[f.name] = v as CustomFieldValue;
      }
    }
    return seed;
  });

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/tickets/${state.id}`
          : '/dashboard/crm/tickets',
      );
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  const handleCustomFieldChange = (name: string, next: CustomFieldValue) => {
    setCustomFieldValues((prev) => ({ ...prev, [name]: next }));
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      <input
        type="hidden"
        name="customFields"
        value={JSON.stringify(customFieldValues)}
      />
      {/* Enum hidden inputs — sync'd from controlled ZoruSelect state. */}
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="severity" value={severity} />

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Basics
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="subject">
              Subject <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="subject"
              name="subject"
              required
              defaultValue={initial?.subject ?? ''}
              className="mt-1.5"
              placeholder="Login broken on mobile"
            />
          </div>
          <div>
            <ZoruLabel>Client (requester) <span className="text-zoru-danger-ink">*</span></ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="client"
                name="requesterId"
                initialId={initial?.requesterId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <ZoruLabel>Category</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="category"
                name="category"
                initialId={initial?.category ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="channel-select">Channel <span className="text-zoru-danger-ink">*</span></ZoruLabel>
            <ZoruSelect value={channel} onValueChange={setChannel}>
              <ZoruSelectTrigger id="channel-select" className="mt-1.5">
                <ZoruSelectValue placeholder="Select channel…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {CHANNEL_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div>
            <ZoruLabel htmlFor="severity-select">Severity <span className="text-zoru-danger-ink">*</span></ZoruLabel>
            <ZoruSelect value={severity} onValueChange={setSeverity}>
              <ZoruSelectTrigger id="severity-select" className="mt-1.5">
                <ZoruSelectValue placeholder="Select severity…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {SEVERITY_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Workflow
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="status-select">Status</ZoruLabel>
            <ZoruSelect value={status} onValueChange={setStatus}>
              <ZoruSelectTrigger id="status-select" className="mt-1.5">
                <ZoruSelectValue placeholder="Select status…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div>
            <ZoruLabel htmlFor="priority-select">Priority</ZoruLabel>
            <ZoruSelect
              value={priority}
              onValueChange={(v) => setPriority(v)}
            >
              <ZoruSelectTrigger id="priority-select" className="mt-1.5">
                <ZoruSelectValue placeholder="Select priority…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {PRIORITY_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div>
            <ZoruLabel htmlFor="dueBy">Due by</ZoruLabel>
            <ZoruInput
              id="dueBy"
              name="dueBy"
              type="datetime-local"
              defaultValue={
                initial?.dueBy
                  ? new Date(initial.dueBy).toISOString().slice(0, 16)
                  : ''
              }
              className="mt-1.5"
            />
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Assignment
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>Assignee (agent)</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="assigneeId"
                initialId={initial?.assigneeId ?? null}
              />
            </div>
          </div>
        </div>
      </ZoruCard>

      {customFields.length > 0 ? (
        <ZoruCard className="p-6">
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
            Custom fields
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {customFields.map((f) => (
              <CustomFieldInput
                key={String(f._id ?? f.name)}
                field={f}
                value={customFieldValues[f.name]}
                onChange={(v) => handleCustomFieldChange(f.name, v)}
              />
            ))}
          </div>
        </ZoruCard>
      ) : null}

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link href={editing ? `/dashboard/crm/tickets/${String(initial!._id)}` : '/dashboard/crm/tickets'}>
            Cancel
          </Link>
        </ZoruButton>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
