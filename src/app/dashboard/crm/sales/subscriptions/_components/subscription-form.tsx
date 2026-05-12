'use client';

/**
 * <SubscriptionForm> — single source of truth for both Create and Edit
 * flows of `/dashboard/crm/sales/subscriptions`.
 *
 * Server-action driven via `saveSubscriptionAction`. Every reference
 * field (customer, plan/item, currency) renders as an
 * `<EntityFormField>` so the value stored is an id (or a string for
 * inline-create entities). The Rust BFF accepts a `Vec<SubscriptionItem>`
 * — this form models the common "one line item" case; multi-line UX is
 * out of scope and can be layered on later without changing the action
 * shape.
 *
 * Subscriptions are NOT registered in `WsCustomFieldBelongsTo`, so the
 * custom-fields panel is intentionally absent.
 */

import * as React from 'react';
import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
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
import { saveSubscriptionAction } from '@/app/actions/crm/subscriptions.actions';
import type {
  CrmSubBillingFrequency,
  CrmSubRenewalMode,
  CrmSubscriptionDoc,
} from '@/lib/rust-client/crm-subscriptions';

interface SubscriptionFormProps {
  /** Existing subscription — present in Edit mode, omit for Create. */
  initial?: CrmSubscriptionDoc | null;
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create subscription'}
    </ZoruButton>
  );
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

const FREQUENCY_OPTIONS: ReadonlyArray<{
  value: CrmSubBillingFrequency;
  label: string;
}> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

const RENEWAL_OPTIONS: ReadonlyArray<{
  value: CrmSubRenewalMode;
  label: string;
}> = [
  { value: 'auto', label: 'Auto-renew' },
  { value: 'manual', label: 'Manual renewal' },
];

function toDateInput(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function SubscriptionForm({ initial }: SubscriptionFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    saveSubscriptionAction,
    INITIAL_STATE,
  );

  const editing = !!initial?._id;
  const firstItem = initial?.items?.[0];

  const [frequency, setFrequency] = React.useState<CrmSubBillingFrequency>(
    initial?.frequency ?? 'monthly',
  );
  const [renewalMode, setRenewalMode] = React.useState<CrmSubRenewalMode>(
    initial?.renewalMode ?? 'auto',
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(
        state.id
          ? `/dashboard/crm/sales/subscriptions/${state.id}`
          : '/dashboard/crm/sales/subscriptions',
      );
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? (
        <input type="hidden" name="_id" value={String(initial!._id)} />
      ) : null}
      <input type="hidden" name="frequency" value={frequency} />
      <input type="hidden" name="renewalMode" value={renewalMode} />

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Customer & Plan
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>
              Customer{' '}
              <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="client"
                name="customerId"
                initialId={initial?.customerId ?? null}
                required
                disabled={editing}
              />
            </div>
            {editing ? (
              <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
                Customer cannot change once the subscription exists.
              </p>
            ) : null}
          </div>
          <div>
            <ZoruLabel>
              Plan / item{' '}
              <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="item"
                name="itemId"
                initialId={firstItem?.itemId ?? null}
                required
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="qty">Quantity</ZoruLabel>
            <ZoruInput
              id="qty"
              name="qty"
              type="number"
              step="0.01"
              min={0}
              defaultValue={firstItem?.qty ?? 1}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="rate">Rate / amount</ZoruLabel>
            <ZoruInput
              id="rate"
              name="rate"
              type="number"
              step="0.01"
              min={0}
              defaultValue={firstItem?.rate ?? ''}
              className="mt-1.5"
              placeholder="0.00"
            />
          </div>
          <div>
            <ZoruLabel>Currency</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="currency"
                name="currency"
                initialId={firstItem?.currency ?? 'INR'}
              />
            </div>
          </div>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Billing cadence
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel>
              Billing cycle{' '}
              <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <ZoruSelect
                value={frequency}
                onValueChange={(v) =>
                  setFrequency(v as CrmSubBillingFrequency)
                }
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <ZoruSelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
          <div>
            <ZoruLabel>
              Renewal mode{' '}
              <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <div className="mt-1.5">
              <ZoruSelect
                value={renewalMode}
                onValueChange={(v) =>
                  setRenewalMode(v as CrmSubRenewalMode)
                }
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {RENEWAL_OPTIONS.map((opt) => (
                    <ZoruSelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="startedAt">
              Start date{' '}
              <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="startedAt"
              name="startedAt"
              type="date"
              required
              defaultValue={toDateInput(initial?.startedAt)}
              className="mt-1.5"
              disabled={editing}
            />
            {editing ? (
              <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
                Start date is fixed once the subscription exists.
              </p>
            ) : null}
          </div>
          <div>
            <ZoruLabel htmlFor="trialUntil">Trial ends (optional)</ZoruLabel>
            <ZoruInput
              id="trialUntil"
              name="trialUntil"
              type="date"
              defaultValue={toDateInput(initial?.trialUntil)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="nextBillingAt">Next billing date</ZoruLabel>
            <ZoruInput
              id="nextBillingAt"
              name="nextBillingAt"
              type="date"
              defaultValue={toDateInput(initial?.nextBillingAt)}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
              <ZoruCheckbox
                name="prorationEnabled"
                defaultChecked={!!initial?.prorationEnabled}
              />
              <span>Enable proration on mid-cycle changes</span>
            </label>
          </div>
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link
            href={
              editing
                ? `/dashboard/crm/sales/subscriptions/${String(initial!._id)}`
                : '/dashboard/crm/sales/subscriptions'
            }
          >
            Cancel
          </Link>
        </ZoruButton>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
