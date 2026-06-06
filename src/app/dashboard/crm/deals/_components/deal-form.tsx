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
 * <DealForm> — shared by Create and Edit flows.
 *
 * Deals require a tagged party (`{ kind: 'client' | 'lead', id }`) — we
 * model it as a two-field group: a "Party kind" segmented switch and an
 * EntityPicker scoped to the chosen kind. Both values are mirrored to
 * hidden inputs (`partyKind`, `partyId`) for FormData submission.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityPicker } from '@/components/crm/entity-picker';
import {
  CustomFieldInput,
  type CustomFieldValue,
} from '@/components/crm/custom-field-input';
import { saveDealAction } from '@/app/actions/crm/deals.actions';
import type { CrmDealDoc } from '@/lib/rust-client/crm-deals';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

interface DealFormProps {
  initial?: CrmDealDoc | null;
  customFields: WsCustomField[];
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create deal'}
    </Button>
  );
}

export function DealForm({ initial, customFields }: DealFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveDealAction, INITIAL_STATE);
  const editing = !!initial?._id;

  const [partyKind, setPartyKind] = useState<'client' | 'lead'>(
    (initial?.party?.kind as 'client' | 'lead') ?? 'client',
  );
  const [partyId, setPartyId] = useState<string | null>(initial?.party?.id ?? null);
  const [pipelineId, setPipelineId] = useState<string | null>(initial?.pipelineId ?? null);

  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, CustomFieldValue>
  >(() => {
    const seed: Record<string, CustomFieldValue> = {};
    const bag = (initial?.customFields ?? {}) as Record<string, unknown>;
    for (const f of customFields) {
      const v = bag[f.name];
      if (v !== undefined) seed[f.name] = v as CustomFieldValue;
    }
    return seed;
  });

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(state.id ? `/dashboard/crm/deals/${state.id}` : '/dashboard/crm/deals');
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
      <input type="hidden" name="partyKind" value={partyKind} />
      <input type="hidden" name="partyId" value={partyId ?? ''} />
      <input type="hidden" name="customFields" value={JSON.stringify(customFieldValues)} />

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Basics
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="title">
              Title <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={initial?.title ?? ''}
              className="mt-1.5"
              placeholder="e.g. Website redesign for Acme Corp"
            />
          </div>
          <div>
            <Label>
              Counter-party type <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="partyKind"
                name="partyKindPicker"
                initialId={partyKind}
                allowInlineCreate={false}
                onChange={(next) => {
                  if (next === 'client' || next === 'lead') setPartyKind(next);
                }}
              />
            </div>
          </div>
          <div>
            <Label>
              {partyKind === 'client' ? 'Client' : 'Lead'}{' '}
              <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityPicker
                entity={partyKind}
                value={partyId}
                onChange={(next) => setPartyId(typeof next === 'string' ? next : null)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Pipeline & Ownership
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>
              Pipeline <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="pipeline"
                name="pipelineId"
                initialId={initial?.pipelineId ?? null}
                onChange={(next) => setPipelineId(next)}
                required
              />
            </div>
          </div>
          <div>
            <Label>
              Stage <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="stage"
                name="stageId"
                initialId={initial?.stageId ?? null}
                filter={pipelineId ? { pipelineId } : undefined}
                required
              />
            </div>
          </div>
          <div>
            <Label>
              Owner <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="user"
                name="ownerId"
                initialId={initial?.ownerId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <div className="mt-1.5">
              <EnumFormField
                enumName="dealStatus"
                name="status"
                initialId={initial?.status ?? 'open'}
                placeholder="Status"
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
            <Label htmlFor="amount">
              Amount <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min={0}
              required
              defaultValue={initial?.amount ?? ''}
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
            <Label htmlFor="expectedClose">
              Expected close date <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input
              id="expectedClose"
              name="expectedClose"
              type="date"
              required
              defaultValue={
                initial?.expectedClose
                  ? new Date(initial.expectedClose).toISOString().slice(0, 10)
                  : ''
              }
              className="mt-1.5"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="wonLostReason">Won / Lost reason</Label>
            <Input
              id="wonLostReason"
              name="wonLostReason"
              defaultValue={initial?.wonLostReason ?? ''}
              className="mt-1.5"
              placeholder="Optional context for closed deals"
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
          <Link
            href={editing ? `/dashboard/crm/deals/${String(initial!._id)}` : '/dashboard/crm/deals'}
          >
            Cancel
          </Link>
        </Button>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
