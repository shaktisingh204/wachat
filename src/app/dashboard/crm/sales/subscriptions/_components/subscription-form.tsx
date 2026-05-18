'use client';

/**
 * <SubscriptionForm> — single source of truth for both Create and Edit
 * flows of `/dashboard/crm/sales/subscriptions` (§1D.3 / §1D.4 rebuild).
 *
 * Wraps the existing `saveSubscriptionAction` server action in the
 * canonical `<EntityFormShell>` with five sectioned cards:
 *
 *   1. Client info        — customer picker (+ contact-side hints)
 *   2. Plan               — plan / catalog item, qty, rate, currency
 *   3. Schedule           — billing cadence, start date, trial window,
 *                           next billing date
 *   4. Pricing            — proration toggle + renewal mode + status
 *                           (status uses <EnumFormField enumName="subscriptionStatus">)
 *   5. Reminders/Dunning  — placeholder card surfacing the cadence the
 *                           daily cron will run; full dunning-ladder
 *                           editor is deferred to a follow-up batch.
 *
 * Every reference field renders as `<EntityFormField>` so the value
 * carried in FormData is an id (customer, item, currency). Status uses
 * `<EnumFormField>` against the catalogued `subscriptionStatus` enum.
 *
 * Subscriptions are NOT registered in `WsCustomFieldBelongsTo`, so the
 * custom-fields panel is intentionally absent (same as before).
 */

import * as React from 'react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
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
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormShell } from '@/components/crm/entity-form-shell';
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

const INITIAL_STATE: {
  message?: string;
  error?: string;
  id?: string;
} = {};

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
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function SubscriptionForm({ initial }: SubscriptionFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(
    saveSubscriptionAction,
    INITIAL_STATE,
  );

  const editing = Boolean(initial?._id);
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

  /* ─── Section bodies ─────────────────────────────────────────── */

  const clientSection = (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <ZoruLabel>
          Customer <span className="text-zoru-danger-ink">*</span>
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
    </div>
  );

  const planSection = (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <ZoruLabel>
          Plan / item <span className="text-zoru-danger-ink">*</span>
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
  );

  const scheduleSection = (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <ZoruLabel>
          Billing cycle <span className="text-zoru-danger-ink">*</span>
        </ZoruLabel>
        <div className="mt-1.5">
          <ZoruSelect
            value={frequency}
            onValueChange={(v) => setFrequency(v as CrmSubBillingFrequency)}
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
        <ZoruLabel htmlFor="startedAt">
          Start date <span className="text-zoru-danger-ink">*</span>
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
    </div>
  );

  const pricingSection = (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <ZoruLabel>
          Renewal mode <span className="text-zoru-danger-ink">*</span>
        </ZoruLabel>
        <div className="mt-1.5">
          <ZoruSelect
            value={renewalMode}
            onValueChange={(v) => setRenewalMode(v as CrmSubRenewalMode)}
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
        <ZoruLabel>Status</ZoruLabel>
        <div className="mt-1.5">
          {/*
            Status uses the catalogued `subscriptionStatus` enum
            (`src/data/reference/crm-enums.ts`). On Create, the Rust BFF
            ignores any client-supplied status and seeds the row as
            `active` / `trial`; this field is informational + used on
            Edit / inline lifecycle moves. Inline-create is locked off
            so the picker stays on the canonical six values.
          */}
          <EnumFormField
            enumName="subscriptionStatus"
            name="status"
            initialId={initial?.status ?? 'active'}
            allowInlineCreate={false}
            disabled={!editing}
          />
        </div>
        {!editing ? (
          <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
            Status is set automatically on create — adjust it after.
          </p>
        ) : null}
      </div>
      <div className="flex items-end md:col-span-2">
        <label className="flex items-center gap-2 text-[13px] text-zoru-ink">
          <ZoruCheckbox
            name="prorationEnabled"
            defaultChecked={Boolean(initial?.prorationEnabled)}
          />
          <span>Enable proration on mid-cycle changes</span>
        </label>
      </div>
    </div>
  );

  const dunningSection = (
    <div className="grid gap-2 text-[12.5px] text-zoru-ink-muted">
      <p>
        Past-due subscriptions run the tenant's default dunning cadence
        once a day via the <code>subscriptions-daily</code> cron — email
        (day 1), SMS (day 3), WhatsApp (day 5), ticket (day 7), suspend
        (day 14).
      </p>
      <p>
        Per-subscription overrides are out of scope for this batch. A
        dedicated editor will land in a follow-up; today the daily cron
        reads <code>dunningConfig</code> on the tenant settings row.
      </p>
      {/* TODO 1D.3: ship dunning-ladder editor (per-step day-offset +
          channel + template picker). Needs the Rust BFF to accept
          `dunningLadder` on PATCH (today it accepts it on create only). */}
    </div>
  );

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <EntityFormShell
      action={formAction}
      sections={[
        {
          id: 'client',
          title: 'Client info',
          description: 'Pick the customer this subscription bills.',
          children: clientSection,
        },
        {
          id: 'plan',
          title: 'Plan',
          description:
            'Catalog item, quantity, rate, and currency for the recurring line.',
          children: planSection,
        },
        {
          id: 'schedule',
          title: 'Schedule',
          description:
            'Billing cadence, start date, trial window, and next billing date.',
          children: scheduleSection,
        },
        {
          id: 'pricing',
          title: 'Pricing',
          description: 'Renewal mode, proration policy, and lifecycle status.',
          children: pricingSection,
        },
        {
          id: 'dunning',
          title: 'Reminders & dunning',
          description: 'Past-due cadence the daily cron runs on this tenant.',
          children: dunningSection,
        },
      ]}
      submitLabel={editing ? 'Save changes' : 'Create subscription'}
      cancelHref={
        editing
          ? `/dashboard/crm/sales/subscriptions/${String(initial!._id)}`
          : '/dashboard/crm/sales/subscriptions'
      }
      error={state?.error}
      message={state?.message}
      hiddenInputs={
        <>
          {editing ? (
            <input type="hidden" name="_id" value={String(initial!._id)} />
          ) : null}
          <input type="hidden" name="frequency" value={frequency} />
          <input type="hidden" name="renewalMode" value={renewalMode} />
        </>
      }
    />
  );
}
