'use client';

import { Button, Card, Input, Label, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

/**
 * <LeadForm> — single source of truth for both Create and Edit flows.
 *
 * Server-action driven via `saveLeadAction`. The form encodes every
 * relational/reference field as an `<EntityFormField>` so the value
 * stored is an id (or a string for inline-create entities). Custom
 * fields are rendered below the standard fields and submitted as a
 * single `customFields` JSON blob — the action layer fans them out
 * via `applyCustomFieldsToEntity`.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  CustomFieldInput,
  type CustomFieldValue,
} from '@/components/crm/custom-field-input';
import { saveLeadAction } from '@/app/actions/crm/leads.actions';
import type { CrmLeadDoc } from '@/lib/rust-client/crm-leads';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

interface LeadFormProps {
  /** Existing lead — present in Edit mode, omit for Create. */
  initial?: CrmLeadDoc | null;
  /** Custom field definitions for `belongs_to = 'lead'`. */
  customFields: WsCustomField[];
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create lead'}
    </Button>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

export function LeadForm({ initial, customFields }: LeadFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveLeadAction, INITIAL_STATE);

  const editing = !!initial?._id;

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
          ? `/dashboard/crm/leads/${state.id}`
          : '/dashboard/crm/leads',
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

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Identity
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name <span className="text-[var(--st-danger)]">*</span></Label>
            <Input
              id="firstName"
              name="firstName"
              required
              defaultValue={initial?.firstName ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last name <span className="text-[var(--st-danger)]">*</span></Label>
            <Input
              id="lastName"
              name="lastName"
              required
              defaultValue={initial?.lastName ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={initial?.email ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={initial?.phone ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              name="company"
              defaultValue={initial?.company ?? ''}
              className="mt-1.5"
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <Label>Job title</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="jobTitle"
                name="title"
                initialId={initial?.title ?? null}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Workflow
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Source</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="leadSource"
                name="source"
                initialId={initial?.attribution?.source ?? null}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="subSource">Sub-source</Label>
            <Input
              id="subSource"
              name="subSource"
              defaultValue={initial?.subSource ?? ''}
              className="mt-1.5"
              placeholder="e.g. Existing customer"
            />
          </div>
          <div>
            <Label>Status</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="leadStatus"
                name="status"
                initialId={initial?.status?.name ?? 'new'}
                placeholder="new"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="leadScore">Lead score (0–100)</Label>
            <Input
              id="leadScore"
              name="leadScore"
              type="number"
              min={0}
              max={100}
              defaultValue={initial?.leadScore ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Owner (SDR)</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="ownerId"
                initialId={initial?.ownerId ?? null}
              />
            </div>
          </div>
          <div>
            <Label>Assigned to (AE)</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="assignedTo"
                initialId={initial?.assignment?.assignedTo ?? null}
              />
            </div>
          </div>
          <div>
            <Label>Industry</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="industry"
                name="industry"
                initialId={initial?.industry ?? null}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Value & Forecast
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="estimatedValue">Estimated value</Label>
            <Input
              id="estimatedValue"
              name="estimatedValue"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial?.estimatedValue ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Currency</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="currency"
                initialId={initial?.currency ?? 'INR'}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="probabilityPct">Probability % (0–100)</Label>
            <Input
              id="probabilityPct"
              name="probabilityPct"
              type="number"
              min={0}
              max={100}
              defaultValue={initial?.probabilityPct ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="expectedClose">Expected close date</Label>
            <Input
              id="expectedClose"
              name="expectedClose"
              type="date"
              defaultValue={
                initial?.expectedClose
                  ? new Date(initial.expectedClose).toISOString().slice(0, 10)
                  : ''
              }
              className="mt-1.5"
            />
          </div>
        </div>
      </Card>

      {customFields.length > 0 ? (
        <Card className="p-6">
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
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
        </Card>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href={editing ? `/dashboard/crm/leads/${String(initial!._id)}` : '/dashboard/crm/leads'}>
            Cancel
          </Link>
        </Button>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
